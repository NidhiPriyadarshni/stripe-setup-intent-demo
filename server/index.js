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

// 🔹 Utility logger
function log(step, message, data = null) {
  console.log(`\n[${step}] ${message}`);
  if (data) {
    console.log("   →", JSON.stringify(data, null, 2));
  }
}

app.use(cors({ origin: "*" }));

app.get("/config", (req, res) => {
  res.send({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

// 🔹 Step 1: Get or Create Customer
app.post("/get-or-create-customer", async (req, res) => {
  const { userId } = req.body;

  log("CUSTOMER", `Searching Stripe Customer for userId=${userId}`);

  const search = await stripe.customers.search(
    {
      query: `metadata['userId']:'${userId}'`,
    }
  );

  log("CUSTOMER", "Stripe search response received", {
    resultCount: search.data.length,
  });

  let customer;

  if (search.data.length > 0) {
    customer = search.data[0];

    log("CUSTOMER", "Existing Stripe Customer found", {
      customerId: customer.id,
      metadata: customer.metadata,
    });
  } else {
    log(
      "CUSTOMER",
      `No existing Stripe CustomerId found for userId=${userId}. Creating new customer...`
    );

    customer = await stripe.customers.create(
      {
        metadata: { userId },
      }
    );

    log("CUSTOMER", "New Stripe Customer created", {
      customerId: customer.id,
    });
  }

  res.send({ customerId: customer.id });
});

// 🔹 Step 2: Create SetupIntent + PaymentSession
app.post("/create-session", async (req, res) => {
  const { customerId } = req.body;

  log("SESSION", "Creating SetupIntent", {
    customerId
  });

  const setupIntent = await stripe.setupIntents.create(
    {
      customer: customerId,
      //payment_method_types: ["card"],
    }
  );

  log("SESSION", "SetupIntent created", {
    setupIntentId: setupIntent.id,
    status: setupIntent.status,
  });

  const psId = "ps_" + Date.now();

  paymentSessions[psId] = {
    id: psId,
    status: "CREATED",
    clientSecret: setupIntent.client_secret,
    setupIntentId: setupIntent.id,
    paymentMethod: null,
  };

  log("SESSION", "PaymentSession created", paymentSessions[psId]);

  res.send({
    paymentSession: paymentSessions[psId],
  });
});

// 🔹 Step 3: Confirm PaymentSession
app.post("/confirm-session", async (req, res) => {
  const { paymentSessionId } = req.body;

  const session = paymentSessions[paymentSessionId];

  log("CONFIRM", "Fetching SetupIntent from Stripe", {
    setupIntentId: session.setupIntentId,
  });

  const setupIntent = await stripe.setupIntents.retrieve(
    session.setupIntentId
  );

  log("CONFIRM", "Stripe SetupIntent response", {
    status: setupIntent.status,
    paymentMethod: setupIntent.payment_method,
  });

  if (setupIntent.status === "succeeded") {
    session.status = "SUCCEEDED";
    session.paymentMethod = setupIntent.payment_method;

    log("CONFIRM", "PaymentSession updated to SUCCEEDED", session);
  } else {
    session.status = "FAILED";

    log("CONFIRM", "PaymentSession FAILED", session);
  }

  res.send(session);
});

app.listen(4242, () => console.log("🚀 Server running on port 4242"));
