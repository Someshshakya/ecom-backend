const Joi = require("joi");
const Order = require("../models/Order");

const adminUpdateSchema = Joi.object({
  orderStatus: Joi.string().valid("pending", "confirmed", "processing", "shipped", "delivered", "cancelled").optional(),
  paymentStatus: Joi.string().valid("pending", "paid", "failed", "refunded").optional(),
  trackingNumber: Joi.string().allow("").optional(),
  note: Joi.string().allow("").optional()
}).min(1);

const ALLOWED_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: []
};

async function getUserOrders(req, res, next) {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate("items.product", "name images")
      .populate("vendor", "name email");
    res.json({ orders });
  } catch (err) {
    next(err);
  }
}

async function getOrderById(req, res, next) {
  try {
    const order = await Order.findById(req.params.id)
      .populate("items.product", "name images")
      .populate("vendor", "name email")
      .populate("user", "name email");
    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }
    const canAccess =
      req.user.role === "admin" ||
      (req.user.role === "vendor" && order.vendor.toString() === req.user._id.toString()) ||
      order.user.toString() === req.user._id.toString();
    if (!canAccess) {
      res.status(403);
      throw new Error("Forbidden");
    }
    res.json({ order });
  } catch (err) {
    next(err);
  }
}

async function cancelOrder(req, res, next) {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }
    if (!["pending", "confirmed"].includes(order.orderStatus)) {
      res.status(400);
      throw new Error("Order cannot be cancelled at this stage");
    }

    order.orderStatus = "cancelled";
    order.statusHistory.push({ status: "cancelled", note: "Cancelled by customer" });
    await order.save();

    res.json({ order });
  } catch (err) {
    next(err);
  }
}

async function trackOrder(req, res, next) {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    res.json({
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      trackingNumber: order.trackingNumber,
      estimatedDelivery: order.estimatedDelivery,
      deliveredAt: order.deliveredAt,
      statusHistory: order.statusHistory
    });
  } catch (err) {
    next(err);
  }
}

async function adminGetOrders(req, res, next) {
  try {
    const orders = await Order.find({})
      .sort({ createdAt: -1 })
      .populate("user", "name email")
      .populate("vendor", "name email");
    res.json({ orders });
  } catch (err) {
    next(err);
  }
}

async function adminUpdateOrder(req, res, next) {
  try {
    const { value, error } = adminUpdateSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400);
      throw new Error(error.details.map((d) => d.message).join(", "));
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    if (value.orderStatus) {
      const allowed = ALLOWED_TRANSITIONS[order.orderStatus] || [];
      if (!allowed.includes(value.orderStatus) && value.orderStatus !== order.orderStatus) {
        res.status(400);
        throw new Error(`Invalid status transition from ${order.orderStatus} to ${value.orderStatus}`);
      }
      order.orderStatus = value.orderStatus;
      order.statusHistory.push({ status: value.orderStatus, note: value.note || "Updated by admin" });
      if (value.orderStatus === "delivered") {
        order.deliveredAt = new Date();
      }
    }

    if (value.paymentStatus) {
      order.paymentStatus = value.paymentStatus;
      if (value.paymentStatus === "paid" && !order.paymentDetails?.paidAt) {
        order.paymentDetails = {
          ...(order.paymentDetails || {}),
          paidAt: new Date()
        };
      }
    }

    if (value.trackingNumber !== undefined) {
      order.trackingNumber = value.trackingNumber || undefined;
    }

    await order.save();
    res.json({ order });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getUserOrders,
  getOrderById,
  cancelOrder,
  trackOrder,
  adminGetOrders,
  adminUpdateOrder
};

