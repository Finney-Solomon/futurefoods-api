# Future Foods API - Stripe Payment Integration Guide

Complete guide to using the Stripe payment integration in the Future Foods API.

## Table of Contents

1. [Setup](#setup)
2. [Architecture](#architecture)
3. [API Endpoints](#api-endpoints)
4. [End-to-End Flow](#end-to-end-flow)
5. [Environment Variables](#environment-variables)
6. [Testing](#testing)
7. [Webhook Setup](#webhook-setup)

---

## Setup

### 1. Install Dependencies

```bash
npm install
```

The Stripe package is already added to `package.json`.

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your Stripe keys:

```bash
cp .env.example .env
```

Then update with your Stripe credentials:

```env
STRIPE_SECRET_KEY=sk_test_xxxxx_or_sk_live_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx_or_pk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
MONGO_URI=mongodb://localhost:27017/futurefoods
JWT_SECRET=your_secret_key
```

### 3. Get Your Stripe Keys

1. Sign up at [Stripe Dashboard](https://dashboard.stripe.com)
2. Go to **Developers** → **API Keys**
3. Copy your **Secret Key** and **Publishable Key**
4. For webhook testing, use the Stripe CLI

---

## Architecture

### Order Model Updates

The Order model now includes payment fields:

```javascript
{
  // ... existing fields
  stripePaymentIntentId: String,      // Stripe Payment Intent ID
  stripePaymentMethodId: String,      // Stripe Payment Method ID
  paymentStatus: String,              // pending, succeeded, failed, processing
  paymentDetails: {
    last4: String,                    // Card last 4 digits
    brand: String,                    // Card brand (visa, mastercard, etc)
    expMonth: Number,                 // Card expiry month
    expYear: Number,                  // Card expiry year
    errorMessage: String              // Payment error if failed
  }
}
```

### Payment Flow

```
User Cart → Create Order → Create Payment Intent → Confirm Payment → Update Order Status
                                     ↓
                            (Client sends card details)
                                     ↓
                            Stripe processes payment
                                     ↓
                          Webhook notifies backend
```

---

## API Endpoints

### 1. Create Order from Cart

- **Endpoint:** `POST /api/orders`
- **Auth:** Required (JWT)
- **Body:**

```json
{
  "address": {
    "line1": "123 Main Street",
    "city": "New York",
    "state": "NY",
    "pin": "10001",
    "phone": "+1234567890"
  }
}
```

- **Response:**

```json
{
  "order": {
    "_id": "order_id",
    "user": "user_id",
    "items": [...],
    "amountPaise": 5000,
    "status": "created",
    "paymentStatus": "pending",
    "address": {...},
    "createdAt": "2024-01-15T10:30:00Z"
  },
  "message": "Order created. Proceed to payment."
}
```

---

### 2. Create Payment Intent

- **Endpoint:** `POST /api/orders/:orderId/payment-intent`
- **Auth:** Required (JWT)
- **Method:** Initiated from **Frontend**
- **Response:**

```json
{
  "clientSecret": "pi_xxxxx_secret_xxxxx",
  "paymentIntentId": "pi_xxxxx",
  "amount": 5000,
  "orderId": "order_id"
}
```

**Frontend Usage:**
Use the `clientSecret` with Stripe.js to confirm payment on client side:

```javascript
// Frontend code example
const { clientSecret, paymentIntentId } = await response.json();

const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement,
    billing_details: { name: "John Doe" },
  },
});

if (paymentIntent.status === "succeeded") {
  // Send confirmation to backend
  await fetch(`/api/orders/${orderId}/confirm-payment`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ paymentIntentId }),
  });
}
```

---

### 3. Confirm Payment

- **Endpoint:** `POST /api/orders/:orderId/confirm-payment`
- **Auth:** Required (JWT)
- **Body:**

```json
{
  "paymentIntentId": "pi_xxxxx"
}
```

- **Response (Success):**

```json
{
  "message": "Payment successful",
  "order": {
    "_id": "order_id",
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

- **Response (Processing):**

```json
{
  "message": "Payment is processing",
  "paymentStatus": "processing",
  "orderId": "order_id"
}
```

- **Response (Failed):**

```json
{
  "message": "Payment failed",
  "paymentStatus": "failed",
  "error": "Your card was declined"
}
```

---

### 4. Get Payment Status

- **Endpoint:** `GET /api/orders/:orderId/payment-status`
- **Auth:** Required (JWT)
- **Response:**

```json
{
  "orderId": "order_id",
  "status": "paid",
  "paymentStatus": "succeeded",
  "amount": 5000,
  "paymentDetails": {
    "last4": "4242",
    "brand": "visa",
    "expMonth": 12,
    "expYear": 2025
  }
}
```

---

### 5. Get User's Orders

- **Endpoint:** `GET /api/orders/myOrders`
- **Auth:** Required (JWT)
- **Response:**

```json
[
  {
    "_id": "order_id",
    "items": [...],
    "amountPaise": 5000,
    "status": "paid",
    "paymentStatus": "succeeded",
    "paymentDetails": {...},
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

---

### 6. Get All Orders (Admin)

- **Endpoint:** `GET /api/orders`
- **Auth:** Required (JWT) + Admin Role
- **Response:**

```json
[
  {
    "_id": "order_id",
    "user": {...},
    "items": [...],
    "amountPaise": 5000,
    "status": "paid",
    "paymentStatus": "succeeded",
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

---

## End-to-End Flow

### Complete Payment Journey

#### Step 1: Add Items to Cart

User adds products to their cart.

#### Step 2: Create Order from Cart

```bash
POST /api/orders
{
  "address": {
    "line1": "123 Main Street",
    "city": "New York",
    "state": "NY",
    "pin": "10001",
    "phone": "+1234567890"
  }
}
```

**Response:** Order created with `paymentStatus: "pending"`

#### Step 3: Create Payment Intent (Frontend triggers)

```bash
POST /api/orders/:orderId/payment-intent
```

**Response:** Receives `clientSecret` to use with Stripe.js

#### Step 4: Collect Card Details (Frontend)

Using Stripe.js, collect card information:

```javascript
const { clientSecret } = paymentIntentResult;

const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement,
    billing_details: { name: userName },
  },
});
```

#### Step 5: Confirm Payment (Backend)

```bash
POST /api/orders/:orderId/confirm-payment
{
  "paymentIntentId": "pi_xxxxx"
}
```

**Response:** Order updated to `status: "paid"`, `paymentStatus: "succeeded"`

#### Step 6: Check Payment Status

```bash
GET /api/orders/:orderId/payment-status
```

**Response:** Current payment status and details

---

## Environment Variables

Create a `.env` file in the root directory:

```env
# Database
MONGO_URI=mongodb://localhost:27017/futurefoods

# Server
PORT=5000
NODE_ENV=development

# JWT
JWT_SECRET=your_secret_key_here

# Stripe Keys (Test)
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Stripe Keys (Live - Production Only)
# STRIPE_SECRET_KEY=sk_live_xxxxx
# STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
# STRIPE_WEBHOOK_SECRET=whsec_live_xxxxx
```

### Getting Your Keys

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **API Keys**
3. Use **Test Keys** for development
4. Use **Live Keys** for production

---

## Testing

### Using Postman

Import the provided `stripe-api.postman_collection.json` file:

1. Open Postman
2. Click **Import**
3. Select the `stripe-api.postman_collection.json` file
4. Update environment variables in Postman:
   - `baseUrl`: `http://localhost:5000/api`
   - `token`: Your JWT token
   - `orderId`: Order ID from create order response

### Test Card Numbers

Use these card numbers in test mode:

| Card Type       | Number              | CVC          | Date            |
| --------------- | ------------------- | ------------ | --------------- |
| Visa            | 4242 4242 4242 4242 | Any 3 digits | Any future date |
| Visa (Declined) | 4000 0000 0000 0002 | Any 3 digits | Any future date |
| Mastercard      | 5555 5555 5555 4444 | Any 3 digits | Any future date |
| Amex            | 3782 822463 10005   | Any 4 digits | Any future date |

---

## Webhook Setup

### Local Testing with Stripe CLI

#### 1. Install Stripe CLI

```bash
# Windows (using choco)
choco install stripe-cli

# macOS
brew install stripe/stripe-cli/stripe

# Linux
# Download from https://github.com/stripe/stripe-cli/releases
```

#### 2. Authenticate Stripe CLI

```bash
stripe login
```

#### 3. Forward webhooks to your local server

```bash
stripe listen --forward-to localhost:5000/api/orders/webhook/stripe
```

This command will give you a webhook signing secret. Add it to your `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```

#### 4. Trigger a test event

In another terminal:

```bash
stripe trigger payment_intent.succeeded
```

### Production Webhook Setup

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **Webhooks**
3. Click **Add endpoint**
4. Enter your endpoint: `https://yourdomain.com/api/orders/webhook/stripe`
5. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
6. Copy the signing secret and add to `.env` as `STRIPE_WEBHOOK_SECRET`

### Handled Webhook Events

- **`payment_intent.succeeded`** - Updates order to `status: "paid"`, `paymentStatus: "succeeded"`
- **`payment_intent.payment_failed`** - Updates order to `paymentStatus: "failed"` with error message

---

## Security Best Practices

1. **Never expose Secret Keys** in frontend code
2. **Use environment variables** for all sensitive data
3. **Validate payments server-side** always
4. **Use webhook signatures** to verify authenticity
5. **Hash sensitive data** in logs
6. **HTTPS only** in production
7. **Rate limit** payment endpoints
8. **Store PCI-compliant data only** (Stripe handles card data)

---

## Troubleshooting

### "Invalid API Key" Error

- Check that `STRIPE_SECRET_KEY` is set correctly
- Verify key is for the right environment (test/live)
- Ensure no extra spaces in the key

### "Webhook secret not configured"

- Add `STRIPE_WEBHOOK_SECRET` to `.env`
- For testing, use Stripe CLI to get the secret

### "Order not found"

- Verify the order ID is correct
- Check that the order belongs to the authenticated user

### Payment Intent fails

- Ensure amount is in smallest currency unit (paise for INR)
- Verify Stripe keys are correct
- Check card details in the request

### Webhook not triggering

- Verify webhook URL is correct and publicly accessible
- Check webhook signing secret matches
- Review webhook logs in Stripe Dashboard

---

## Additional Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe.js Reference](https://stripe.com/docs/js)
- [Payment Methods API](https://stripe.com/docs/payments/payment-methods)
- [Webhook Events](https://stripe.com/docs/api/events/types)

---

## Support

For issues or questions:

1. Check Stripe Dashboard logs
2. Review error messages in order `paymentDetails.errorMessage`
3. Check webhook delivery status in Dashboard
4. Refer to [Stripe Documentation](https://stripe.com/docs)
