const express = require("express");
const { protect, authorize } = require("../middleware/authMiddleware");
const { adminGetUsers, adminGetVendors, adminChangeUserRole } = require("../controllers/userController");

const router = express.Router();

router.get("/users", protect, authorize("admin"), adminGetUsers);
router.get("/vendors", protect, authorize("admin"), adminGetVendors);
router.put("/users/:id/role", protect, authorize("admin"), adminChangeUserRole);

module.exports = router;

