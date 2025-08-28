const express = require("express");
const connectDB = require("./config/db");
const dotenv = require("dotenv");
const cors = require("cors");

// Load environment variables
console.log("🔧 Loading environment variables...");
dotenv.config();
console.log("✅ Environment variables loaded:", {
  MONGO_URI_SET: !!process.env.MONGO_URI,
  JWT_SECRET_SET: !!process.env.JWT_SECRET,
  GEMINI_API_KEY_SET: !!process.env.GEMINI_API_KEY,
});

// Connect to MongoDB
console.log("🔗 Attempting to connect to MongoDB...");
connectDB()
  .then(() => {
    console.log("✅ MongoDB Connected successfully!");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1); // Exit if DB connection fails
  });

const app = express();

// Middleware
console.log("🛠️ Setting up middleware...");
app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true
}));
console.log("✅ CORS middleware configured");

app.use(express.json({ limit: '10mb' }));
console.log("✅ JSON parser middleware configured");

app.use(express.urlencoded({ extended: true }));
console.log("✅ URL-encoded parser middleware configured");

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});
console.log("✅ Request logging middleware configured");

// Health check route
app.get('/api/health', (req, res) => {
  console.log(`${new Date().toISOString()} - Health check requested`);
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    env: {
      mongoConnected: !!process.env.MONGO_URI,
      jwtConfigured: !!process.env.JWT_SECRET,
      geminiConfigured: !!process.env.GEMINI_API_KEY
    }
  });
});
console.log("✅ Health check route registered");

// Routes
console.log("🔄 Registering route handlers...");
app.use("/api/auth", require("./routes/auth"));
console.log("✅ Auth routes registered");
app.use("/api/transactions", require("./routes/transactions"));
console.log("✅ Transactions routes registered");
app.use("/api/ai", require("./routes/ai"));
console.log("✅ AI routes registered");

// Simplified 404 handler (avoiding regex for now)
app.use((req, res) => {
  console.log(`${new Date().toISOString()} - 404: ${req.originalUrl} not found`);
  res.status(404).json({ message: `Route ${req.originalUrl} not found` });
});
console.log("✅ 404 handler configured");

// Global error handler
app.use((err, req, res, next) => {
  console.error(`${new Date().toISOString()} - Global Error Handler:`, err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});
console.log("✅ Global error handler configured");

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error(`${new Date().toISOString()} - Unhandled Promise Rejection:`, err.message);
  process.exit(1);
});
console.log("✅ Unhandled rejection handler configured");

const PORT = process.env.PORT || 5000;
console.log(`📡 Starting server on port ${PORT}...`);

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});
console.log("✅ Server startup completed");

// Handle server shutdown gracefully
process.on('SIGTERM', () => {
  console.log(`${new Date().toISOString()} - SIGTERM received, shutting down gracefully`);
  server.close(() => {
    console.log(`${new Date().toISOString()} - Process terminated`);
  });
});
console.log("✅ SIGTERM handler configured");