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

// 🔹 CREATE SESSION BEFORE NAVIGATION
async function goToPayment() {
  console.log("Creating payment session...");

  const userId = localStorage.getItem("userId");

  // Step 1: Get/Create customer
  const cRes = await fetch("https://stripe-setup-intent-demo.onrender.com/get-or-create-customer", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ userId }),
  });
  const { customerId } = await cRes.json();

  // Step 2: Create session
  const sRes = await fetch("https://stripe-setup-intent-demo.onrender.com/create-session", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ customerId }),
  });
  const { paymentSession } = await sRes.json();

  // Store for next page
  localStorage.setItem("paymentSessionId", paymentSession.id);
  localStorage.setItem("clientSecret", paymentSession.clientSecret);

  console.log("Session created:", paymentSession);

  // Navigate AFTER session is ready
  window.location.href = "payment.html";
}

// 🔹 STRIPE FLOW (ONLY ON BUTTON CLICK)

let stripeInitialized = false;

function initStripePayment() {  
  if (stripeInitialized) return;
  stripeInitialized = true;

  console.log("Stripe button clicked");

  if (stripeInitialized) return; // prevent duplicate mount
  stripeInitialized = true;

  const clientSecret = localStorage.getItem("clientSecret");

  if (!clientSecret) {
    alert("Payment not initialized!");
    return;
  }

  // ✅ NEW: fetch publishable key
  const res = await fetch("https://stripe-setup-intent-demo.onrender.com/config");
  const { publishableKey } = await res.json();

  console.log("ClientSecret:", clientSecret);

  const elements = stripe.elements({
    clientSecret: clientSecret,
  });

  const pe = elements.create("payment");
  pe.mount("#payment-element");

  console.log("PaymentElement mounted");

  document.getElementById("payBtn").onclick = async () => {
    console.log("Confirming setup...");

    const { error } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: window.location.origin + "/result.html",
        
      },
    });

    if (error) {
      console.error("Stripe error:", error);
    }
  };
}

// 🔹 CONFIRM BACKEND (optional use in result page)
async function confirmBackend() {
  const psId = localStorage.getItem("paymentSessionId");

  const res = await fetch("https://stripe-setup-intent-demo.onrender.com/confirm-session", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ paymentSessionId: psId }),
  });

  const data = await res.json();
  console.log("Backend confirm response:", data);

  return data;
}
