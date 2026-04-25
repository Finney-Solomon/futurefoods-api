# Stripe Webhook Setup Guide

Complete guide for setting up Stripe webhook handling in Express.js

---

## Important: Raw Body Requirement for Webhooks

Stripe webhook verification requires the raw request body. The webhook signature verification will fail if the body is parsed as JSON.

---

## Express Server Configuration

### Using `express.raw()` for Webhook Endpoint

You need to configure Express to handle the webhook endpoint differently from other routes.

**In `src/server.js` or your main server file:**

```javascript
import express from "express";
import orderRoutes from "./routes/orderRoutes.js";

const app = express();

// Middleware for webhook (MUST come before JSON body parser)
app.post(
  "/api/orders/webhook/stripe",
  express.raw({ type: "application/json" }),
  orderRoutes, // The webhook handler is in orderRoutes
);

// Regular JSON parsing for all other routes
app.use(express.json());

// All other routes
app.use("/api/orders", orderRoutes);
app.use("/api/auth", authRoutes);
// ... other routes

export default app;
```

### Why This Order Matters

```
1. Webhook route with express.raw()  ← Stripe sends raw bytes
                ↓
2. All other routes with express.json()  ← Other routes send JSON
```

If you reverse the order, the webhook will fail!

---

## Option 1: Basic Setup (Simple)

If you don't need webhook verification during development:

### 1.1 Update Order Controller

```javascript
export const handleStripeWebhook = async (req, res, next) => {
  try {
    // For testing without verification
    const event = req.body;

    // Handle events
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const order = await Order.findById(paymentIntent.metadata.orderId);
      if (order) {
        order.status = "paid";
        order.paymentStatus = "succeeded";
        await order.save();
      }
    }

    res.json({ received: true });
  } catch (e) {
    next(e);
  }
};
```

### 1.2 Use Stripe CLI

```bash
stripe listen --forward-to localhost:5000/api/orders/webhook/stripe
```

---

## Option 2: Secure Setup (Recommended)

### 2.1 Configure Raw Body on Webhook Route

**Update `src/routes/orderRoutes.js`:**

```javascript
import { Router } from "express";
import express from "express"; // Add this import
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  createOrderFromCart,
  listOrders,
  myOrders,
  createPaymentIntent,
  confirmPayment,
  getPaymentStatus,
  handleStripeWebhook,
} from "../controllers/orderController.js";

const router = Router();

// Webhook MUST use raw body (for signature verification)
router.post(
  "/webhook/stripe",
  express.raw({ type: "application/json" }),
  handleStripeWebhook,
);

// All other routes with auth
router.post("/", auth, createOrderFromCart);
router.get("/", auth, requireRole("admin"), listOrders);
router.get("/myOrders", auth, myOrders);
router.post("/:orderId/payment-intent", auth, createPaymentIntent);
router.post("/:orderId/confirm-payment", auth, confirmPayment);
router.get("/:orderId/payment-status", auth, getPaymentStatus);

export default router;
```

### 2.2 Update Order Controller with Signature Verification

```javascript
export const handleStripeWebhook = async (req, res, next) => {
  try {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn("Webhook secret not configured - skipping verification");
      // For development, you can proceed without verification
      const event =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body;

      return handleWebhookEvent(event, res);
    }

    let event;
    try {
      // req.body must be raw bytes, not parsed JSON
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).json({
        message: `Webhook Error: ${err.message}`,
      });
    }

    // Handle the verified event
    return handleWebhookEvent(event, res);
  } catch (e) {
    next(e);
  }
};

// Extract webhook event handling logic
async function handleWebhookEvent(event, res) {
  try {
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const order = await Order.findById(paymentIntent.metadata.orderId);

      if (order) {
        order.status = "paid";
        order.paymentStatus = "succeeded";
        await order.save();

        // You can send email, trigger fulfillment, etc.
        console.log(`Order ${order._id} marked as paid`);
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object;
      const order = await Order.findById(paymentIntent.metadata.orderId);

      if (order) {
        order.paymentStatus = "failed";
        order.paymentDetails = {
          errorMessage:
            paymentIntent.last_payment_error?.message || "Payment failed",
        };
        await order.save();

        console.log(`Order ${order._id} payment failed`);
      }
    }

    res.json({ received: true });
  } catch (e) {
    console.error("Error handling webhook event:", e);
    res.status(500).json({ message: "Webhook handler error" });
  }
}
```

---

## Setting Up Stripe CLI for Local Testing

### Step 1: Install Stripe CLI

**Windows (PowerShell):**

```powershell
# Using Chocolatey
choco install stripe-cli

# Or download from
https://github.com/stripe/stripe-cli/releases
```

**macOS:**

```bash
brew install stripe/stripe-cli/stripe
```

**Linux:**

```bash
# Download from https://github.com/stripe/stripe-cli/releases
# Then add to PATH
```

### Step 2: Login

```bash
stripe login
```

Browser will open, authorize the app, then you'll see:

```
Your pairing code is: XXXXX
```

### Step 3: Start Webhook Forwarding

Terminal 1 - Forward Stripe webhooks to your local server:

```bash
stripe listen --forward-to localhost:5000/api/orders/webhook/stripe
```

Output:

```
> Getting ready to listen for Stripe events...
> You are viewing events from your Stripe account...
> Your webhook signing secret is: whsec_test_xxxxxxxxxxxxx
```

Copy the `whsec_test_xxx` value and add to `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_test_xxxxxxxxxxxxx
```

### Step 4: Send Test Webhook

Terminal 2 - Trigger a test event:

```bash
stripe trigger payment_intent.succeeded
```

### Step 5: Verify in Your Backend

Check your backend logs. You should see:

```
Order xxxxx marked as paid
```

---

## Full Server Setup Example

### Complete Express Server with Stripe Webhooks

**`src/server.js`:**

```javascript
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { connectDB } from "./config/db.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import blogRoutes from "./routes/blogRoutes.js";
import recipeRoutes from "./routes/recipeRoutes.js";

// Middleware
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

// Connect to database
connectDB();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));

// ⚠️ IMPORTANT: Webhook route MUST come before JSON parser
// and use express.raw() to preserve raw body for signature verification
app.post(
  "/api/orders/webhook/stripe",
  express.raw({ type: "application/json" }),
  async (req, res, next) => {
    // Import inside to avoid circular dependencies
    const { handleStripeWebhook } =
      await import("./controllers/orderController.js");
    handleStripeWebhook(req, res, next);
  },
);

// Body parser (AFTER webhook routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes); // Note: /webhook/stripe handled separately above
app.use("/api/blog", blogRoutes);
app.use("/api/recipes", recipeRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date() });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
```

**`src/index.js`:**

```javascript
import dotenv from "dotenv";
import server from "./server.js";

dotenv.config();

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
```

---

## Testing Webhook Delivery

### Check Webhook Status in Stripe Dashboard

1. Go to https://dashboard.stripe.com/webhooks
2. Select your endpoint
3. View recent deliveries
4. Check if `payment_intent.` events are marked as successful (green checkmark)

### Common Webhook Issues

| Issue                           | Solution                                                |
| ------------------------------- | ------------------------------------------------------- |
| Webhook returning 400           | Check raw body handling - ensure `express.raw()` is set |
| "Signature verification failed" | Verify `STRIPE_WEBHOOK_SECRET` is correct               |
| Endpoint not receiving events   | Check endpoint URL is publicly accessible               |
| Events not triggering           | Verify webhook is enabled in Stripe Dashboard           |

---

## Production Webhook Setup

### 1. Go to Stripe Dashboard

https://dashboard.stripe.com/webhooks

### 2. Add Endpoint

- **URL:** `https://yourdomain.com/api/orders/webhook/stripe`
- **Events:** Select these event types:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`

### 3. Get Webhook Secret

- Copy the signing secret (format: `whsec_live_xxxxx`)
- Add to `.env` as `STRIPE_WEBHOOK_SECRET`

### 4. Update Environment

```env
NODE_ENV=production
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_live_xxxxx
```

### 5. Ensure HTTPS

Webhook must be on HTTPS endpoint in production.

---

## Debugging Webhooks

### Enable Webhook Logging

**In `orderController.js`:**

```javascript
export const handleStripeWebhook = async (req, res, next) => {
  const sig = req.headers["stripe-signature"];
  console.log("Webhook received:", {
    type: req.body.type,
    eventId: req.body.id,
    signature: sig ? "present" : "missing",
  });

  // ... rest of code
};
```

### Check Webhook Logs

**Stripe Dashboard:**

1. Go to Webhooks section
2. Click on your endpoint
3. View logs for each delivery

**Your Application Logs:**

```bash
# Check for webhook-related errors
grep -i webhook server.log
```

---

## Summary

✅ **Setup Checklist:**

- [ ] Add `express.raw()` middleware for `/api/orders/webhook/stripe`
- [ ] Place webhook route BEFORE `express.json()`
- [ ] Set `STRIPE_WEBHOOK_SECRET` in `.env`
- [ ] Use Stripe CLI to test: `stripe listen --forward-to localhost:5000/api/orders/webhook/stripe`
- [ ] Trigger test event: `stripe trigger payment_intent.succeeded`
- [ ] Verify webhook logs show success
- [ ] Update server.js with proper middleware order
- [ ] Test with Stripe Dashboard webhook delivery logs

---

## Need Help?

- Stripe Webhooks Docs: https://stripe.com/docs/webhooks
- Stripe CLI Docs: https://stripe.com/docs/stripe-cli
- Event Types: https://stripe.com/docs/api/events/types
