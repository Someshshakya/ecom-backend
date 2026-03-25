const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const { getUserOrders, getOrderById, cancelOrder, trackOrder } = require("../controllers/orderController");

const router = express.Router();

router.get("/", protect, authorize("customer"), getUserOrders);
router.get("/:id", protect, getOrderById);
router.post("/:id/cancel", protect, authorize("customer"), cancelOrder);
router.get("/:id/tracking", protect, authorize("customer"), trackOrder);

module.exports = router;

