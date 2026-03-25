const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const addressSchema = new mongoose.Schema(
  {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String,
    isDefault: { type: Boolean, default: false }
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: {
      type: String,
      enum: ["customer", "vendor", "admin"],
      default: "customer"
    },
    phone: { type: String, default: "" },
    avatar: { type: String, default: "" },

    vendorDetails: {
      businessName: { type: String, default: "" },
      businessAddress: { type: String, default: "" },
      approvalStatus: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending"
      },
      gstNumber: { type: String, default: "" },
      description: { type: String, default: "" }
    },

    addresses: { type: [addressSchema], default: [] },

    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false }
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);

