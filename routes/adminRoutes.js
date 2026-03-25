const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const { adminGetUsers, adminGetVendors, adminChangeUserRole } = require("../controllers/userController");
const {
  adminGetPendingVendors,
  adminApproveVendor,
  adminRejectVendor
} = require("../controllers/vendorController");
const { adminGetOrders, adminUpdateOrder } = require("../controllers/orderController");

const router = express.Router();

router.get("/users", protect, authorize("admin"), adminGetUsers);
router.get("/vendors", protect, authorize("admin"), adminGetVendors);
router.put("/users/:id/role", protect, authorize("admin"), adminChangeUserRole);
router.get("/vendors/pending", protect, authorize("admin"), adminGetPendingVendors);
router.put("/vendors/:id/approve", protect, authorize("admin"), adminApproveVendor);
router.put("/vendors/:id/reject", protect, authorize("admin"), adminRejectVendor);
router.get("/orders", protect, authorize("admin"), adminGetOrders);
router.put("/orders/:id", protect, authorize("admin"), adminUpdateOrder);

module.exports = router;

