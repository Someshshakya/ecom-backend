const express = require("express");
const { stripeWebhook, razorpayWebhook } = require("../controllers/paymentController");

const router = express.Router();

router.post("/webhook/stripe", express.raw({ type: "application/json" }), stripeWebhook);
router.post("/webhook/razorpay", express.raw({ type: "application/json" }), razorpayWebhook);

module.exports = router;

