require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");

const app = express();
app.use(cors());
app.use(express.json());

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// In-memory DB
const paymentSessions = {};

// 🔹 Logger
function log(step, message, data = null) {
  console.log(`\n[${step}] ${message}`);
  if (data) console.log("   →", JSON.stringify(data, null, 2));
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
  } else {
    customer = await stripe.customers.create({
      metadata: { userId },
    });
  }

  res.send({ customerId: customer.id });
});

// -----------------------------
// 🔵 SETUP INTENT FLOW
// -----------------------------
app.post("/create-session", async (req, res) => {
  const { customerId } = req.body;

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
  });

  const psId = "ps_" + Date.now();

  paymentSessions[psId] = {
    id: psId,
    type: "setup",
    clientSecret: setupIntent.client_secret,
    setupIntentId: setupIntent.id,
  };

  res.send({ paymentSession: paymentSessions[psId] });
});

// -----------------------------
// 🟢 PAYMENT INTENT FLOW
// -----------------------------
app.post("/create-payment-intent", async (req, res) => {
  const { customerId } = req.body;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: 5000, // ₹50 test
    currency: "inr",
    customer: customerId,
    automatic_payment_methods: {
      enabled: true,
    },
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

  const setupIntent = await stripe.setupIntents.retrieve(
    session.setupIntentId
  );

  if (setupIntent.status === "succeeded") {
    session.status = "SUCCEEDED";
    session.paymentMethod = setupIntent.payment_method;
  } else {
    session.status = "FAILED";
  }

  res.send(session);
});

app.listen(4242, () => console.log("🚀 Server running on 4242"));
