const Joi = require("joi");
const Cart = require("../models/Cart");
const Product = require("../models/Product");

const addItemSchema = Joi.object({
  productId: Joi.string().required(),
  quantity: Joi.number().integer().min(1).default(1),
  attributes: Joi.object().pattern(Joi.string(), Joi.string()).default({})
});

const updateItemSchema = Joi.object({
  quantity: Joi.number().integer().min(1).required()
});

function mapCart(cart) {
  return {
    id: cart._id,
    user: cart.user,
    items: cart.items,
    savedForLater: cart.savedForLater,
    totalAmount: cart.totalAmount,
    updatedAt: cart.updatedAt
  };
}

async function getOrCreateCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [], savedForLater: [] });
  }
  return cart;
}

async function getCart(req, res, next) {
  try {
    const cart = await getOrCreateCart(req.user._id);
    await cart.populate("items.product savedForLater.product");
    res.json({ cart: mapCart(cart) });
  } catch (err) {
    next(err);
  }
}

async function addToCart(req, res, next) {
  try {
    const { value, error } = addItemSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400);
      throw new Error(error.details.map((d) => d.message).join(", "));
    }

    const product = await Product.findById(value.productId);
    if (!product || !product.isActive) {
      res.status(404);
      throw new Error("Product not found");
    }

    const cart = await getOrCreateCart(req.user._id);
    const existing = cart.items.find((i) => i.product.toString() === value.productId);

    if (existing) {
      existing.quantity += value.quantity;
      existing.price = product.price;
      existing.attributes = value.attributes || existing.attributes;
    } else {
      cart.items.push({
        product: product._id,
        quantity: value.quantity,
        price: product.price,
        attributes: value.attributes || {}
      });
    }

    // Remove from saved-for-later if moving back into cart.
    cart.savedForLater = cart.savedForLater.filter((i) => i.product.toString() !== value.productId);

    await cart.save();
    await cart.populate("items.product savedForLater.product");
    res.status(201).json({ cart: mapCart(cart) });
  } catch (err) {
    next(err);
  }
}

async function updateCartItem(req, res, next) {
  try {
    const { value, error } = updateItemSchema.validate(req.body, { abortEarly: false });
    if (error) {
      res.status(400);
      throw new Error(error.details.map((d) => d.message).join(", "));
    }

    const cart = await getOrCreateCart(req.user._id);
    const item = cart.items.id(req.params.itemId);
    if (!item) {
      res.status(404);
      throw new Error("Cart item not found");
    }
    item.quantity = value.quantity;
    await cart.save();
    await cart.populate("items.product savedForLater.product");
    res.json({ cart: mapCart(cart) });
  } catch (err) {
    next(err);
  }
}

async function removeCartItem(req, res, next) {
  try {
    const cart = await getOrCreateCart(req.user._id);
    const item = cart.items.id(req.params.itemId);
    if (!item) {
      res.status(404);
      throw new Error("Cart item not found");
    }
    item.deleteOne();
    await cart.save();
    await cart.populate("items.product savedForLater.product");
    res.json({ cart: mapCart(cart) });
  } catch (err) {
    next(err);
  }
}

async function saveForLater(req, res, next) {
  try {
    const cart = await getOrCreateCart(req.user._id);
    const item = cart.items.id(req.params.itemId);
    if (!item) {
      res.status(404);
      throw new Error("Cart item not found");
    }

    cart.savedForLater.push({
      product: item.product,
      attributes: item.attributes || {}
    });
    item.deleteOne();
    await cart.save();
    await cart.populate("items.product savedForLater.product");
    res.json({ cart: mapCart(cart) });
  } catch (err) {
    next(err);
  }
}

async function moveToCart(req, res, next) {
  try {
    const cart = await getOrCreateCart(req.user._id);
    const item = cart.savedForLater.id(req.params.itemId);
    if (!item) {
      res.status(404);
      throw new Error("Saved item not found");
    }

    const product = await Product.findById(item.product);
    if (!product || !product.isActive) {
      res.status(404);
      throw new Error("Product not available");
    }

    const existing = cart.items.find((i) => i.product.toString() === item.product.toString());
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.items.push({
        product: product._id,
        quantity: 1,
        price: product.price,
        attributes: item.attributes || {}
      });
    }

    item.deleteOne();
    await cart.save();
    await cart.populate("items.product savedForLater.product");
    res.json({ cart: mapCart(cart) });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  saveForLater,
  moveToCart
};

