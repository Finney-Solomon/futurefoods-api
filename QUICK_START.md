# Stripe Integration - Quick Start Guide

Complete setup guide to get Stripe payments working in 10 minutes.

---

## Prerequisites

- Node.js 20.x installed
- Stripe account (free): https://stripe.com
- MongoDB running locally or connection string

---

## Step 1: Get Stripe Keys (1 min)

1. Go to https://dashboard.stripe.com/test/apikeys
2. You'll see two keys on the Developers → API Keys page:
   - **Publishable Key** (starts with `pk_test_`)
   - **Secret Key** (starts with `sk_test_`)
3. Copy both

---

## Step 2: Update Environment Variables (1 min)

Open `.env` in your project root:

```env
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_test_xxxxx
```

**For webhook secret:**

- Option 1: Get from Stripe CLI (see below)
- Option 2: Use dummy value `whsec_test_temp` for now
- Option 3: Leave blank during development (webhook will show warning)

---

## Step 3: Install Dependencies (2 min)

```bash
npm install
```

✅ Stripe package already added to package.json

---

## Step 4: Start Backend (1 min)

```bash
npm run dev
```

You should see:

```
Server running on port 5000
MongoDB connected
```

---

## Step 5: Test the API (5 min)

### 5.1 Register & Login

**POST** `http://localhost:5000/api/auth/register`

```json
{
  "name": "Test User",
  "email": "test@example.com",
  "password": "TestPass123",
  "role": "customer"
}
```

Copy the JWT token from response.

**POST** `http://localhost:5000/api/auth/login`

```json
{
  "email": "test@example.com",
  "password": "TestPass123"
}
```

Save the token as `{{token}}` variable.

### 5.2 Add Product to Cart

**POST** `http://localhost:5000/api/cart`

Headers:

```
Authorization: Bearer {{token}}
```

Body:

```json
{
  "productId": "get_from_products_endpoint",
  "quantity": 1
}
```

### 5.3 Create Order

**POST** `http://localhost:5000/api/orders`

Headers:

```
Authorization: Bearer {{token}}
```

Body:

```json
{
  "address": {
    "line1": "123 Main St",
    "city": "New York",
    "state": "NY",
    "pin": "10001",
    "phone": "+1234567890"
  }
}
```

**Response:**

```json
{
  "order": {
    "_id": "ORDER_ID",
    "status": "created",
    "paymentStatus": "pending",
    ...
  }
}
```

Save `ORDER_ID`.

### 5.4 Create Payment Intent

**POST** `http://localhost:5000/api/orders/{{orderId}}/payment-intent`

Headers:

```
Authorization: Bearer {{token}}
```

**Response:**

```json
{
  "clientSecret": "pi_xxxxx_secret_yyyyy",
  "paymentIntentId": "pi_xxxxx",
  "amount": 5000
}
```

Save `paymentIntentId`.

### 5.5 Confirm Payment (Simulated)

**POST** `http://localhost:5000/api/orders/{{orderId}}/confirm-payment`

Headers:

```
Authorization: Bearer {{token}}
```

Body:

```json
{
  "paymentIntentId": "pi_xxxxx"
}
```

**Response (Success):**

```json
{
  "message": "Payment successful",
  "order": {
    "status": "paid",
    "paymentStatus": "succeeded"
  }
}
```

### 5.6 Check Payment Status

**GET** `http://localhost:5000/api/orders/{{orderId}}/payment-status`

Headers:

```
Authorization: Bearer {{token}}
```

---

## Step 6: Setup Webhook (Optional but Recommended)

### Using Stripe CLI

#### 6.1 Install Stripe CLI

**Windows (PowerShell as Admin):**

```powershell
choco install stripe-cli
```

Or [download here](https://github.com/stripe/stripe-cli/releases)

#### 6.2 Login to Stripe

```bash
stripe login
```

Follow the prompt.

#### 6.3 Start Webhook Forwarding

```bash
stripe listen --forward-to localhost:5000/api/orders/webhook/stripe
```

You'll get:

```
> Ready! Your webhook signing secret is: whsec_test_xxxxx
```

#### 6.4 Copy the Secret

Add to `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_test_xxxxx
```

#### 6.5 Test Webhook

In another terminal:

```bash
stripe trigger payment_intent.succeeded
```

Check your backend logs for webhook event.

---

## File Structure

New/Modified files:

```
src/
├── config/
│   └── stripe.js                    ← NEW (Stripe setup)
├── models/
│   └── Order.js                     ← UPDATED (+ Stripe fields)
├── controllers/
│   └── orderController.js           ← UPDATED (+ payment methods)
├── routes/
│   └── orderRoutes.js               ← UPDATED (+ payment routes)

Root/
├── .env.example                     ← UPDATED (+ Stripe vars)
├── stripe-api.postman_collection.json ← NEW (Postman collection)
├── STRIPE_INTEGRATION_README.md     ← NEW (Full docs)
├── COMPLETE_PAYMENT_FLOW.md         ← NEW (Flow explanation)
└── QUICK_START.md                   ← This file
```

---

## Test Cards

Use these in your frontend (Stripe Checkout form):

| Purpose       | Card Number         | Expiry | CVC  |
| ------------- | ------------------- | ------ | ---- |
| ✅ Successful | 4242 4242 4242 4242 | 12/25  | 123  |
| ❌ Declined   | 4000 0000 0000 0002 | 12/25  | 123  |
| ⚠️ 3D Secure  | 4000 0000 0000 3220 | 12/25  | 123  |
| Mastercard    | 5555 5555 5555 4444 | 12/25  | 123  |
| Amex          | 3782 822463 10005   | 12/25  | 1234 |

---

## Frontend Integration Example

```javascript
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripe = await loadStripe("pk_test_xxxxx");

// Inside component:
const handlePayment = async () => {
  // Step 1: Create payment intent
  const res1 = await fetch(`/api/orders/${orderId}/payment-intent`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const { clientSecret } = await res1.json();

  // Step 2: Confirm payment
  const { paymentIntent, error } = await stripe.confirmCardPayment(
    clientSecret,
    {
      payment_method: {
        card: cardElement,
        billing_details: { name: userName },
      },
    },
  );

  if (paymentIntent?.status === "succeeded") {
    // Step 3: Confirm with backend
    const res2 = await fetch(`/api/orders/${orderId}/confirm-payment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
    });

    console.log("Payment confirmed!");
  } else {
    console.error("Payment failed:", error);
  }
};
```

---

## Common Issues

### "Cannot find module 'stripe'"

```bash
npm install stripe
```

### "STRIPE_SECRET_KEY is not set"

Add to `.env`:

```env
STRIPE_SECRET_KEY=sk_test_xxxxx
```

### "Invalid API Key provided"

- Check key doesn't have extra spaces
- Test key should start with `sk_test_`
- Get fresh key from Stripe Dashboard

### "Webhook secret not configured"

Either:

1. Add `STRIPE_WEBHOOK_SECRET` to `.env`
2. Or use Stripe CLI: `stripe listen --forward-to localhost:5000/api/orders/webhook/stripe`

### Payment shows "pending" forever

- Make sure webhook secret is configured
- Check webhook delivery in Stripe Dashboard
- Or manually call confirm-payment endpoint

---

## Next Steps

1. ✅ Backend setup complete
2. 📱 Integrate Stripe.js in your frontend
3. 🔐 Test with Stripe test cards
4. 📊 Monitor payments in Stripe Dashboard
5. 🚀 Deploy to production

---

## Production Deployment

When going live:

1. Switch to **LIVE** keys at https://dashboard.stripe.com/apikeys
   - Secret: `sk_live_xxxxx`
   - Publishable: `pk_live_xxxxx`

2. Update `.env`:

```env
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_live_xxxxx
NODE_ENV=production
```

3. Set up webhook at https://dashboard.stripe.com/webhooks
   - Endpoint: `https://yourdomain.com/api/orders/webhook/stripe`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`

4. Enable HTTPS
5. Test with small real payment

---

## Support & Resources

- **Stripe Docs:** https://stripe.com/docs
- **API Reference:** https://stripe.com/docs/api
- **Test Cards:** https://stripe.com/docs/testing
- **Webhook Events:** https://stripe.com/docs/api/events
- **Status Page:** https://status.stripe.com

---

## Summary

You now have:

- ✅ Stripe SDK integrated
- ✅ Order model with payment fields
- ✅ Payment intent creation & confirmation endpoints
- ✅ Webhook handling
- ✅ Comprehensive documentation
- ✅ Postman collection for testing

**Total setup time: ~10 minutes**

🎉 Ready to accept payments!
