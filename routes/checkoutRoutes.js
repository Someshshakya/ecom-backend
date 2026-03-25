const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const { checkout, getCheckoutSummary } = require("../controllers/checkoutController");

const router = express.Router();

router.post("/", protect, authorize("customer"), checkout);
router.get("/summary", protect, authorize("customer"), getCheckoutSummary);

module.exports = router;

