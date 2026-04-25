import Review from "../models/Review.js";
import {
 reviewCreateSchema,
 reviewUpdateSchema,
 userReviewCreateSchema,
} from "../schemas/reviewSchemas.js";

const parseBool = (value) =>
 value === true || value === "true" || value === 1 || value === "1";

const parseSort = (sort) => {
 const allowed = new Set([
  "createdAt",
  "-createdAt",
  "updatedAt",
  "-updatedAt",
  "rating",
  "-rating",
 ]);

 return allowed.has(sort) ? sort : "-createdAt";
};

export const listReviews = async (req, res, next) => {
 try {
  const {
   page = 1,
   limit = 20,
   q,
   isVisible,
   isActive,
   sort = "-createdAt",
  } = req.query;

  const filter = {};
  const isAdminView = req.adminView === true;

  if (!isAdminView) {
   filter.isVisible = true;
   filter.isActive = true;
  } else {
   if (typeof isVisible !== "undefined") filter.isVisible = parseBool(isVisible);
   if (typeof isActive !== "undefined") filter.isActive = parseBool(isActive);
  }

  if (q) filter.$text = { $search: q };

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.max(1, Math.min(100, Number(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
   Review.find(filter)
    .sort(parseSort(sort))
    .skip(skip)
    .limit(limitNum)
    .lean(),
   Review.countDocuments(filter),
  ]);

  res.json({
   items,
   total,
   page: pageNum,
   limit: limitNum,
   totalPages: Math.ceil(total / limitNum),
  });
 } catch (e) {
  next(e);
 }
};

export const getReview = async (req, res, next) => {
 try {
  const filter = { _id: req.params.id };
  if (req.adminView !== true) {
   filter.isVisible = true;
   filter.isActive = true;
  }

  const item = await Review.findOne(filter).lean();
  if (!item) return res.status(404).json({ message: "Review not found" });
  res.json(item);
 } catch (e) {
  next(e);
 }
};

export const createReview = async (req, res, next) => {
 try {
  const data = userReviewCreateSchema.parse(req.body);
  const item = await Review.create({
   ...data,
   user: req.user.id,
   isVisible: false,
   isActive: true,
  });
  res.status(201).json(item);
 } catch (e) {
  next(e);
 }
};

export const createReviewByAdmin = async (req, res, next) => {
 try {
  const data = reviewCreateSchema.parse(req.body);
  const item = await Review.create(data);
  res.status(201).json(item);
 } catch (e) {
  next(e);
 }
};

export const updateReview = async (req, res, next) => {
 try {
  const data = reviewUpdateSchema.parse(req.body);
  const item = await Review.findByIdAndUpdate(req.params.id, data, {
   new: true,
   runValidators: true,
  });

  if (!item) return res.status(404).json({ message: "Review not found" });
  res.json(item);
 } catch (e) {
  next(e);
 }
};

export const updateReviewVisibility = async (req, res, next) => {
 try {
  const data = reviewUpdateSchema
   .pick({ isVisible: true, isActive: true })
   .parse(req.body);

  const item = await Review.findByIdAndUpdate(req.params.id, data, {
   new: true,
   runValidators: true,
  });

  if (!item) return res.status(404).json({ message: "Review not found" });
  res.json(item);
 } catch (e) {
  next(e);
 }
};

export const removeReview = async (req, res, next) => {
 try {
  const item = await Review.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ message: "Review not found" });
  res.json({ ok: true });
 } catch (e) {
  next(e);
 }
};
