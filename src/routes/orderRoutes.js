// src/routes/orderRoutes.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  createOrderFromCart,
  listOrders,
  myOrders,
  getOrderById,
  cancelMyOrder,
  createPaymentIntent,
  createCheckoutSession,
  confirmPayment,
  getPaymentStatus,
  markOrderShipped,
  updateShippingDetails,
  markOrderDelivered,
  adminCancelOrder,
  handleStripeWebhook,
} from "../controllers/orderController.js";

const router = Router();

// Order endpoints
router.post("/", auth, createOrderFromCart); // Create order from cart
router.get("/", auth, requireRole("admin"), listOrders); // Get all orders (admin only)
router.get("/myOrders", auth, myOrders); // Get user's orders
router.get("/:orderId", auth, getOrderById); // Get single order (owner/admin)
router.patch("/:orderId/cancel", auth, cancelMyOrder); // Cancel own pending order

// Payment endpoints
router.post("/:orderId/payment-intent", auth, createPaymentIntent); // Create payment intent
router.post("/:orderId/checkout-session", auth, createCheckoutSession); // Create hosted Stripe Checkout session
router.post("/:orderId/confirm-payment", auth, confirmPayment); // Confirm payment
router.get("/:orderId/payment-status", auth, getPaymentStatus); // Get payment status

// Admin order lifecycle endpoints
router.patch("/:orderId/ship", auth, requireRole("admin"), markOrderShipped); // Mark order as shipped
router.patch(
  "/:orderId/shipping",
  auth,
  requireRole("admin"),
  updateShippingDetails,
); // Update shipping details
router.patch(
  "/:orderId/deliver",
  auth,
  requireRole("admin"),
  markOrderDelivered,
); // Mark order as delivered
router.patch(
  "/:orderId/admin-cancel",
  auth,
  requireRole("admin"),
  adminCancelOrder,
); // Cancel order as admin

// Webhook (no auth needed)
router.post("/webhook/stripe", handleStripeWebhook);

export default router;
