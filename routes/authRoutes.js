const express = require("express");
const {
  register,
  registerVendor,
  login,
  logout,
  forgotPassword,
  resetPassword
} = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/register-vendor", registerVendor);
router.post("/login", login);
router.get("/logout", logout);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:token", resetPassword);

module.exports = router;

