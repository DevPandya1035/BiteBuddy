// Enhanced script.js with better login handling

// Login button handler
document.getElementById("loginBtn").addEventListener("click", async () => {
  try {
    const r = await fetch("/api/check-auth");
    const data = await r.json();
    if (data.authenticated) {
      // ← already signed in
      window.location.href = "/dashboard.html";
    } else {
      // ← need to sign in
      window.location.href = "/auth/google";
    }
  } catch (e) {
    // network error → treat as not authenticated
    window.location.href = "/auth/google";
  }
});
// Register button handler
document.getElementById("registerBtn").addEventListener("click", () => {
  // Show a nicer message
  showNotification(
    "Sign-up will be handled via your Google Account during login. Click 'Login' to continue."
  );
});

// Get Started button handler
document.getElementById("getStartedBtn").addEventListener("click", () => {
  // Check if user is logged in by trying to access a protected route
  fetch("/api/check-auth")
    .then((res) => res.json())
    .then((data) => {
      if (data.authenticated) {
        window.location.href = "/dashboard.html";
      } else {
        showNotification("Please login first to start generating recipes!");
        // Optionally auto-redirect to login
        setTimeout(() => {
          window.location.href = "/auth/google";
        }, 2000);
      }
    })
    .catch((err) => {
      console.error("Auth check failed:", err);
      // If check fails, assume not logged in
      showNotification("Please login to continue!");
      setTimeout(() => {
        window.location.href = "/auth/google";
      }, 2000);
    });
});

// Helper function to show notifications
function showNotification(message) {
  // Remove any existing notifications
  const existingNotif = document.querySelector(".notification");
  if (existingNotif) {
    existingNotif.remove();
  }

  // Create notification element
  const notification = document.createElement("div");
  notification.className = "notification";
  notification.innerHTML = `
    <div class="notification-content">
      <span>${message}</span>
      <button class="notification-close">&times;</button>
    </div>
  `;

  document.body.appendChild(notification);

  // Show notification with animation
  setTimeout(() => notification.classList.add("show"), 10);

  // Close button handler
  notification
    .querySelector(".notification-close")
    .addEventListener("click", () => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300);
    });

  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300);
    }
  }, 5000);
}

// Check URL parameters for auth errors
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get("error") === "auth_failed") {
  showNotification("Authentication failed. Please try again.");
}

// Add loading state to buttons
function addLoadingState(button) {
  button.disabled = true;
  button.style.opacity = "0.6";
  button.style.cursor = "not-allowed";
  const originalText = button.textContent;
  button.innerHTML = `
    <span style="display: inline-flex; align-items: center; gap: 8px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="animation: spin 1s linear infinite;">
        <circle cx="12" cy="12" r="10" stroke-width="3" stroke-dasharray="31.4 31.4" stroke-linecap="round"/>
      </svg>
      ${originalText}...
    </span>
  `;
}

// Add spin animation
const style = document.createElement("style");
style.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
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

/* 4. Register-modal logic */
const modal = document.getElementById('registerModal');
const openBtn = document.getElementById('registerBtn');
const closeBtn= modal.querySelector('.modal-close');
const form   = document.getElementById('registerForm');

openBtn.addEventListener('click', () => modal.classList.add('show'));
closeBtn.addEventListener('click',() => modal.classList.remove('show'));
window.addEventListener('click', e => { if(e.target===modal) modal.classList.remove('show'); });

form.addEventListener('submit', async e => {
  e.preventDefault();
  const body = JSON.stringify({
    email: document.getElementById('regEmail').value,
    password: document.getElementById('regPassword').value
  });
  const res = await fetch('/api/register', {method:'POST', headers:{'Content-Type':'application/json'}, body});
  const data = await res.json();
  if(res.ok){
    showNotification('✅ Account created! You are now logged in.');
    modal.classList.remove('show');
    location.href = '/dashboard.html';
  }else{
    showNotification('❌ '+data.error);
  }
});