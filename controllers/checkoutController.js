const Joi = require("joi");
const mongoose = require("mongoose");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");

const checkoutSchema = Joi.object({
  addressId: Joi.string().required(),
  paymentMethod: Joi.string().valid("cash", "cod", "card", "upi", "netbanking", "wallet", "paypal", "razorpay").required()
});

async function getCheckoutSummary(req, res, next) {
  try {
    const [user, cart] = await Promise.all([
      User.findById(req.user._id).select("addresses"),
      Cart.findOne({ user: req.user._id }).populate("items.product")
    ]);

    if (!cart || cart.items.length === 0) {
      return res.json({
        cart: { items: [], totalAmount: 0 },
        addresses: user?.addresses || [],
        paymentMethods: ["cash", "cod", "card", "upi", "netbanking", "wallet", "paypal", "razorpay"]
      });
    }

    const unavailableItems = cart.items
      .filter((item) => !item.product || !item.product.isActive || item.product.stock < item.quantity)
      .map((item) => ({
        itemId: item._id,
        productId: item.product?._id || item.product,
        reason: !item.product
          ? "Product no longer exists"
          : !item.product.isActive
            ? "Product is inactive"
            : "Insufficient stock"
      }));

    res.json({
      cart,
      addresses: user?.addresses || [],
      paymentMethods: ["cash", "cod", "card", "upi", "netbanking", "wallet", "paypal", "razorpay"],
      unavailableItems
    });
  } catch (err) {
    next(err);
  }
}

async function checkout(req, res, next) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { value, error } = checkoutSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400);
      throw new Error(error.details.map((d) => d.message).join(", "));
    }

    const user = await User.findById(req.user._id).session(session);
    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    const shippingAddress = user.addresses.id(value.addressId);
    if (!shippingAddress) {
      res.status(400);
      throw new Error("Invalid address selected");
    }

    const cart = await Cart.findOne({ user: req.user._id }).populate("items.product").session(session);
    if (!cart || cart.items.length === 0) {
      res.status(400);
      throw new Error("Cart is empty");
    }

    const vendorBuckets = new Map();

    for (const item of cart.items) {
      const product = item.product;
      if (!product || !product.isActive) {
        res.status(400);
        throw new Error("One or more products are unavailable");
      }
      if (product.stock < item.quantity) {
        res.status(400);
        throw new Error(`Insufficient stock for product: ${product.name}`);
      }

      product.stock -= item.quantity;
      await product.save({ session });

      const vendorId = product.vendor.toString();
      if (!vendorBuckets.has(vendorId)) {
        vendorBuckets.set(vendorId, { vendor: product.vendor, items: [], totalAmount: 0 });
      }

      const bucket = vendorBuckets.get(vendorId);
      bucket.items.push({
        product: product._id,
        name: product.name,
        quantity: item.quantity,
        price: item.price,
        attributes: item.attributes || {}
      });
      bucket.totalAmount += item.price * item.quantity;
    }

    const createdOrders = [];
    for (const bucket of vendorBuckets.values()) {
      const order = await Order.create(
        [
          {
            vendor: bucket.vendor,
            user: req.user._id,
            customer: req.user._id,
            items: bucket.items,
            totalAmount: bucket.totalAmount,
            shippingAddress: {
              street: shippingAddress.street,
              city: shippingAddress.city,
              state: shippingAddress.state,
              country: shippingAddress.country,
              zipCode: shippingAddress.zipCode
            },
            paymentMethod: value.paymentMethod,
            paymentStatus: value.paymentMethod === "cash" || value.paymentMethod === "cod" ? "pending" : "paid",
            orderStatus: "pending"
          }
        ],
        { session }
      );
      createdOrders.push(order[0]);
    }

    cart.items = [];
    cart.savedForLater = [];
    await cart.save({ session });

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      orders: createdOrders
    });
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
}

module.exports = {
  checkout,
  getCheckoutSummary
};

