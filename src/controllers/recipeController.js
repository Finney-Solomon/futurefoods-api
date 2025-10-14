import Recipe from "../models/Recipe.js";

const toBool = (v) => v === true || v === "true" || v === 1 || v === "1";
const SORT_WHITELIST = new Set([
  "createdAt", "-createdAt", "updatedAt", "-updatedAt",
  "title", "-title",
  "prepTimeMins", "-prepTimeMins",
  "cookTimeMins", "-cookTimeMins",
]);

export const listRecipes = async (req, res, next) => {
  try {
    const {
      q,
      tag,
      category,
      featured,
      isActive,
      page = 1,
      limit = 12,
      sort = "-createdAt",
    } = req.query;

    const filter = {};
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: "i" } },
        { shortDescription: { $regex: q, $options: "i" } },
        { tags: { $regex: q, $options: "i" } },
      ];
    }
    if (tag) filter.tags = { $in: [tag] };
    if (category) filter.category = category;
    if (featured !== undefined) filter.featured = toBool(featured);
    if (isActive !== undefined) filter.isActive = toBool(isActive);

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Math.min(100, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const sortKey = SORT_WHITELIST.has(sort) ? sort : "-createdAt";

    const [items, total] = await Promise.all([
      Recipe.find(filter)
        .populate("category", "name slug")
        .sort(sortKey)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Recipe.countDocuments(filter),
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

export const getRecipeBySlug = async (req, res, next) => {
  try {
    const item = await Recipe.findOne({ slug: req.params.slug })
      .populate("category", "name slug")
      .lean();
    if (!item) return res.status(404).json({ message: "Recipe not found" });
    res.json(item);
  } catch (e) {
    next(e);
  }
};

export const createRecipe = async (req, res, next) => {
  try {
    const doc = await Recipe.create(req.body);
    res.status(201).json(doc);
  } catch (e) {
    next(e);
  }
};

export const updateRecipe = async (req, res, next) => {
  try {
    const doc = await Recipe.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!doc) return res.status(404).json({ message: "Recipe not found" });
    res.json(doc);
  } catch (e) {
    next(e);
  }
};

export const removeRecipe = async (req, res, next) => {
  try {
    const doc = await Recipe.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: "Recipe not found" });
    res.json({ message: "Deleted" });
  } catch (e) {
    next(e);
  }
};
