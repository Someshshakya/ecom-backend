const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  saveForLater,
  moveToCart
} = require("../controllers/cartController");

const router = express.Router();

router.get("/", protect, authorize("customer"), getCart);
router.post("/add", protect, authorize("customer"), addToCart);
router.put("/update/:itemId", protect, authorize("customer"), updateCartItem);
router.delete("/remove/:itemId", protect, authorize("customer"), removeCartItem);
router.post("/save-for-later/:itemId", protect, authorize("customer"), saveForLater);
router.post("/move-to-cart/:itemId", protect, authorize("customer"), moveToCart);

module.exports = router;

