const Joi = require("joi");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().min(6).max(128).required(),
  role: Joi.string().valid("customer", "vendor", "admin").default("customer")
});

const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().required()
});

async function register(req, res, next) {
  try {
    const { value, error } = registerSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400);
      throw new Error(error.details.map((d) => d.message).join(", "));
    }

    const existing = await User.findOne({ email: value.email });
    if (existing) {
      res.status(409);
      throw new Error("Email already in use");
    }

    const user = await User.create(value);
    const token = generateToken({ id: user._id.toString(), role: user.role });

    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
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

module.exports = { register, login };

