require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");

const app = express();
app.use(cors());
app.use(express.json());

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// In-memory DB (demo only)
const paymentSessions = {};

// -----------------------------
// 🔹 Logger
// -----------------------------
function log(step, message, data = null) {
  console.log(`\n[${step}] ${message}`);
  if (data) console.log("   →", JSON.stringify(data, null, 2));
}

// -----------------------------
// ⚙️ CONFIG (FIX FOR 404)
// -----------------------------
app.get("/config", (req, res) => {
  res.send({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

// Safety check (optional)
if (!process.env.STRIPE_PUBLISHABLE_KEY) {
  console.warn("⚠️ Missing STRIPE_PUBLISHABLE_KEY in env");
}

// -----------------------------
// 🔵 CUSTOMER
// -----------------------------
app.post("/get-or-create-customer", async (req, res) => {
  const { userId } = req.body;

  log("CUSTOMER", "Searching customer", { userId });

  const search = await stripe.customers.search({
    query: `metadata['userId']:'${userId}'`,
  });

  let customer;

  if (search.data.length > 0) {
    customer = search.data[0];

    log("CUSTOMER", "Existing customer found", {
      customerId: customer.id,
    });
  } else {
    customer = await stripe.customers.create({
      metadata: { userId },
    });

    log("CUSTOMER", "New customer created", {
      customerId: customer.id,
    });
  }

  res.send({ customerId: customer.id });
});

// -----------------------------
// 🔵 SETUP INTENT FLOW
// -----------------------------
app.post("/create-session", async (req, res) => {
  const { customerId } = req.body;

  log("SETUP", "Creating SetupIntent", { customerId });

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
  });

  const psId = "ps_" + Date.now();

  paymentSessions[psId] = {
    id: psId,
    type: "setup",
    status: "CREATED",
    clientSecret: setupIntent.client_secret,
    setupIntentId: setupIntent.id,
  };

  log("SETUP", "Session created", paymentSessions[psId]);

  res.send({
    paymentSession: paymentSessions[psId],
  });
});

// -----------------------------
// 🟢 PAYMENT INTENT FLOW
// -----------------------------
app.post("/create-payment-intent", async (req, res) => {
  const { customerId } = req.body;

  log("PAYMENT", "Creating PaymentIntent", { customerId });

  const paymentIntent = await stripe.paymentIntents.create({
    amount: 5000, // ₹50 test
    currency: "inr",
    customer: customerId,
    payment_method_types: ["card"],
    setup_future_usage: "on_session",
    capture_method: "manual"
  });

  log("PAYMENT", "PaymentIntent created", {
    id: paymentIntent.id,
  });

  res.send({
    id: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
  });
});

// -----------------------------
// 🔵 CONFIRM SETUP INTENT
// -----------------------------
app.post("/confirm-session", async (req, res) => {
  const { paymentSessionId } = req.body;

  const session = paymentSessions[paymentSessionId];

  // safety check (IMPORTANT)
  if (!session) {
    return res.status(400).send({
      error: "Invalid paymentSessionId",
    });
  }

  log("CONFIRM", "Retrieving SetupIntent", {
    setupIntentId: session.setupIntentId,
  });

  const setupIntent = await stripe.setupIntents.retrieve(
    session.setupIntentId
  );

  log("CONFIRM", "SetupIntent status", {
    status: setupIntent.status,
  });

  if (setupIntent.status === "succeeded") {
    session.status = "SUCCEEDED";
    session.paymentMethod = setupIntent.payment_method;
  } else {
    session.status = "FAILED";
  }

  res.send(session);
});

// -----------------------------
// 🚀 START SERVER
// -----------------------------
app.listen(4242, () => {
  console.log("🚀 Server running on port 4242");
});
