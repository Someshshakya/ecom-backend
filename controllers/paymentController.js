const crypto = require("crypto");
const Order = require("../models/Order");

function safeEqual(a, b) {
  const aBuf = Buffer.from(a || "", "utf8");
  const bBuf = Buffer.from(b || "", "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

async function stripeWebhook(req, res, next) {
  try {
    const signature = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      res.status(500);
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    }

    const expected = crypto.createHmac("sha256", secret).update(req.body).digest("hex");
    if (!safeEqual(signature, expected)) {
      res.status(400);
      throw new Error("Invalid Stripe webhook signature");
    }

    const payload = JSON.parse(req.body.toString("utf8"));
    const orderId = payload?.data?.object?.metadata?.orderId;
    const transactionId = payload?.data?.object?.id;

    if (orderId && payload?.type === "payment_intent.succeeded") {
      await Order.findByIdAndUpdate(orderId, {
        paymentStatus: "paid",
        "paymentDetails.transactionId": transactionId,
        "paymentDetails.paidAt": new Date(),
        "paymentDetails.provider": "stripe"
      });
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
}

async function razorpayWebhook(req, res, next) {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      res.status(500);
      throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured");
    }

    const expected = crypto.createHmac("sha256", secret).update(req.body).digest("hex");
    if (!safeEqual(signature, expected)) {
      res.status(400);
      throw new Error("Invalid Razorpay webhook signature");
    }

    const payload = JSON.parse(req.body.toString("utf8"));
    const event = payload?.event;
    const payment = payload?.payload?.payment?.entity;
    const orderId = payment?.notes?.orderId;

    if (orderId && event === "payment.captured") {
      await Order.findByIdAndUpdate(orderId, {
        paymentStatus: "paid",
        "paymentDetails.transactionId": payment.id,
        "paymentDetails.paidAt": new Date(payment.created_at ? payment.created_at * 1000 : Date.now()),
        "paymentDetails.provider": "razorpay"
      });
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  stripeWebhook,
  razorpayWebhook
};

