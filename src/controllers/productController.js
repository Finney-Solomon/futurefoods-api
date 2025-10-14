// src/controllers/productController.js
import Product from "../models/Product.js";
import {
 productCreateSchema,
 productUpdateSchema,
} from "../schemas/productSchemas.js";

const parseBool = (v) => v === true || v === "true" || v === 1 || v === "1";

export const list = async (req, res, next) => {
 try {
  const {
   q,
   category,
   page = 1,
   limit = 20,
   featured, // NEW: e.g., ?featured=true
   isActive, // optional: ?isActive=true
   sort = "-createdAt", // optional: e.g., 'name' | '-pricePaise'
  } = req.query;

  // Whitelist sort fields to avoid injection / invalid keys
  const SORT_WHITELIST = new Set([
   "createdAt",
   "-createdAt",
   "updatedAt",
   "-updatedAt",
   "name",
   "-name",
   "pricePaise",
   "-pricePaise",
   "stock",
   "-stock",
  ]);
  const sortKey = SORT_WHITELIST.has(sort) ? sort : "-createdAt";

  const filter = {};
  if (q) filter.name = { $regex: q, $options: "i" };
  if (category) filter.category = category;
  if (typeof featured !== "undefined")
   filter.featuredProducts = parseBool(featured);
  if (typeof isActive !== "undefined") filter.isActive = parseBool(isActive);

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.max(1, Math.min(100, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
   Product.find(filter)
    .populate("category")
    .sort(sortKey)
    .skip(skip)
    .limit(limitNum)
    .lean(),
   Product.countDocuments(filter),
  ]);

  res.json({
   items,
   total,
   page: pageNum,
   limit: limitNum,
  });
 } catch (e) {
  next(e);
 }
};

export const getOne = async (req, res, next) => {
 try {
  const item = await Product.findOne({ slug: req.params.slug }).populate(
   "category"
  );
  if (!item) return res.status(404).json({ message: "Not found" });
  res.json(item);
 } catch (e) {
  next(e);
 }
};

export const create = async (req, res, next) => {
 try {
  const data = productCreateSchema.parse(req.body);
  const item = await Product.create(data);
  res.status(201).json(item);
 } catch (e) {
  next(e);
 }
};

export const update = async (req, res, next) => {
 try {
  const data = productUpdateSchema.parse(req.body);
  const item = await Product.findByIdAndUpdate(req.params.id, data, {
   new: true,
  });
  res.json(item);
 } catch (e) {
  next(e);
 }
};

export const remove = async (req, res, next) => {
 try {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
 } catch (e) {
  next(e);
 }
};
