const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    attributes: { type: Map, of: String, default: {} }
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    orderNumber: { type: String, unique: true, index: true },
    items: { type: [orderItemSchema], default: [] },
    totalAmount: { type: Number, required: true, min: 0 },
    shippingAddress: { type: shippingAddressSchema, required: true },
    paymentMethod: {
      type: String,
      enum: ["cash", "cod", "card", "upi", "wallet", "netbanking", "paypal", "razorpay"],
      required: true
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending"
    },
    paymentDetails: {
      transactionId: String,
      paidAt: Date,
      provider: String
    },
    orderStatus: {
      type: String,
      enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
      index: true
    },
    statusHistory: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String
      }
    ],
    trackingNumber: String,
    estimatedDelivery: Date,
    paidAt: { type: Date },
    deliveredAt: { type: Date }
  },
  { timestamps: true }
);

orderSchema.pre("save", async function (next) {
  if (!this.orderNumber) {
    const count = await this.model("Order").countDocuments();
    this.orderNumber = `ORD-${String(count + 1).padStart(6, "0")}`;
  }
  if (!this.customer) {
    this.customer = this.user;
  }
  if (this.isModified("orderStatus")) {
    const last = this.statusHistory[this.statusHistory.length - 1];
    if (!last || last.status !== this.orderStatus) {
      this.statusHistory.push({ status: this.orderStatus });
    }
  }
  next();
});

module.exports = mongoose.model("Order", orderSchema);

