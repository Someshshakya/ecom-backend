const express = require("express");
const { protect, vendorApproved } = require("../middleware/authMiddleware");
const {
  getVendorDashboard,
  getVendorProducts,
  updateVendorProfile,
  getVendorOrders,
  updateVendorOrderStatus,
  getVendorAnalytics
} = require("../controllers/vendorController");

const router = express.Router();

router.get("/dashboard", protect, vendorApproved, getVendorDashboard);
router.get("/products", protect, vendorApproved, getVendorProducts);
router.put("/profile", protect, vendorApproved, updateVendorProfile);
router.get("/orders", protect, vendorApproved, getVendorOrders);
router.put("/orders/:id/status", protect, vendorApproved, updateVendorOrderStatus);
router.get("/analytics", protect, vendorApproved, getVendorAnalytics);

module.exports = router;

