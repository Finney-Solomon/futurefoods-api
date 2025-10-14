// src/controllers/productController.js
import Product from '../models/Product.js';
import { productCreateSchema, productUpdateSchema } from '../schemas/productSchemas.js';

export const list = async (req, res, next) => {
  try {
    const { q, category, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (q) filter.name = new RegExp(q, 'i');
    if (category) filter.category = category;

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Product.find(filter).populate('category').skip(skip).limit(Number(limit)).sort('-createdAt'),
      Product.countDocuments(filter)
    ]);
    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (e) { next(e); }
};

export const getOne = async (req, res, next) => {
  try {
    const item = await Product.findOne({ slug: req.params.slug }).populate('category');
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json(item);
  } catch (e) { next(e); }
};

export const create = async (req, res, next) => {
  try {
    const data = productCreateSchema.parse(req.body);
    const item = await Product.create(data);
    res.status(201).json(item);
  } catch (e) { next(e); }
};

export const update = async (req, res, next) => {
  try {
    const data = productUpdateSchema.parse(req.body);
    const item = await Product.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json(item);
  } catch (e) { next(e); }
};

export const remove = async (req, res, next) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
};