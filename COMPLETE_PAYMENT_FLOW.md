# Stripe Payment Integration - Complete End-to-End Flow

## Overview

This document explains the complete payment flow for Future Foods API with Stripe integration.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React/Vue)                      │
│  - Product Browsing                                           │
│  - Cart Management                                            │
│  - Stripe.js Integration                                      │
│  - Card Collection                                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP Requests
                     │
┌────────────────────▼────────────────────────────────────────┐
│              EXPRESS.JS BACKEND API                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Order Controller                                       │   │
│  │ - Create Order                                         │   │
│  │ - Create Payment Intent                                │   │
│  │ - Confirm Payment                                      │   │
│  │ - Check Status                                         │   │
│  │ - Webhook Handler                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Database (MongoDB)                                     │   │
│  │ - Order with Stripe fields                             │   │
│  │ - User Cart                                            │   │
│  │ - Product Details                                      │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Stripe API Calls
                     │
┌────────────────────▼────────────────────────────────────────┐
│                  STRIPE SERVERS                              │
│  - Payment Processing                                        │
│  - Card Validation                                           │
│  - Payment Intent Management                                 │
│  - Webhook Notifications                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Payment Flow

### Phase 1: Order Preparation

#### 1.1 User adds items to cart

**Frontend Action:**

```javascript
// Add product to cart
POST /api/cart
{
  "productId": "product_123",
  "quantity": 2
}
```

#### 1.2 User views checkout

**Frontend Action:**

- Display cart items with total price
- Collect shipping address
- Show Stripe payment element

---

### Phase 2: Order Creation

#### 2.1 Create order from cart

**Frontend Action:**

```javascript
const response = await fetch("/api/orders", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    address: {
      line1: "123 Main St",
      city: "New York",
      state: "NY",
      pin: "10001",
      phone: "+1234567890",
    },
  }),
});

const { order } = await response.json();
const orderId = order._id;
```

**Backend Response:**

```json
{
  "order": {
    "_id": "order_507f1f77bcf86cd799439011",
    "user": "user_507f1f77bcf86cd799439012",
    "items": [
      {
        "product": "product_507f1f77bcf86cd799439013",
        "quantity": 2,
        "pricePaise": 2500
      }
    ],
    "amountPaise": 5000,
    "status": "created",
    "paymentStatus": "pending",
    "address": {...},
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "message": "Order created. Proceed to payment."
}
```

**Database State After:**

```
Order Document:
├── _id: "order_507f1f77bcf86cd799439011"
├── status: "created"
├── paymentStatus: "pending"
├── stripePaymentIntentId: null
├── items: [...]
└── address: {...}
```

---

### Phase 3: Payment Intent Creation

#### 3.1 Request payment intent from backend

**Frontend Action:**

```javascript
// Step 1: Create payment intent on backend
const response = await fetch(`/api/orders/${orderId}/payment-intent`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
});

const { clientSecret, paymentIntentId, amount } = await response.json();
```

**Backend Action:**

1. Validate order exists and belongs to user
2. Check if payment already completed
3. Create or retrieve Stripe Payment Intent

```javascript
// Backend code
const paymentIntent = await stripe.paymentIntents.create({
  amount: order.amountPaise, // In paise (5000 = ₹50)
  currency: "inr",
  metadata: {
    orderId: order._id.toString(),
    userId: req.user.id,
  },
});

// Save to order
order.stripePaymentIntentId = paymentIntent.id;
await order.save();
```

**Backend Response:**

```json
{
  "clientSecret": "pi_xxxxx_secret_yyyyy",
  "paymentIntentId": "pi_xxxxx",
  "amount": 5000,
  "orderId": "order_507f1f77bcf86cd799439011"
}
```

**Database State After:**

```
Order Document:
├── _id: "order_507f1f77bcf86cd799439011"
├── status: "created"
├── paymentStatus: "pending"
├── stripePaymentIntentId: "pi_xxxxx"  ← NEW
├── items: [...]
└── address: {...}
```

---

### Phase 4: Card Collection & Payment

#### 4.1 Collect card details on frontend using Stripe.js

**Frontend Code Example:**

```javascript
// Import Stripe
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe("pk_test_xxxxx"); // Publishable key

// Inside checkout component
const stripe = useStripe();
const elements = useElements();
const cardElement = elements.getElement(CardElement);

// Handle payment
const handlePayment = async () => {
  if (!stripe || !elements) return;

  // Confirm the payment
  const { error, paymentIntent } = await stripe.confirmCardPayment(
    clientSecret,
    {
      payment_method: {
        card: cardElement,
        billing_details: {
          name: "John Doe",
          email: "john@example.com",
        },
      },
    },
  );

  if (error) {
    console.error("Payment failed:", error.message);
    // Show error to user
  } else if (paymentIntent.status === "succeeded") {
    // Payment successful, send to backend for confirmation
    return paymentIntent.id;
  }
};
```

**What Happens on Stripe:**

1. Card is tokenized on Stripe servers
2. Card is NOT sent to your backend
3. Only payment intent is updated
4. Stripe returns confirmation status

---

### Phase 5: Payment Confirmation

#### 5.1 Send payment confirmation to backend

**Frontend Action:**

```javascript
// After successful card payment from Stripe
const response = await fetch(`/api/orders/${orderId}/confirm-payment`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    paymentIntentId: paymentIntent.id,
  }),
});

const result = await response.json();

if (result.paymentStatus === "succeeded") {
  // Show success message
  // Redirect to order confirmation page
}
```

#### 5.2 Backend verifies payment with Stripe

**Backend Action:**

```javascript
// Retrieve payment intent from Stripe
const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

// Check payment status
if (paymentIntent.status === "succeeded") {
  // Update order
  order.status = "paid";
  order.paymentStatus = "succeeded";

  // Extract payment method details
  const paymentMethod = await stripe.paymentMethods.retrieve(
    paymentIntent.payment_method,
  );

  order.paymentDetails = {
    last4: paymentMethod.card.last4,
    brand: paymentMethod.card.brand,
    expMonth: paymentMethod.card.exp_month,
    expYear: paymentMethod.card.exp_year,
  };

  await order.save();
}
```

**Backend Response (Success):**

```json
{
  "message": "Payment successful",
  "order": {
    "_id": "order_507f1f77bcf86cd799439011",
    "status": "paid",
    "paymentStatus": "succeeded",
    "paymentDetails": {
      "last4": "4242",
      "brand": "visa",
      "expMonth": 12,
      "expYear": 2025
    }
  }
}
```

**Database State After (Success):**

```
Order Document:
├── _id: "order_507f1f77bcf86cd799439011"
├── status: "paid"  ← CHANGED
├── paymentStatus: "succeeded"  ← CHANGED
├── stripePaymentIntentId: "pi_xxxxx"
├── stripePaymentMethodId: "pm_xxxxx"  ← NEW
├── paymentDetails: {  ← NEW
│   └── last4: "4242",
│       brand: "visa",
│       expMonth: 12,
│       expYear: 2025
│   }
├── items: [...]
└── address: {...}
```

---

### Phase 6: Webhook Verification (Asynchronous)

While the frontend and backend are confirming payment, Stripe also sends a webhook event:

#### 6.1 Stripe sends webhook event

**Stripe Event:**

```json
{
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_xxxxx",
      "status": "succeeded",
      "metadata": {
        "orderId": "order_507f1f77bcf86cd799439011",
        "userId": "user_507f1f77bcf86cd799439012"
      }
    }
  }
}
```

#### 6.2 Backend webhook handler

**Backend Action:**

```javascript
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const event = stripe.webhooks.constructEvent(
    req.rawBody,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET,
  );

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    const order = await Order.findById(paymentIntent.metadata.orderId);

    // Update order (redundant safety check)
    order.status = "paid";
    order.paymentStatus = "succeeded";
    await order.save();

    // Send confirmation email, etc.
  }

  res.json({ received: true });
};
```

---

## Status Codes & Scenarios

### Scenario 1: Successful Payment

```
Timeline:
T0:   User clicks "Pay Now"
T1:   Frontend: POST /api/orders → orderId
T2:   Frontend: POST /api/orders/:orderId/payment-intent → clientSecret
T3:   Stripe: Card validated and tokenized
T4:   Frontend: Sends card confirmation
T5:   Backend: POST /api/orders/:orderId/confirm-payment
T6:   Backend: Verifies with Stripe (status = succeeded)
T7:   Backend: Updates order (status = paid, paymentStatus = succeeded)
T8:   Stripe: Sends webhook event (payment_intent.succeeded)
T9:   Backend: Webhook handler confirms order
T10:  Frontend: Shows success message
T11:  User: Order confirmation page
```

**Response Status: 200 OK**

---

### Scenario 2: Failed Payment (Declined Card)

```
Timeline:
T0-T4: Same as scenario 1
T5:    Stripe: Card declined
T6:    Backend: Confirms with Stripe (status = requires_action)
T7:    Backend: Updates order (paymentStatus = failed)
T8:    Stripe: Sends webhook (payment_intent.payment_failed)
T9:    Frontend: Shows error message
T10:   User: Can retry with different card
```

**Response Status: 400 Bad Request**

**Response Body:**

```json
{
  "message": "Payment failed",
  "paymentStatus": "failed",
  "error": "Your card was declined"
}
```

---

### Scenario 3: Processing Payment

```
Timeline:
T0-T4: Same as scenario 1
T5:    Stripe: Payment requires 3D Secure verification
T6:    Backend: Confirms with Stripe (status = processing)
T7:    Backend: Updates order (paymentStatus = processing)
T8:    Frontend: Shows "Processing..." message
T9:    Later: Webhook triggers when verification complete
```

**Response Status: 202 Accepted**

**Response Body:**

```json
{
  "message": "Payment is processing",
  "paymentStatus": "processing",
  "orderId": "order_507f1f77bcf86cd799439011"
}
```

---

## Data Flow Diagram

```
FRONTEND                          BACKEND                        STRIPE

Register/Login
     │
     └──────────────────────────→ Verify credentials
                                  ↓
                          Return JWT token
     │←──────────────────────────┘

Add to Cart
(Local storage)

Checkout Page
     │
     ├──────────────────────────→ POST /orders
     │                            with address
     │                            ↓
     │                          Create order
     │                          (status: created)
     │                            ↓
     │         orderId ←───────────┘
     │
     ├──────────────────────────→ POST /orders/:id/payment-intent
     │                            ↓
     │                          stripe.paymentIntents.create()
     │                            ↓
     │                             ↓──────────────────→ Create Payment Intent
     │                             │                    Generate clientSecret
     │         clientSecret ←──────┘←──────────────────┘
     │
     Collect Card Details
     ├───────────────────────────────────────────────→ stripe.confirmCardPayment()
     │                                                  ↓
     │                                            Tokenize card
     │                                            Charge payment
     │         success ←─────────────────────────────┘
     │
     ├──────────────────────────→ POST /orders/:id/confirm-payment
     │                            with paymentIntentId
     │                            ↓
     │                          stripe.paymentIntents.retrieve()
     │                            ↓
     │                     Verify with Stripe ↔ stripe.paymentIntents
     │                            ↓
     │                          Update order
     │                          (status: paid)
     │         order ←─────────────┘
     │
     ├──────────────────────────→ (Asynchronous)
     │                          ↓
     │                    ← Webhook from Stripe
     │                          ↓
     │                    Double-check payment
     │                    Send confirmation email

Show Success
Order Confirmation Page
```

---

## API Response Summary

| Endpoint                      | Method | Status | When                | Response          |
| ----------------------------- | ------ | ------ | ------------------- | ----------------- |
| `/orders`                     | POST   | 201    | Order created       | Order object      |
| `/orders/:id/payment-intent`  | POST   | 200    | Intent created      | clientSecret      |
| `/orders/:id/confirm-payment` | POST   | 200    | Payment succeeded   | Updated order     |
| `/orders/:id/confirm-payment` | POST   | 202    | Payment processing  | Processing status |
| `/orders/:id/confirm-payment` | POST   | 400    | Payment failed      | Error message     |
| `/orders/:id/payment-status`  | GET    | 200    | Check status        | Current status    |
| `/orders`                     | GET    | 200    | Admin retrieves all | All orders        |
| `/orders/myOrders`            | GET    | 200    | User retrieves own  | User's orders     |

---

## Error Handling

### Common Errors & Solutions

1. **"Invalid API Key"**
   - Check STRIPE_SECRET_KEY in .env
   - Use test key for development

2. **"Webhook secret not configured"**
   - Add STRIPE_WEBHOOK_SECRET to .env
   - Get from Stripe CLI or Dashboard

3. **"Order not found"**
   - Verify orderId is correct
   - Check order belongs to authenticated user

4. **"Cart is empty"**
   - Add items to cart before creating order
   - Use POST /cart endpoint

5. **"Card declined"**
   - Try test card: 4242424242424242
   - Check card expiry date

---

## Security Considerations

### What's Safe ✅

- Storing stripePaymentIntentId (public)
- Storing last4 digits of card
- Storing order status and payment status
- Storing webhook events

### What's NOT Safe ❌

- Never store full card numbers
- Never send card data to backend
- Never log payment secrets
- Never expose STRIPE_SECRET_KEY to frontend

### Best Practices

1. Use STRIPE_PUBLISHABLE_KEY in frontend only
2. Use STRIPE_SECRET_KEY in backend only
3. Verify webhook signatures
4. Validate amounts server-side
5. Never trust client-side payment status
6. Always verify with Stripe API

---

## Testing Checklist

- [ ] Set up Stripe test keys in .env
- [ ] Install npm packages: `npm install`
- [ ] Start backend: `npm run dev`
- [ ] Register a test user
- [ ] Add product to cart
- [ ] Create order
- [ ] Get payment intent
- [ ] Use test card: 4242424242424242
- [ ] Confirm payment
- [ ] Check order status
- [ ] Verify webhook (using Stripe CLI)
- [ ] Test with declined card: 4000000000000002
- [ ] Test with other cards (Amex, Mastercard)

---

## Deployment Checklist

- [ ] Switch to Stripe LIVE keys
- [ ] Update STRIPE*SECRET_KEY (sk_live*...)
- [ ] Update STRIPE*PUBLISHABLE_KEY (pk_live*...)
- [ ] Update STRIPE*WEBHOOK_SECRET (whsec*...)
- [ ] Set NODE_ENV=production
- [ ] Configure webhook at Stripe Dashboard
- [ ] Test with real payment method (small amount)
- [ ] Enable HTTPS
- [ ] Set up monitoring and logging
- [ ] Configure email notifications

---

## Resources

- Stripe Dashboard: https://dashboard.stripe.com/test/payments
- Stripe API Docs: https://stripe.com/docs/api
- Test Cards: https://stripe.com/docs/testing
- Webhook Events: https://stripe.com/docs/api/events/types
