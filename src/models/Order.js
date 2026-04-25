// src/models/Order.js
import mongoose from "mongoose";

const orderEventSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["created", "paid", "shipped", "delivered", "cancelled"],
      required: true,
    },
    note: { type: String, trim: true, maxlength: 500 },
    actorType: {
      type: String,
      enum: ["system", "user", "admin", "stripe"],
      default: "system",
    },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true, sparse: true, index: true },
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
      enum: ["created", "paid", "shipped", "delivered", "cancelled"],
      default: "created",
    },
    address: {
      line1: String,
      city: String,
      state: String,
      pin: String,
      phone: String,
    },
    // Stripe payment fields
    stripePaymentIntentId: {
      type: String,
      sparse: true,
    },
    stripePaymentMethodId: {
      type: String,
      sparse: true,
    },
    stripeCheckoutSessionId: {
      type: String,
      sparse: true,
      index: true,
    },
    checkoutSessionExpiresAt: Date,
    paymentStatus: {
      type: String,
      enum: ["pending", "succeeded", "failed", "processing"],
      default: "pending",
    },
    paymentDetails: {
      last4: String,
      brand: String,
      expMonth: Number,
      expYear: Number,
      errorMessage: String,
    },
    paidAt: Date,
    cancelledAt: Date,
    cancelReason: { type: String, trim: true, maxlength: 500 },
    shipping: {
      shippingId: { type: String, trim: true, index: true },
      carrier: { type: String, trim: true },
      service: { type: String, trim: true },
      trackingUrl: { type: String, trim: true },
      estimatedDeliveryAt: Date,
      shippedAt: Date,
      deliveredAt: Date,
    },
    timeline: [orderEventSchema],
  },
  { timestamps: true },
);

orderSchema.pre("save", function assignOrderNumber(next) {
  if (!this.orderNumber) {
    const ts = Date.now().toString().slice(-6);
    const rand = Math.floor(1000 + Math.random() * 9000);
    this.orderNumber = `FF-${ts}-${rand}`;
  }
  next();
});

export default mongoose.model("Order", orderSchema);
