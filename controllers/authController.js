const Joi = require("joi");
const crypto = require("crypto");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");

const registerCustomerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().min(6).max(128).required(),
  phone: Joi.string().allow("").optional(),
  avatar: Joi.string().allow("").optional()
});

const registerVendorSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().min(6).max(128).required(),
  phone: Joi.string().allow("").optional(),
  avatar: Joi.string().allow("").optional(),
  vendorDetails: Joi.object({
    businessName: Joi.string().allow("").optional(),
    businessAddress: Joi.string().allow("").optional(),
    gstNumber: Joi.string().allow("").optional(),
    description: Joi.string().allow("").optional()
  }).default({})
});

const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().required()
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required()
});

const resetPasswordSchema = Joi.object({
  password: Joi.string().min(6).max(128).required()
});

async function register(req, res, next) {
  try {
    const { value, error } = registerCustomerSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400);
      throw new Error(error.details.map((d) => d.message).join(", "));
    }

    const existing = await User.findOne({ email: value.email });
    if (existing) {
      res.status(409);
      throw new Error("Email already in use");
    }

    const user = await User.create({ ...value, role: "customer" });
    const token = generateToken({ id: user._id.toString(), role: user.role });

    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      token
    });
  } catch (err) {
    next(err);
  }
}

async function registerVendor(req, res, next) {
  try {
    const { value, error } = registerVendorSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400);
      throw new Error(error.details.map((d) => d.message).join(", "));
    }

    const existing = await User.findOne({ email: value.email });
    if (existing) {
      res.status(409);
      throw new Error("Email already in use");
    }

    const user = await User.create({
      ...value,
      role: "vendor",
      vendorDetails: {
        ...value.vendorDetails,
        approvalStatus: "pending"
      }
    });

    const token = generateToken({ id: user._id.toString(), role: user.role });

    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role, vendorDetails: user.vendorDetails },
      token
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { value, error } = loginSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400);
      throw new Error(error.details.map((d) => d.message).join(", "));
    }

    const user = await User.findOne({ email: value.email }).select("+password");
    if (!user) {
      res.status(401);
      throw new Error("Invalid credentials");
    }

    const ok = await user.matchPassword(value.password);
    if (!ok) {
      res.status(401);
      throw new Error("Invalid credentials");
    }

    const token = generateToken({ id: user._id.toString(), role: user.role });
    res.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
      token
    });
  } catch (err) {
    next(err);
  }
}

function logout(req, res) {
  // JWT is stateless; client should delete token.
  res.json({ message: "Logged out" });
}

async function forgotPassword(req, res, next) {
  try {
    const { value, error } = forgotPasswordSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400);
      throw new Error(error.details.map((d) => d.message).join(", "));
    }

    const user = await User.findOne({ email: value.email });

    // Always return 200 to avoid leaking which emails exist.
    if (!user) {
      return res.json({ message: "If the email exists, a reset link will be sent." });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashed = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = hashed;
    user.resetPasswordExpire = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save({ validateBeforeSave: false });

    // No email service wired yet; return token for now.
    res.json({
      message: "Password reset token generated",
      resetToken,
      expiresInMinutes: 15
    });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { value, error } = resetPasswordSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400);
      throw new Error(error.details.map((d) => d.message).join(", "));
    }

    const token = req.params.token;
    const hashed = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashed,
      resetPasswordExpire: { $gt: new Date() }
    }).select("+resetPasswordToken +resetPasswordExpire");

    if (!user) {
      res.status(400);
      throw new Error("Invalid or expired reset token");
    }

    user.password = value.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    const jwtToken = generateToken({ id: user._id.toString(), role: user.role });
    res.json({ message: "Password reset successful", token: jwtToken });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, registerVendor, login, logout, forgotPassword, resetPassword };

