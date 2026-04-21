// 🔹 LOGIN
function login() {
  const userId = document.getElementById("userId").value;
  localStorage.setItem("userId", userId);
  window.location.href = "chat.html";
}

// 🔹 CHATBOT
let step = 0;

function send() {
  const inputEl = document.getElementById("input");
  const input = inputEl.value;
  const chat = document.getElementById("chat");

  if (step === 0) {
    chat.innerHTML += "<p>You: " + input + "</p>";
    chat.innerHTML += "<p>Bot: Select option - Option1, Option2, Option3</p>";
    step++;
  } else {
    chat.innerHTML += "<p>You: " + input + "</p>";
    chat.innerHTML += `<button onclick="goToPayment()">Continue to payment</button>`;
  }

  inputEl.value = "";
}

// 🔹 CREATE SESSION (SETUP INTENT FLOW ONLY)
async function goToPayment() {
  console.log("Creating setup session...");

  const userId = localStorage.getItem("userId");

  const cRes = await fetch(
    "https://stripe-setup-intent-demo.onrender.com/get-or-create-customer",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }
  );

  const { customerId } = await cRes.json();

  const sRes = await fetch(
    "https://stripe-setup-intent-demo.onrender.com/create-session",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId }),
    }
  );

  const { paymentSession } = await sRes.json();

  localStorage.setItem("paymentSessionId", paymentSession.id);
  localStorage.setItem("clientSecret", paymentSession.clientSecret);

  console.log("Setup session created:", paymentSession);

  window.location.href = "payment.html";
}

// 🔹 STRIPE INITIALIZATION (DUAL MODE)

let stripeInitialized = false;

async function initStripePayment() {
  console.log("Stripe init started");

  if (stripeInitialized) return;
  stripeInitialized = true;

  const mode = document.getElementById("mode").value;

  const res = await fetch(
    "https://stripe-setup-intent-demo.onrender.com/config"
  );
  const { publishableKey } = await res.json();

  const stripe = Stripe(publishableKey);

  let elements;

  // -------------------------
  // 🔵 SETUP INTENT FLOW
  // -------------------------
  if (mode === "setup") {
    const clientSecret = localStorage.getItem("clientSecret");

    if (!clientSecret) {
      alert("SetupIntent not initialized");
      return;
    }

    elements = stripe.elements({
      clientSecret,
    });

    const payment = elements.create("payment");
    payment.mount("#payment-element");

    document.getElementById("payBtn").onclick = async () => {
      const { error } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: {
          return_url: window.location.origin + "/result.html",
        },
      });

      if (error) console.error("Setup error:", error);
    };
  }

  // -------------------------
  // 🟢 PAYMENT INTENT FLOW
  // -------------------------
  else {
    const userId = localStorage.getItem("userId");

    const cRes = await fetch(
      "https://stripe-setup-intent-demo.onrender.com/get-or-create-customer",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      }
    );

    const { customerId } = await cRes.json();

    const pRes = await fetch(
      "https://stripe-setup-intent-demo.onrender.com/create-payment-intent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      }
    );

    const { clientSecret } = await pRes.json();

    elements = stripe.elements({
      clientSecret,
    });

    const payment = elements.create("payment");
    payment.mount("#payment-element");

    document.getElementById("payBtn").onclick = async () => {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + "/result.html",
        },
      });

      if (error) console.error("Payment error:", error);
    };
  }
}

// 🔹 OPTIONAL BACKEND CONFIRM
async function confirmBackend() {
  const psId = localStorage.getItem("paymentSessionId");

  const res = await fetch(
    "https://stripe-setup-intent-demo.onrender.com/confirm-session",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentSessionId: psId }),
    }
  );

  const data = await res.json();
  console.log("Backend confirm response:", data);

  return data;
}
