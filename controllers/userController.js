const Joi = require("joi");
const User = require("../models/User");

const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).optional(),
  phone: Joi.string().allow("").optional(),
  avatar: Joi.string().allow("").optional(),
  vendorDetails: Joi.object({
    businessName: Joi.string().allow("").optional(),
    businessAddress: Joi.string().allow("").optional(),
    gstNumber: Joi.string().allow("").optional(),
    description: Joi.string().allow("").optional(),
    approvalStatus: Joi.string().valid("pending", "approved", "rejected").optional()
  }).optional()
}).min(1);

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).max(128).required()
});

const addressSchema = Joi.object({
  street: Joi.string().allow("").optional(),
  city: Joi.string().allow("").optional(),
  state: Joi.string().allow("").optional(),
  country: Joi.string().allow("").optional(),
  zipCode: Joi.string().allow("").optional(),
  isDefault: Joi.boolean().optional()
}).min(1);

function safeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    avatar: user.avatar,
    vendorDetails: user.vendorDetails,
    addresses: user.addresses,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

async function getProfile(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    res.json({ user: safeUser(user) });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { value, error } = updateProfileSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400);
      throw new Error(error.details.map((d) => d.message).join(", "));
    }

    // Prevent non-admins from changing role here.
    if ("role" in value) {
      res.status(400);
      throw new Error("Role cannot be changed here");
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    if (value.name !== undefined) user.name = value.name;
    if (value.phone !== undefined) user.phone = value.phone;
    if (value.avatar !== undefined) user.avatar = value.avatar;

    if (value.vendorDetails && user.role === "vendor") {
      user.vendorDetails = { ...user.vendorDetails.toObject?.(), ...value.vendorDetails };
      // Do not allow vendors to self-approve.
      if (value.vendorDetails.approvalStatus) {
        user.vendorDetails.approvalStatus = user.vendorDetails.approvalStatus;
      }
    }

    await user.save();
    res.json({ user: safeUser(user) });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { value, error } = changePasswordSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400);
      throw new Error(error.details.map((d) => d.message).join(", "));
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    const ok = await user.matchPassword(value.currentPassword);
    if (!ok) {
      res.status(401);
      throw new Error("Current password is incorrect");
    }

    user.password = value.newPassword;
    await user.save();
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    next(err);
  }
}

async function addAddress(req, res, next) {
  try {
    const { value, error } = addressSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400);
      throw new Error(error.details.map((d) => d.message).join(", "));
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    if (value.isDefault) {
      user.addresses.forEach((a) => {
        a.isDefault = false;
      });
    }

    user.addresses.push(value);
    await user.save();
    res.status(201).json({ addresses: user.addresses });
  } catch (err) {
    next(err);
  }
}

async function updateAddress(req, res, next) {
  try {
    const { value, error } = addressSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400);
      throw new Error(error.details.map((d) => d.message).join(", "));
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    const address = user.addresses.id(req.params.id);
    if (!address) {
      res.status(404);
      throw new Error("Address not found");
    }

    if (value.isDefault) {
      user.addresses.forEach((a) => {
        a.isDefault = false;
      });
    }

    Object.keys(value).forEach((k) => {
      address[k] = value[k];
    });

    await user.save();
    res.json({ addresses: user.addresses });
  } catch (err) {
    next(err);
  }
}

async function deleteAddress(req, res, next) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    const address = user.addresses.id(req.params.id);
    if (!address) {
      res.status(404);
      throw new Error("Address not found");
    }

    address.deleteOne();
    await user.save();
    res.json({ addresses: user.addresses });
  } catch (err) {
    next(err);
  }
}

// Admin
const updateRoleSchema = Joi.object({
  role: Joi.string().valid("customer", "vendor", "admin").required()
});

async function adminGetUsers(req, res, next) {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    res.json({ users: users.map(safeUser) });
  } catch (err) {
    next(err);
  }
}

async function adminGetVendors(req, res, next) {
  try {
    const vendors = await User.find({ role: "vendor" }).sort({ createdAt: -1 });
    res.json({ vendors: vendors.map(safeUser) });
  } catch (err) {
    next(err);
  }
}

async function adminChangeUserRole(req, res, next) {
  try {
    const { value, error } = updateRoleSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400);
      throw new Error(error.details.map((d) => d.message).join(", "));
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    user.role = value.role;
    await user.save();
    res.json({ user: safeUser(user) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  addAddress,
  updateAddress,
  deleteAddress,
  adminGetUsers,
  adminGetVendors,
  adminChangeUserRole
};

