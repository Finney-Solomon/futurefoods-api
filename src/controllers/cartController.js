import mongoose from 'mongoose';
import Cart from '../models/Cart.js';

const ensureCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId }).populate('items.product');
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
};

export const getCart = async (req, res, next) => {
  try {
    const cart = await ensureCart(req.user.id);
    res.json(cart);
  } catch (e) { next(e); }
};

export const addItem = async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body;
    console.log(req.body,"req.bodyreq.body")

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Valid productId is required' });
    }
    if (typeof quantity !== 'number' || Number.isNaN(quantity) || quantity < 1) {
      return res.status(400).json({ message: 'quantity must be a number >= 1' });
    }

    let cart = await ensureCart(req.user.id);

    const idx = cart.items.findIndex(i => String(i.product?._id || i.product) === String(productId));
    if (idx > -1) {
      cart.items[idx].quantity += quantity;
    } else {
      cart.items.push({
        // _id auto-created by schema; explicit is optional:
        // _id: new mongoose.Types.ObjectId(),
        product: productId,
        quantity,
      });
    }

    await cart.save();
    cart = await cart.populate('items.product');
    res.status(201).json(cart);
  } catch (e) { next(e); }
};

export const updateItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    if (typeof quantity !== 'number' || Number.isNaN(quantity)) {
      return res.status(400).json({ message: 'quantity must be a number' });
    }

    let cart = await ensureCart(req.user.id);
    const item = cart.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    if (quantity <= 0) {
      // Remove on <= 0 (or return 400 if you prefer strict behavior)
      item.deleteOne();
      // return res.status(400).json({ message: 'quantity must be >= 1' });
    } else {
      item.quantity = quantity;
    }

    await cart.save();
    cart = await cart.populate('items.product');
    res.json(cart);
  } catch (e) { next(e); }
};

export const removeItem = async (req, res, next) => {
  try {
    let cart = await ensureCart(req.user.id);
    const item = cart.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    item.deleteOne(); // safer than filtering by string compare
    await cart.save();
    cart = await cart.populate('items.product');
    res.json(cart);
  } catch (e) { next(e); }
};

export const clearCart = async (req, res, next) => {
  try {
    let cart = await ensureCart(req.user.id);
    cart.items = [];
    await cart.save();
    res.json(cart);
  } catch (e) { next(e); }
};
