// src/controllers/categoryController.js
import Category from '../models/Category.js';
import { categoryCreateSchema, categoryUpdateSchema } from '../schemas/categorySchemas.js';

export const list = async (req, res, next) => {
  try {
    const q = req.query.q ? { name: new RegExp(req.query.q, 'i') } : {};
    const items = await Category.find(q).sort('-createdAt');
    res.json(items);
  } catch (e) { next(e); }
};

export const create = async (req, res, next) => {
  try {
    const data = categoryCreateSchema.parse(req.body);
    const item = await Category?.create(data);
    res.status(201).json(item);
  } catch (e) { next(e); }
};

export const update = async (req, res, next) => {
  try {
    const data = categoryUpdateSchema.parse(req.body);
    const item = await Category.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json(item);
  } catch (e) { next(e); }
};

export const remove = async (req, res, next) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { next(e); }
};