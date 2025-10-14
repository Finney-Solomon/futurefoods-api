// src/controllers/cartController.js
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
    let cart = await ensureCart(req.user.id);
    const idx = cart.items.findIndex(i => i.product._id.toString() === productId);
    if (idx > -1) cart.items[idx].quantity += quantity; else cart.items.push({ product: productId, quantity });
    await cart.save();
    cart = await cart.populate('items.product');
    res.status(201).json(cart);
  } catch (e) { next(e); }
};

export const updateItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    let cart = await ensureCart(req.user.id);
    const item = cart.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    item.quantity = quantity;
    await cart.save();
    cart = await cart.populate('items.product');
    res.json(cart);
  } catch (e) { next(e); }
};

export const removeItem = async (req, res, next) => {
  try {
    let cart = await ensureCart(req.user.id);
    cart.items = cart.items.filter(i => i._id.toString() !== req.params.itemId);
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