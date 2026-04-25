import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
 {
  reviewerName: { type: String, required: true, trim: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  title: { type: String, trim: true, default: "" },
  comment: { type: String, required: true, trim: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  imageUrl: { type: String, trim: true, default: "" },
  isVisible: { type: Boolean, default: false, index: true },
  isActive: { type: Boolean, default: true, index: true },
 },
 { timestamps: true }
);

reviewSchema.index({
 reviewerName: "text",
 title: "text",
 comment: "text",
});

export default mongoose.models.Review || mongoose.model("Review", reviewSchema);
