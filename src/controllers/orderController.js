// src/controllers/orderController.js
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import { stripe, STRIPE_CONFIG } from "../config/stripe.js";

const ORDER_STATUSES = ["created", "paid", "shipped", "delivered", "cancelled"];

const parsePagination = (req) => {
  const page = Math.max(Number.parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(
    Math.max(Number.parseInt(req.query.limit || "20", 10), 1),
    100,
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const addTimelineEvent = (order, { status, note, actorType, actorId }) => {
  order.timeline = order.timeline || [];
  order.timeline.push({
    status,
    note,
    actorType,
    actorId,
    at: new Date(),
  });
};

const canViewOrder = (order, reqUser) => {
  if (!order || !reqUser) return false;
  return (
    order.user?.toString() === reqUser.id ||
    reqUser.role === "admin"
  );
};

const getCartSnapshot = async (userId) => {
  const cart = await Cart.findOne({ user: userId }).populate("items.product");
  if (!cart || cart.items.length === 0) {
    return { cart: null, items: [], amountPaise: 0 };
  }

  const items = cart.items
    .filter((i) => i.product)
    .map((i) => ({
      product: i.product._id,
      quantity: i.quantity,
      pricePaise: i.product.pricePaise,
    }));

  const amountPaise = items.reduce((sum, item) => {
    return sum + item.pricePaise * item.quantity;
  }, 0);

  return { cart, items, amountPaise };
};

const ensureValidOrderId = (orderId, res) => {
  if (!orderId || orderId === "undefined") {
    res.status(400).json({ message: "Order ID is required" });
    return false;
  }

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    res.status(400).json({ message: "Invalid order ID" });
    return false;
  }

  return true;
};

const updateOrderToPaid = async (order, paymentIntent) => {
  if (order.status === "paid" && order.paymentStatus === "succeeded") {
    return;
  }

  order.status = "paid";
  order.paymentStatus = "succeeded";
  order.paidAt = new Date();

  if (paymentIntent?.payment_method) {
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(
        paymentIntent.payment_method,
      );
      if (paymentMethod.card) {
        order.paymentDetails = {
          last4: paymentMethod.card.last4,
          brand: paymentMethod.card.brand,
          expMonth: paymentMethod.card.exp_month,
          expYear: paymentMethod.card.exp_year,
        };
      }
      order.stripePaymentMethodId = paymentIntent.payment_method;
    } catch {
      // Keep success path even if payment method lookup fails.
    }
  }

  addTimelineEvent(order, {
    status: "paid",
    note: "Payment confirmed successfully",
    actorType: "stripe",
  });

  await order.save();
};

const revertOrderToPendingCheckout = async (order, note) => {
  if (!order || ["paid", "shipped", "delivered", "cancelled"].includes(order.status)) {
    return;
  }

  order.paymentStatus = "pending";
  order.paymentDetails = {
    ...order.paymentDetails,
    errorMessage: undefined,
  };
  addTimelineEvent(order, {
    status: order.status,
    note,
    actorType: "stripe",
  });
  await order.save();
};

// Create order from cart first, keep it pending until payment succeeds.
export const createOrderFromCart = async (req, res, next) => {
  try {
    const { address } = req.body;
    if (!address) {
      return res
        .status(400)
        .json({ message: "Address is required before creating order" });
    }

    const { cart, items, amountPaise } = await getCartSnapshot(req.user.id);
    if (!cart || items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const order = await Order.create({
      user: req.user.id,
      items,
      amountPaise,
      status: "created",
      address,
      paymentStatus: "pending",
      timeline: [
        {
          status: "created",
          note: "Order created and waiting for payment",
          actorType: "user",
          actorId: req.user.id,
        },
      ],
    });

    cart.items = [];
    await cart.save();

    res.status(201).json({
      orderId: order._id,
      order,
      message: "Order created in pending state. Proceed to payment.",
    });
  } catch (e) {
    next(e);
  }
};

// Create Stripe Payment Intent.
export const createPaymentIntent = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    if (!ensureValidOrderId(orderId, res)) return;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (order.status === "cancelled") {
      return res.status(400).json({ message: "Cancelled orders cannot be paid" });
    }

    if (order.paymentStatus === "succeeded" || order.status === "paid") {
      return res.status(400).json({ message: "Order already paid" });
    }

    if (order.amountPaise < STRIPE_CONFIG.minimumAmount) {
      return res.status(400).json({
        message: `Amount must be at least ${STRIPE_CONFIG.minimumAmount} ${STRIPE_CONFIG.currency}'s smallest unit`,
      });
    }

    let paymentIntent;

    if (order.stripePaymentIntentId) {
      paymentIntent = await stripe.paymentIntents.retrieve(
        order.stripePaymentIntentId,
      );
    } else {
      paymentIntent = await stripe.paymentIntents.create({
        amount: order.amountPaise,
        currency: STRIPE_CONFIG.currency,
        metadata: {
          orderId: order._id.toString(),
          userId: req.user.id,
        },
        description: `Payment for order ${order.orderNumber || order._id}`,
      });

      order.stripePaymentIntentId = paymentIntent.id;
      await order.save();
    }

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: order.amountPaise,
      currency: STRIPE_CONFIG.currency,
      orderId: order._id,
      orderNumber: order.orderNumber,
    });
  } catch (e) {
    next(e);
  }
};

// Create hosted Stripe Checkout Session URL.
export const createCheckoutSession = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    if (!ensureValidOrderId(orderId, res)) return;

    const order = await Order.findById(orderId).populate("items.product");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (order.status === "cancelled") {
      return res.status(400).json({ message: "Cancelled orders cannot be paid" });
    }

    if (order.paymentStatus === "succeeded" || order.status === "paid") {
      return res.status(400).json({ message: "Order already paid" });
    }

    if (order.amountPaise < STRIPE_CONFIG.minimumAmount) {
      return res.status(400).json({
        message: `Amount must be at least ${STRIPE_CONFIG.minimumAmount} ${STRIPE_CONFIG.currency}'s smallest unit`,
      });
    }

    const baseUrl = process.env.FRONTEND_BASE_URL || "http://localhost:5173";
    const successUrl = `${baseUrl}/payment/success?orderId=${order._id}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/payment/cancel?orderId=${order._id}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: req.user.email,
      line_items: order.items.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: STRIPE_CONFIG.currency,
          unit_amount: item.pricePaise,
          product_data: {
            name: item.product?.name || "Product",
          },
        },
      })),
      metadata: {
        orderId: order._id.toString(),
        userId: req.user.id,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    order.paymentStatus = "processing";
    order.stripeCheckoutSessionId = session.id;
    order.checkoutSessionExpiresAt = session.expires_at
      ? new Date(session.expires_at * 1000)
      : undefined;
    if (session.payment_intent && !order.stripePaymentIntentId) {
      order.stripePaymentIntentId = session.payment_intent;
    }
    addTimelineEvent(order, {
      status: order.status,
      note: "Redirected to Stripe hosted checkout",
      actorType: "user",
      actorId: req.user.id,
    });
    await order.save();

    res.json({
      message: "Checkout session created",
      url: session.url,
      checkoutUrl: session.url,
      sessionId: session.id,
      orderId: order._id,
      orderNumber: order.orderNumber,
    });
  } catch (e) {
    next(e);
  }
};

// Confirm payment and update order status.
export const confirmPayment = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { paymentIntentId } = req.body;

    if (!ensureValidOrderId(orderId, res)) return;

    if (!paymentIntentId) {
      return res.status(400).json({ message: "Payment Intent ID is required" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.metadata?.orderId !== order._id.toString()) {
      return res.status(400).json({ message: "Payment does not match this order" });
    }

    if (
      paymentIntent.metadata?.userId &&
      paymentIntent.metadata.userId !== req.user.id
    ) {
      return res.status(403).json({ message: "Payment does not belong to this user" });
    }

    if (paymentIntent.status === "succeeded") {
      await updateOrderToPaid(order, paymentIntent);

      return res.json({
        message: "Order placed successfully",
        order,
        paymentStatus: "succeeded",
      });
    }

    if (paymentIntent.status === "processing") {
      order.paymentStatus = "processing";
      await order.save();

      return res.status(202).json({
        message: "Payment is processing",
        paymentStatus: "processing",
        orderId: order._id,
        orderNumber: order.orderNumber,
      });
    }

    order.paymentStatus = "failed";
    order.paymentDetails = {
      ...order.paymentDetails,
      errorMessage: paymentIntent.last_payment_error?.message || "Payment failed",
    };
    await order.save();

    return res.status(400).json({
      message: "Payment failed",
      paymentStatus: "failed",
      error: paymentIntent.last_payment_error?.message,
    });
  } catch (e) {
    next(e);
  }
};

// Get payment status.
export const getPaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    if (!ensureValidOrderId(orderId, res)) return;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    res.json({
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      amount: order.amountPaise,
      paymentDetails: order.paymentDetails || {},
    });
  } catch (e) {
    next(e);
  }
};

// Get single order (owner or admin).
export const getOrderById = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    if (!ensureValidOrderId(orderId, res)) return;

    const order = await Order.findById(orderId)
      .populate("items.product", "name imageUrl pricePaise")
      .populate("user", "name email role");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!canViewOrder(order, req.user)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    res.json(order);
  } catch (e) {
    next(e);
  }
};

// Cancel current user's order while still pending payment.
export const cancelMyOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body || {};
    if (!ensureValidOrderId(orderId, res)) return;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (order.status === "cancelled") {
      return res.status(400).json({ message: "Order is already cancelled" });
    }

    if (order.status !== "created" || order.paymentStatus === "succeeded") {
      return res.status(400).json({
        message:
          "Only unpaid pending orders can be cancelled by customer. Contact support for paid/shipped orders.",
      });
    }

    order.status = "cancelled";
    order.cancelledAt = new Date();
    order.cancelReason = reason || "Cancelled by customer";
    addTimelineEvent(order, {
      status: "cancelled",
      note: order.cancelReason,
      actorType: "user",
      actorId: req.user.id,
    });
    await order.save();

    res.json({ message: "Order cancelled", order });
  } catch (e) {
    next(e);
  }
};

// Admin: mark order as shipped with required shipping details.
export const markOrderShipped = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const {
      shippingId,
      carrier,
      service,
      trackingUrl,
      estimatedDeliveryAt,
      note,
    } = req.body || {};

    if (!ensureValidOrderId(orderId, res)) return;

    if (!shippingId || !carrier) {
      return res.status(400).json({
        message: "shippingId and carrier are required to mark an order as shipped",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status !== "paid") {
      return res.status(400).json({
        message: "Only paid orders can be marked as shipped",
      });
    }

    order.status = "shipped";
    order.shipping = {
      ...(order.shipping || {}),
      shippingId,
      carrier,
      service: service || order.shipping?.service,
      trackingUrl: trackingUrl || order.shipping?.trackingUrl,
      estimatedDeliveryAt: estimatedDeliveryAt
        ? new Date(estimatedDeliveryAt)
        : order.shipping?.estimatedDeliveryAt,
      shippedAt: new Date(),
      deliveredAt: order.shipping?.deliveredAt,
    };

    addTimelineEvent(order, {
      status: "shipped",
      note: note || `Order shipped via ${carrier}`,
      actorType: "admin",
      actorId: req.user.id,
    });

    await order.save();

    res.json({ message: "Order marked as shipped", order });
  } catch (e) {
    next(e);
  }
};

// Admin: update shipping details after shipment.
export const updateShippingDetails = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { shippingId, carrier, service, trackingUrl, estimatedDeliveryAt, note } =
      req.body || {};

    if (!ensureValidOrderId(orderId, res)) return;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!["shipped", "delivered"].includes(order.status)) {
      return res.status(400).json({
        message: "Shipping details can be updated only for shipped/delivered orders",
      });
    }

    order.shipping = {
      ...(order.shipping || {}),
      shippingId: shippingId || order.shipping?.shippingId,
      carrier: carrier || order.shipping?.carrier,
      service: service || order.shipping?.service,
      trackingUrl: trackingUrl || order.shipping?.trackingUrl,
      estimatedDeliveryAt: estimatedDeliveryAt
        ? new Date(estimatedDeliveryAt)
        : order.shipping?.estimatedDeliveryAt,
      shippedAt: order.shipping?.shippedAt,
      deliveredAt: order.shipping?.deliveredAt,
    };

    addTimelineEvent(order, {
      status: order.status,
      note: note || "Shipping details updated",
      actorType: "admin",
      actorId: req.user.id,
    });

    await order.save();

    res.json({ message: "Shipping details updated", order });
  } catch (e) {
    next(e);
  }
};

// Admin: mark shipped order as delivered.
export const markOrderDelivered = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { note } = req.body || {};
    if (!ensureValidOrderId(orderId, res)) return;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status !== "shipped") {
      return res.status(400).json({
        message: "Only shipped orders can be marked as delivered",
      });
    }

    order.status = "delivered";
    order.shipping = {
      ...(order.shipping || {}),
      deliveredAt: new Date(),
    };

    addTimelineEvent(order, {
      status: "delivered",
      note: note || "Order delivered successfully",
      actorType: "admin",
      actorId: req.user.id,
    });

    await order.save();

    res.json({ message: "Order marked as delivered", order });
  } catch (e) {
    next(e);
  }
};

// Admin: cancel order.
export const adminCancelOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body || {};
    if (!ensureValidOrderId(orderId, res)) return;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status === "cancelled") {
      return res.status(400).json({ message: "Order already cancelled" });
    }

    if (["delivered"].includes(order.status)) {
      return res.status(400).json({
        message: "Delivered orders cannot be cancelled",
      });
    }

    order.status = "cancelled";
    order.cancelledAt = new Date();
    order.cancelReason = reason || "Cancelled by admin";

    addTimelineEvent(order, {
      status: "cancelled",
      note: order.cancelReason,
      actorType: "admin",
      actorId: req.user.id,
    });

    await order.save();

    res.json({ message: "Order cancelled", order });
  } catch (e) {
    next(e);
  }
};

// List all orders (admin) with pagination/filters.
export const listOrders = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const { status, paymentStatus, userId, orderNumber } = req.query;

    const query = {};
    if (status && ORDER_STATUSES.includes(status)) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) query.user = userId;
    if (orderNumber) query.orderNumber = orderNumber;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("user", "name email role")
        .populate("items.product", "name imageUrl pricePaise")
        .sort("-createdAt")
        .skip(skip)
        .limit(limit),
      Order.countDocuments(query),
    ]);

    res.json({
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e) {
    next(e);
  }
};

// Get user's orders.
export const myOrders = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const { status } = req.query;
    const query = { user: req.user.id };
    if (status && ORDER_STATUSES.includes(status)) query.status = status;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort("-createdAt")
        .skip(skip)
        .limit(limit)
        .populate("items.product", "name imageUrl pricePaise"),
      Order.countDocuments(query),
    ]);

    res.json({
      data: orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e) {
    next(e);
  }
};

// Webhook handler for Stripe events.
export const handleStripeWebhook = async (req, res, next) => {
  try {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return res.status(400).json({ message: "Webhook secret not configured" });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody || req.body,
        sig,
        webhookSecret,
      );
    } catch (err) {
      return res.status(400).json({ message: `Webhook Error: ${err.message}` });
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const order = await Order.findById(paymentIntent.metadata?.orderId);
      if (order) {
        await updateOrderToPaid(order, paymentIntent);
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object;
      const order = await Order.findById(paymentIntent.metadata?.orderId);

      if (order) {
        order.paymentStatus = "failed";
        order.paymentDetails = {
          ...order.paymentDetails,
          errorMessage:
            paymentIntent.last_payment_error?.message || "Payment failed",
        };
        addTimelineEvent(order, {
          status: order.status,
          note: order.paymentDetails.errorMessage,
          actorType: "stripe",
        });
        await order.save();
      }
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const order = await Order.findById(session.metadata?.orderId);
      if (order && session.payment_status === "paid") {
        if (session.payment_intent) {
          order.stripePaymentIntentId = session.payment_intent;
        }
        let paymentIntentForCardDetails = { payment_method: null };
        if (session.payment_intent) {
          try {
            paymentIntentForCardDetails = await stripe.paymentIntents.retrieve(
              session.payment_intent,
            );
          } catch {
            paymentIntentForCardDetails = { payment_method: null };
          }
        }
        await updateOrderToPaid(order, paymentIntentForCardDetails);
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      const order = await Order.findById(session.metadata?.orderId);
      if (order) {
        await revertOrderToPendingCheckout(
          order,
          "Checkout session expired before payment completion",
        );
      }
    }

    if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object;
      const order = await Order.findById(session.metadata?.orderId);
      if (order && !["paid", "shipped", "delivered", "cancelled"].includes(order.status)) {
        order.paymentStatus = "failed";
        order.paymentDetails = {
          ...order.paymentDetails,
          errorMessage: "Payment failed or was cancelled during checkout",
        };
        addTimelineEvent(order, {
          status: order.status,
          note: "Stripe reported async payment failure",
          actorType: "stripe",
        });
        await order.save();
      }
    }

    if (event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      const order = await Order.findById(session.metadata?.orderId);
      if (order && session.payment_intent) {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(
            session.payment_intent,
          );
          await updateOrderToPaid(order, paymentIntent);
        } catch {
          await updateOrderToPaid(order, { payment_method: null });
        }
      }
    }

    res.json({ received: true });
  } catch (e) {
    next(e);
  }
};
