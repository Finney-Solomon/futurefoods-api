// src/models/Recipe.ts
import mongoose from "mongoose";

const recipeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    imageUrl: { type: String },
    shortDescription: { type: String, required: true }, // for cards
    ingredients: [{ type: String }],                    // simple list
    steps: [{ type: String }],                          // simple list
    prepTimeMins: { type: Number, default: 0, min: 0 },
    cookTimeMins: { type: Number, default: 0, min: 0 },
    servings: { type: Number, default: 1, min: 1 },

    tags: [{ type: String, index: true }],
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },

    isActive: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
    author: {
      name: String,
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
  },
  { timestamps: true }
);


recipeSchema.index({ featured: 1, isActive: 1, createdAt: -1 });
recipeSchema.index({ title: "text", shortDescription: "text", tags: "text" });

export default mongoose.model("Recipe", recipeSchema);
