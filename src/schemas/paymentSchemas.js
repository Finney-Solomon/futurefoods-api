// src/schemas/paymentSchemas.js
import { z } from "zod";

// Schema for creating payment intent
export const createPaymentIntentSchema = z.object({
  // No body required - orderId comes from params
});

// Schema for confirming payment
export const confirmPaymentSchema = z.object({
  paymentIntentId: z
    .string()
    .min(1, "Payment Intent ID is required")
    .regex(/^pi_/, "Invalid Payment Intent ID format"),
});

// Schema for payment status (GET endpoint, no validation needed)
export const getPaymentStatusSchema = z.object({
  // No body - orderId comes from params
});

// Stripe webhook event schema
export const stripeWebhookSchema = z.object({
  type: z.enum([
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "payment_intent.processing",
  ]),
  data: z.object({
    object: z.object({
      id: z.string(),
      status: z.enum(["succeeded", "failed", "processing", "requires_action"]),
      amount: z.number(),
      currency: z.string(),
      metadata: z
        .object({
          orderId: z.string(),
          userId: z.string(),
        })
        .optional(),
      payment_method: z.string().optional(),
      last_payment_error: z
        .object({
          message: z.string(),
        })
        .optional(),
    }),
  }),
});

// Address schema (used in order creation)
export const addressSchema = z.object({
  line1: z
    .string()
    .min(5, "Address line must be at least 5 characters")
    .max(100, "Address line cannot exceed 100 characters"),
  city: z
    .string()
    .min(2, "City must be at least 2 characters")
    .max(50, "City cannot exceed 50 characters"),
  state: z
    .string()
    .length(2, "State code must be exactly 2 characters")
    .toUpperCase(),
  pin: z.string().regex(/^\d{5}$/, "PIN must be exactly 5 digits"),
  phone: z
    .string()
    .regex(
      /^\+\d{1,3}\d{9,10}$/,
      "Phone must be in format +COUNTRYCODE9DIGITS",
    ),
});

// Create order with address schema
export const createOrderWithAddressSchema = z.object({
  address: addressSchema,
});
