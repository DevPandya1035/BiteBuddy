import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { Ollama } from "ollama";




const ollama = new Ollama({ host: "http://localhost:11434" });



dotenv.config();

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Debug: Check if public folder exists
const publicPath = path.join(__dirname, "..", "public");
console.log("\n" + "=".repeat(60));
console.log("🔍 SERVER STARTUP DIAGNOSTICS");
console.log("=".repeat(60));
console.log("📁 Server file location:", __dirname);
console.log("📁 Public folder path:", publicPath);
console.log("📁 Public folder exists:", fs.existsSync(publicPath));

if (fs.existsSync(publicPath)) {
  console.log("📄 Files in public folder:", fs.readdirSync(publicPath));

  // Check each critical file
  const criticalFiles = [
    "index.html",
    "style.css",
    "script.js",
    "dashboard.html",
  ];
  criticalFiles.forEach((file) => {
    const filePath = path.join(publicPath, file);
    const exists = fs.existsSync(filePath);
    console.log(`   ${exists ? "✅" : "❌"} ${file}`);
  });
} else {
  console.error("❌ PUBLIC FOLDER NOT FOUND!");
}
console.log("=".repeat(60) + "\n");

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Detailed request logger FIRST
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n⏰ [${timestamp}]`);
  console.log(`📥 ${req.method} ${req.url}`);
  console.log(`🌐 Origin: ${req.get("origin") || "direct"}`);
  console.log(`🔧 User-Agent: ${req.get("user-agent")?.substring(0, 50)}...`);

  // Log when response is sent
  const originalSend = res.send;
  res.send = function (data) {
    console.log(`📤 Response Status: ${res.statusCode}`);
    console.log(`📦 Response Type: ${res.get("Content-Type")}`);
    return originalSend.call(this, data);
  };

  next();
});

// Session setup BEFORE passport and static files
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default-secret-change-this",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true if using HTTPS
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Google OAuth setup
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  console.log("✅ Google OAuth credentials loaded");
  console.log("CALLBACK_URL env =", process.env.CALLBACK_URL);
  console.log(
    "Will use:",
    process.env.CALLBACK_URL || "http://localhost:3000/auth/google/callback"
  );
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.CALLBACK_URL ||
          "http://localhost:3000/auth/google/callback",
      },
      (accessToken, refreshToken, profile, done) => {
        console.log("✅ User authenticated:", profile.displayName);
        return done(null, profile);
      }
    )
  );
} else {
  console.warn("⚠️  Google OAuth credentials not found in .env");
}

passport.serializeUser((user, done) => {
  console.log("💾 Serializing user:", user.displayName || user.id);
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  console.log("🔓 Deserializing user");
  done(null, obj);
});

// Auth routes BEFORE static files
app.get("/auth/google", (req, res, next) => {
  console.log("🔐 Initiating Google OAuth...");
  passport.authenticate("google", { scope: ["profile", "email"] })(
    req,
    res,
    next
  );
});

app.get(
  "/auth/google/callback",
  (req, res, next) => {
    console.log("🔄 Google OAuth callback received");
    passport.authenticate("google", {
      failureRedirect: "/",
      failureMessage: true,
    })(req, res, next);
  },
  (req, res) => {
    console.log("✅ User authenticated successfully, redirecting to dashboard");
    res.redirect("/dashboard.html");
  }
);

// Logout route
app.get("/logout", (req, res) => {
  console.log("👋 User logging out");
  req.logout((err) => {
    if (err) {
      console.error("❌ Logout error:", err);
      return res.status(500).send("Logout failed");
    }
    console.log("✅ Logout successful");
    res.redirect("/");
  });
});

// Auth check endpoint
app.get("/api/check-auth", (req, res) => {
  if (req.isAuthenticated()) {
    console.log(
      "✅ User is authenticated:",
      req.user.displayName || req.user.id
    );
    res.json({
      authenticated: true,
      user: {
        id: req.user.id,
        displayName: req.user.displayName,
        email: req.user.emails ? req.user.emails[0].value : null,
        photo: req.user.photos ? req.user.photos[0].value : null,
      },
    });
  } else {
    console.log("❌ User is not authenticated");
    res.json({ authenticated: false });
  }
});

// Protected route middleware
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/?error=auth_required");
}

// Recipe generation endpoint (protected)
app.post("/api/generate-recipe", ensureAuthenticated, async (req, res) => {
  console.log("🍳 Recipe generation requested");
  const { ingredients, dietType, allergies } = req.body;

  console.log("Ingredients:", ingredients);
  console.log("Diet Type:", dietType);
  console.log("Allergies:", allergies);

  try {
    const { ingredients, dietType, allergies } = req.body;

    const prompt = `I have these ingredients: ${ingredients}.
  Diet preference: ${dietType}.  Allergies to avoid: ${allergies}.
  Give me 3–5 totally different recipes.
  For each recipe return:
  - title
  - short description
  - prep time
  - cook time (include oven/pan temperatures where relevant)
  - servings
  - ingredient list with metric amounts
  - step-by-step instructions (each step on its own line)
  - nutrition table: calories, fat, carbs, protein, fibre, vitamin-C, calcium
  - 2-3 health advantages of eating this dish
  Return strict JSON: {recipes:[{title,description,prep,cook,servings,ingredients:[],steps:[],nutrition:{},benefits:[]},...]}`;

    const out = await ollama.chat({
      model: "llama3.1:8b",
      messages: [{ role: "user", content: prompt }],
    });
    // 1. strip markdown fence + trailing note
    let raw = out.message.content
      .replace(/```json|```/g, "")
      .replace(/Note:.*$/s, "")
      .trim();

    // 2. quote every un-quoted value inside "amount": ...
    //    catches:  "amount": 3 cloves   →   "amount": "3 cloves"
    //             "amount": to taste   →   "amount": "to taste"
    raw = raw.replace(/"amount":\s*([^",\[\]{}]+?)\s*(?=,|\]|\})/g, (_, v) => {
      const cleaned = v.trim().replace(/^["']|["']$/g, ""); // remove outer quotes if any
      return `"amount": "${cleaned}"`;
    });

    // 3. quote other bare words in nutrition  (15g → "15 g")
    raw = raw.replace(
      /"([^"]+)":\s*(\d+\.?\d*)\s*([a-zA-Z]+)\b/g,
      '"$1": "$2 $3"'
    );

    // 4. extract the single JSON block
    const jsonBlock = raw.match(/\{[\s\S]*"recipes"[\s\S]*\}/);
    if (!jsonBlock) throw new Error("No JSON found");
    console.log(
      "==== SANITISED TEXT ====\n",
      raw,
      "\n========================"
    );
    const recipes = JSON.parse(jsonBlock[0]);
    res.json(recipes);
  } catch (err) {
    console.error("Ollama error:", err);
    res.status(500).json({ error: "Recipe generation failed" });
  }


})
// Explicit root route
app.get("/", (req, res) => {
  const indexPath = path.join(publicPath, "index.html");
  console.log("🏠 Attempting to serve index.html");
  console.log("🏠 File path:", indexPath);
  console.log("🏠 File exists:", fs.existsSync(indexPath));

  if (!fs.existsSync(indexPath)) {
    console.error("❌ index.html NOT FOUND at:", indexPath);
    return res.status(404).send("index.html not found at: " + indexPath);
  }

  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error("❌ Error sending index.html:", err);
      res.status(500).send(`Error loading page: ${err.message}`);
    } else {
      console.log("✅ index.html sent successfully");
    }
  });
});

// Serve static files with detailed logging
app.use(
  express.static(publicPath, {
    index: false, // Don't auto-serve index.html (we handle it explicitly)
    dotfiles: "deny",
    setHeaders: (res, filePath, stat) => {
      const fileName = path.basename(filePath);
      console.log(`📤 Serving static file: ${fileName}`);
    },
  })
);
/* 5. Minimal email/password auth */
const bcrypt = await import("bcryptjs"); // npm i bcryptjs
const users = new Map(); // email -> {hash, googleId}

// Register
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;
  if (users.has(email))
    return res.status(400).json({ error: "Email already registered" });
  const hash = await bcrypt.hash(password, 10);
  users.set(email, { hash });
  req.login(
    { id: email, displayName: email, emails: [{ value: email }] },
    (err) => {
      if (err)
        return res.status(500).json({ error: "Login after register failed" });
      res.json({ ok: true });
    }
  );
});

// Local login (optional endpoint if you want a separate login form later)
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user = users.get(email);
  if (!user) return res.status(401).json({ error: "No such user" });
  const ok = await bcrypt.compare(password, user.hash);
  if (!ok) return res.status(401).json({ error: "Wrong password" });
  req.login(
    { id: email, displayName: email, emails: [{ value: email }] },
    (err) => {
      if (err) return res.status(500).json({ error: "Login failed" });
      res.json({ ok: true });
    }
  );
});
// 404 handler - must be AFTER all other routes
app.use((req, res) => {
  console.log("❌ 404 Not Found:", req.url);
  console.log("💡 Available files in public:", fs.readdirSync(publicPath));
  res.status(404).send(`
    <html>
      <head><title>404 Not Found</title></head>
      <body style="font-family: monospace; padding: 40px; background: #1e1e1e; color: #fff;">
        <h1>404 - File Not Found</h1>
        <p><strong>Requested:</strong> ${req.url}</p>
        <p><strong>Public folder:</strong> ${publicPath}</p>
        <p><strong>Available files:</strong></p>
        <ul>
          ${fs
            .readdirSync(publicPath)
            .map((f) => `<li>${f}</li>`)
            .join("")}
        </ul>
        <a href="/" style="color: #FF6B00;">Go to Home</a>
      </body>
    </html>
  `);
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("\n" + "=".repeat(60));
  console.error("💥 UNHANDLED ERROR");
  console.error("=".repeat(60));
  console.error("Error:", err);
  console.error("Stack:", err.stack);
  console.error("=".repeat(60) + "\n");

  res.status(500).send("Internal Server Error: " + err.message);
});

// Start server with enhanced logging
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log("\n" + "=".repeat(60));
  console.log("🚀 SERVER STARTED SUCCESSFULLY");
  console.log("=".repeat(60));
  console.log(`📡 Port: ${PORT}`);
  console.log(`📂 Serving from: ${publicPath}`);
  console.log(`🌐 Local: http://localhost:${PORT}`);
  console.log(`🌐 Network: http://127.0.0.1:${PORT}`);
  console.log("=".repeat(60));
  console.log("\n⏳ Waiting for requests...\n");
});

// Server error handler
server.on("error", (err) => {
  console.error("\n" + "=".repeat(60));
  console.error("❌ SERVER ERROR");
  console.error("=".repeat(60));
  console.error("Error:", err.message);

  if (err.code === "EADDRINUSE") {
    console.error(`\n⚠️  Port ${PORT} is already in use!`);
    console.error("\n💡 Solutions:");
    console.error(`   1. Kill the process using port ${PORT}:`);
    console.error(`      lsof -i :${PORT}`);
    console.error(`      kill -9 <PID>`);
    console.error(`   2. Or use a different port:`);
    console.error(`      PORT=3000 node src/server.js`);
  }

  console.error("=".repeat(60) + "\n");
  process.exit(1);
});

// Handle server shutdown
process.on("SIGINT", () => {
  console.log("\n\n👋 Shutting down server...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("\n\n👋 Shutting down server...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});
