
import mongoose from "mongoose";

const ImageSchema = new mongoose.Schema(
 { url: { type: String, required: true }, alt: { type: String, default: "" } },
 { _id: false }
);

const BlockSchema = new mongoose.Schema(
 {
  type: {
   type: String,
   enum: ["section", "image", "quote", "list", "html", "markdown"],
   default: "section",
   required: true,
  },
  subheading: { type: String, trim: true },
  body: { type: [String], default: [] },
  image: { type: ImageSchema },
  quote: { type: String, trim: true },
  cite: { type: String, trim: true },
  list: {
   ordered: { type: Boolean, default: false },
   items: { type: [String], default: [] },
  },
  html: { type: String },
  markdown: { type: String },
 },
 { _id: false }
);

const BlogPostSchema = new mongoose.Schema(
 {
  heading: { type: String, required: true, trim: true },
  description: { type: [String], default: [] },
  slug: { type: String, required: true, unique: true, index: true },
  coverImage: { type: String, default: "" },
  content: { type: [BlockSchema], default: [] },
  tags: [{ type: String, index: true }],
  category: { type: String, index: true },
  author: {
   name: { type: String, required: true },
   avatar: { type: String, default: "" },
  },
  status: {
   type: String,
   enum: ["draft", "published"],
   default: "draft",
   index: true,
  },
  publishedAt: { type: Date, index: true },

  mainBlog: { type: Boolean, default: false, index: true },

  // ✅ soft-delete flag
  isActive: { type: Boolean, default: true, index: true },
  inactiveAt: { type: Date },

  seo: { title: String, description: String, ogImage: String },
 },
 { timestamps: true }
);

BlogPostSchema.index({
 heading: "text",
 description: "text",
 "content.subheading": "text",
 "content.body": "text",
 tags: "text",
 category: "text",
});

const BlogPost =
 mongoose.models.BlogPost || mongoose.model("BlogPost", BlogPostSchema);
export default BlogPost;
