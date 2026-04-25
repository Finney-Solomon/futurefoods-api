// src/config/stripe.js
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const STRIPE_CONFIG = {
  currency: (process.env.STRIPE_CURRENCY || "sek").toLowerCase(),
  minimumAmount: Number(process.env.STRIPE_MIN_AMOUNT || 300),
  payment_method_types: ["card"],
};

export default stripe;
