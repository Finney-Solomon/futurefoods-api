// src/models/Order.js
import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
 {
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  items: [
   {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    quantity: Number,
    pricePaise: Number,
   },
  ],
  amountPaise: Number,
  status: {
   type: String,
   enum: ["created", "paid", "shipped", "delivered", "`cancelled`"],
   default: "created",
  },
  address: {
   line1: String,
   city: String,
   state: String,
   pin: String,
   phone: String,
  },
 },
 { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
