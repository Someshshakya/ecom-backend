const Joi = require("joi");
const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");

const vendorProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  phone: Joi.string().allow("").optional(),
  avatar: Joi.string().allow("").optional(),
  vendorDetails: Joi.object({
    businessName: Joi.string().allow("").optional(),
    businessAddress: Joi.string().allow("").optional(),
    gstNumber: Joi.string().allow("").optional(),
    description: Joi.string().allow("").optional()
  }).optional()
}).min(1);

const orderStatusSchema = Joi.object({
  status: Joi.string().valid("pending", "processing", "shipped", "delivered", "cancelled").required()
});

async function getVendorDashboard(req, res, next) {
  try {
    const vendorId = req.user._id;

    const [totalProducts, orders, recentOrders, lowStockProducts] = await Promise.all([
      Product.countDocuments({ vendor: vendorId }),
      Order.find({ vendor: vendorId }),
      Order.find({ vendor: vendorId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("customer", "name email"),
      Product.find({ vendor: vendorId, stock: { $lt: 10 } }).sort({ stock: 1 }).limit(20)
    ]);

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);

    res.json({
      totalProducts,
      totalOrders,
      totalRevenue,
      recentOrders,
      lowStockProducts
    });
  } catch (err) {
    next(err);
  }
}

async function getVendorProducts(req, res, next) {
  try {
    const vendorId = req.user._id;
    const products = await Product.find({ vendor: vendorId }).sort({ createdAt: -1 });
    res.json({ products });
  } catch (err) {
    next(err);
  }
}

async function updateVendorProfile(req, res, next) {
  try {
    const { value, error } = vendorProfileSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400);
      throw new Error(error.details.map((d) => d.message).join(", "));
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }
    if (user.role !== "vendor") {
      res.status(403);
      throw new Error("Vendor access only");
    }

    if (value.name !== undefined) user.name = value.name;
    if (value.phone !== undefined) user.phone = value.phone;
    if (value.avatar !== undefined) user.avatar = value.avatar;

    if (value.vendorDetails) {
      user.vendorDetails = { ...user.vendorDetails.toObject?.(), ...value.vendorDetails };
    }

    await user.save();

    res.json({
      vendor: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
        vendorDetails: user.vendorDetails
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getVendorOrders(req, res, next) {
  try {
    const vendorId = req.user._id;
    const orders = await Order.find({ vendor: vendorId })
      .sort({ createdAt: -1 })
      .populate("customer", "name email")
      .populate("items.product", "name");

    res.json({ orders });
  } catch (err) {
    next(err);
  }
}

async function updateVendorOrderStatus(req, res, next) {
  try {
    const vendorId = req.user._id;
    const { value, error } = orderStatusSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400);
      throw new Error(error.details.map((d) => d.message).join(", "));
    }

    const order = await Order.findOne({ _id: req.params.id, vendor: vendorId });
    if (!order) {
      res.status(404);
      throw new Error("Order not found");
    }

    order.status = value.status;
    if (value.status === "delivered") order.deliveredAt = new Date();
    await order.save();

    res.json({ order });
  } catch (err) {
    next(err);
  }
}

async function getVendorAnalytics(req, res, next) {
  try {
    const vendorId = req.user._id;

    const days = Math.min(Math.max(parseInt(req.query.days || "30", 10), 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [summary] = await Order.aggregate([
      { $match: { vendor: vendorId, createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          revenue: { $sum: "$totalAmount" },
          avgOrderValue: { $avg: "$totalAmount" }
        }
      },
      { $project: { _id: 0, orders: 1, revenue: 1, avgOrderValue: 1 } }
    ]);

    const revenueByDay = await Order.aggregate([
      { $match: { vendor: vendorId, createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            y: { $year: "$createdAt" },
            m: { $month: "$createdAt" },
            d: { $dayOfMonth: "$createdAt" }
          },
          orders: { $sum: 1 },
          revenue: { $sum: "$totalAmount" }
        }
      },
      { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
      {
        $project: {
          _id: 0,
          date: {
            $dateFromParts: { year: "$_id.y", month: "$_id.m", day: "$_id.d" }
          },
          orders: 1,
          revenue: 1
        }
      }
    ]);

    const ordersByStatus = await Order.aggregate([
      { $match: { vendor: vendorId, createdAt: { $gte: since } } },
      { $group: { _id: "$status", count: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, status: "$_id", count: 1, revenue: 1 } }
    ]);

    res.json({
      range: { days, since },
      summary: summary || { orders: 0, revenue: 0, avgOrderValue: 0 },
      revenueByDay,
      ordersByStatus
    });
  } catch (err) {
    next(err);
  }
}

// Admin approval workflow
async function adminGetPendingVendors(req, res, next) {
  try {
    const vendors = await User.find({
      role: "vendor",
      "vendorDetails.approvalStatus": "pending"
    }).sort({ createdAt: -1 });
    res.json({ vendors });
  } catch (err) {
    next(err);
  }
}

async function adminApproveVendor(req, res, next) {
  try {
    const vendor = await User.findOne({ _id: req.params.id, role: "vendor" });
    if (!vendor) {
      res.status(404);
      throw new Error("Vendor not found");
    }
    vendor.vendorDetails.approvalStatus = "approved";
    await vendor.save();
    res.json({ vendor });
  } catch (err) {
    next(err);
  }
}

async function adminRejectVendor(req, res, next) {
  try {
    const vendor = await User.findOne({ _id: req.params.id, role: "vendor" });
    if (!vendor) {
      res.status(404);
      throw new Error("Vendor not found");
    }
    vendor.vendorDetails.approvalStatus = "rejected";
    await vendor.save();
    res.json({ vendor });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getVendorDashboard,
  getVendorProducts,
  updateVendorProfile,
  getVendorOrders,
  updateVendorOrderStatus,
  getVendorAnalytics,
  adminGetPendingVendors,
  adminApproveVendor,
  adminRejectVendor
};

