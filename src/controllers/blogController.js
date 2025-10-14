// src/controllers/blogController.js
import BlogPost from "../models/BlogPost.js";

// helpers
const toSlug = (s = "") =>
 s
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/(^-|-$)/g, "");

export async function listBlogs(req, res) {
 try {
  const { page = 1, limit = 10, mainBlog, includeInactive } = req.query;

  const filter = {};
  // show only active by default
  if (!includeInactive || includeInactive === "false") filter.isActive = true;

  // only published to public; for admin UI you can pass ?allStatus=true
  if (!req.query.allStatus || req.query.allStatus === "false")
   filter.status = "published";

  if (typeof mainBlog !== "undefined") filter.mainBlog = mainBlog === "true";

  const pageNum = Math.max(parseInt(page), 1);
  const perPage = Math.min(Math.max(parseInt(limit), 1), 50);

  const [items, total] = await Promise.all([
   BlogPost.find(filter)
    .sort({ mainBlog: -1, publishedAt: -1, createdAt: -1 })
    .skip((pageNum - 1) * perPage)
    .limit(perPage)
    .select(
     "heading description slug coverImage mainBlog publishedAt category author status isActive"
    )
    .lean(),
   BlogPost.countDocuments(filter),
  ]);

  res.json({
   items,
   page: pageNum,
   limit: perPage,
   total,
   totalPages: Math.ceil(total / perPage),
  });
 } catch (e) {
  console.error(e);
  res.status(500).json({ message: "Error fetching blogs" });
 }
}

export async function getFeatured(req, res) {
 try {
  const blog = await BlogPost.findOne({
   mainBlog: true,
   isActive: true,
   status: "published",
  })
   .sort({ publishedAt: -1 })
   .lean();
  if (!blog) return res.status(404).json({ message: "No featured blog found" });
  res.json(blog);
 } catch (e) {
  res.status(500).json({ message: "Error fetching featured blog" });
 }
}

export async function getBySlug(req, res) {
 try {
  const post = await BlogPost.findOne({
   slug: req.params.slug,
   isActive: true,
   status: "published",
  }).lean();
  if (!post) return res.status(404).json({ message: "Blog not found" });
  res.json(post);
 } catch (e) {
  res.status(500).json({ message: "Error fetching blog" });
 }
}

export async function createBlog(req, res) {
 try {
  const data = req.body;

  if (!data.slug) data.slug = toSlug(data.heading || "");
  if (data.status === "published" && !data.publishedAt) {
   data.publishedAt = new Date();
  }

  // if mainBlog true, unset others
  if (data.mainBlog === true) {
   await BlogPost.updateMany({ mainBlog: true }, { $set: { mainBlog: false } });
  }

  const post = await BlogPost.create(data);
  res.status(201).json(post);
 } catch (e) {
  console.error(e);
  // duplicate slug handling
  if (e.code === 11000 && e.keyPattern?.slug) {
   return res.status(409).json({ message: "Slug already exists" });
  }
  res.status(500).json({ message: "Error creating blog" });
 }
}

export async function updateBlog(req, res) {
 try {
  const data = req.body;
  const { id } = req.params;

  if (data.heading && !data.slug) data.slug = toSlug(data.heading);
  if (data.status === "published" && !data.publishedAt)
   data.publishedAt = new Date();

  // if setting mainBlog true, unset others
  if (data.mainBlog === true) {
   await BlogPost.updateMany(
    { _id: { $ne: id }, mainBlog: true },
    { $set: { mainBlog: false } }
   );
  }

  const post = await BlogPost.findByIdAndUpdate(id, data, { new: true });
  if (!post) return res.status(404).json({ message: "Blog not found" });
  res.json(post);
 } catch (e) {
  console.error(e);
  res.status(500).json({ message: "Error updating blog" });
 }
}

export async function softDeleteBlog(req, res) {
 try {
  const { id } = req.params;
  const post = await BlogPost.findByIdAndUpdate(
   id,
   { $set: { isActive: false, inactiveAt: new Date(), mainBlog: false } },
   { new: true }
  );
  if (!post) return res.status(404).json({ message: "Blog not found" });
  res.json({ message: "Blog marked inactive", post });
 } catch (e) {
  console.error(e);
  res.status(500).json({ message: "Error deleting blog" });
 }
}

// (optional) restore inactive
export async function restoreBlog(req, res) {
 try {
  const { id } = req.params;
  const post = await BlogPost.findByIdAndUpdate(
   id,
   { $set: { isActive: true }, $unset: { inactiveAt: 1 } },
   { new: true }
  );
  if (!post) return res.status(404).json({ message: "Blog not found" });
  res.json({ message: "Blog restored", post });
 } catch (e) {
  res.status(500).json({ message: "Error restoring blog" });
 }
}
