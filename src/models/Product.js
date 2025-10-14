// src/models/Product.js
import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
 {
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  category: {
   type: mongoose.Schema.Types.ObjectId,
   ref: "Category",
   required: true,
  },
  pricePaise: { type: Number, required: true, min: 0 },
  imageUrl: String,
  isActive: { type: Boolean, default: true },
  stock: { type: Number, default: 100 },
  description: { type: String, required: true },
  featuredProducts: { type: Boolean, default: false },
 },
 { timestamps: true }
);

export default mongoose.model("Product", productSchema);
