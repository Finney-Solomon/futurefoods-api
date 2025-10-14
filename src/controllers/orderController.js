// src/controllers/orderController.js
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';

export const createOrderFromCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');
    if (!cart || cart.items.length === 0) return res.status(400).json({ message: 'Cart is empty' });

    const items = cart.items.map(i => ({ product: i.product._id, quantity: i.quantity, pricePaise: i.product.pricePaise }));
    const amountPaise = items.reduce((s, i) => s + i.pricePaise * i.quantity, 0);

    const order = await Order.create({ user: req.user.id, items, amountPaise, status: 'created', address: req.body.address });

    cart.items = []; // clear cart after order
    await cart.save();

    res.status(201).json(order);
  } catch (e) { next(e); }
};

export const listOrders = async (req, res, next) => {
  try {
    const orders = await Order.find().populate('user').sort('-createdAt');
    res.json(orders);
  } catch (e) { next(e); }
};

export const myOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .sort('-createdAt')
      .populate('items.product', 'name imageUrl pricePaise');
    res.json(orders);
  } catch (e) { next(e); }
};