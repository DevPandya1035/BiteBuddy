// Dashboard JavaScript

// Load user info on page load
window.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch("/api/check-auth");
    const data = await response.json();

    if (!data.authenticated) {
      // Redirect to home if not authenticated
      window.location.href = "/?error=auth_required";
      return;
    }

    // Populate user info
    document.getElementById(
      "userName"
    ).textContent = `Welcome, ${data.user.displayName}!`;
    document.getElementById("userEmail").textContent = data.user.email || "";

    if (data.user.photo) {
      document.getElementById("userAvatar").src = data.user.photo;
    } else {
      // safe fallback
      const initials = data.user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
      document.getElementById(
        "userAvatar"
      ).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        initials
      )}&background=FF6B00&color=fff&size=80`;
    }
  } catch (error) {
    console.error("Error loading user info:", error);
    window.location.href = "/?error=session_error";
  }
});

// Logout button
document.getElementById("logoutBtn").addEventListener("click", () => {
  window.location.href = "/logout";
});

// Voice input
let recognition;
if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const field = document.getElementById("ingredients");
    const prefix = field.value.trim();
    field.value =
      (prefix + (prefix ? ", " : "") + transcript + ",")
        .replace(/,+/g, ",") // collapse multiple commas
        .replace(/,\s*$/, "") // remove trailing comma
        .trim() + ","; // ensure one clean trailing comma
    field.focus(); // keep caret at the end
    showNotification("✅ Voice added: " + transcript);
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error:", event.error);
    showNotification("❌ Voice input failed. Please try again.");
  };
}

document.getElementById("voiceBtn").addEventListener("click", () => {
  if (recognition) {
    recognition.start();
    showNotification("🎤 Listening... Speak now!");
  } else {
    showNotification("❌ Voice input not supported in your browser.");
  }
});

// Generate recipe button
document.getElementById("generateBtn").addEventListener("click", async () => {
  const ingredients = document.getElementById("ingredients").value.trim();
  const dietType = document.getElementById("dietType").value;
  const allergies = document.getElementById("allergies").value.trim();

  if (!ingredients) {
    showNotification("⚠️ Please enter some ingredients first!");
    return;
  }

  // Show loading state
  const output = document.getElementById("recipeOutput");
  const loading = document.getElementById("loading");
  const content = document.getElementById("recipeContent");

  output.classList.add("show");
  loading.style.display = "block";
  content.style.display = "none";

  try {
    const response = await fetch("/api/generate-recipe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredients, dietType, allergies }),
    });

    if (!response.ok) throw new Error("Failed to generate recipes");

    const payload = await response.json(); // { recipes:[...] }

    loading.style.display = "none";
    content.style.display = "block";

    content.innerHTML = payload.recipes
      .map(
        (r) => `
      <div class="recipe-card">
        <h3 style="color:#FF6B00;margin-bottom:12px">${r.title}</h3>
        <p style="color:#aaa;font-size:0.95rem">${r.description}</p>

        <div style="margin:12px 0;font-size:0.9rem;color:#ddd">
          <strong>Prep:</strong> ${r.prep} &nbsp;|&nbsp;
          <strong>Cook:</strong> ${r.cook} &nbsp;|&nbsp;
          <strong>Servings:</strong> ${r.servings}
        </div>

        <h4 style="color:#FF8C42;margin-top:16px">Ingredients:</h4>
        <ul style="margin-left:20px">
        ${r.ingredients.map((i) => `<li>${i.name} – ${i.amount}</li>`).join("")}
        </ul>

        <h4 style="color:#FF8C42;margin-top:16px">Steps:</h4>
        <ol style="margin-left:20px">
          ${r.steps
            .map((s) => `<li style="margin-bottom:8px">${s}</li>`)
            .join("")}
        </ol>

        <h4 style="color:#FF8C42;margin-top:16px">Nutrition (per serving):</h4>
        <table style="color:#ddd;font-size:0.9rem;margin-bottom:12px">
          ${Object.entries(r.nutrition)
            .map(
              ([k, v]) => `
            <tr><td style="padding-right:12px">${k}:</td><td>${v}</td></tr>
          `
            )
            .join("")}
        </table>

        <h4 style="color:#FF8C42">Health Benefits:</h4>
        <ul style="margin-left:20px">
          ${r.benefits.map((b) => `<li>${b}</li>`).join("")}
        </ul>

        <hr style="border-color:#444;margin:24px 0">
      </div>
    `
      )
      .join("");

    showNotification("✅ Recipes generated successfully!");
  } catch (error) {
    console.error("Recipe error:", error);
    loading.style.display = "none";
    content.style.display = "block";
    content.innerHTML = `<p style="color:#ff6b6b">❌ Could not load recipes.</p>`;
  }

  // Notification helper
  function showNotification(message) {
    const existingNotif = document.querySelector(".notification");
    if (existingNotif) {
      existingNotif.remove();
    }

    const notification = document.createElement("div");
    notification.className = "notification";
    notification.innerHTML = `
      <div class="notification-content">
        <span>${message}</span>
        <button class="notification-close">&times;</button>
      </div>
    `;

    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add("show"), 10);

    notification
      .querySelector(".notification-close")
      .addEventListener("click", () => {
        notification.classList.remove("show");
        setTimeout(() => notification.remove(), 300);
      });

    setTimeout(() => {
      if (notification.parentElement) {
        notification.classList.remove("show");
        setTimeout(() => notification.remove(), 300);
      }
    }, 5000);
  }

  // Add notification styles
  const style = document.createElement("style");
  style.textContent = `
    .notification {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #2c2c2c;
      color: #fff;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
      z-index: 10000;
      opacity: 0;
      transform: translateX(400px);
      transition: all 0.3s ease;
      max-width: 400px;
      border-left: 4px solid #FF6B00;
    }
    
    .notification.show {
      opacity: 1;
      transform: translateX(0);
    }
    
    .notification-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }
    
    .notification-close {
      background: none;
      border: none;
      color: #fff;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s;
    }
    
    .notification-close:hover {
      opacity: 0.7;
    }
  `;
  document.head.appendChild(style);
});
