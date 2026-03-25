const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  getProfile,
  updateProfile,
  changePassword,
  addAddress,
  updateAddress,
  deleteAddress
} = require("../controllers/userController");

const router = express.Router();

router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.put("/change-password", protect, changePassword);

router.post("/address", protect, addAddress);
router.put("/address/:id", protect, updateAddress);
router.delete("/address/:id", protect, deleteAddress);

module.exports = router;

