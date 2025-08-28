// middleware/auth.js
const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/User"); // Import the User model

const auth = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      let decoded;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
          break;
        } catch (err) {
          if (attempt === 2) throw err;
          console.warn(`Token verification attempt ${attempt} failed, retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      console.log(`${new Date().toISOString()} - Verifying token for user ID: ${decoded.user?.id || 'undefined'}`);
      req.user = await User.findById(decoded.user.id) // Changed from decoded.id
        .select("-password")
        .setOptions({ maxTimeMS: 5000 });

      if (!req.user) {
        console.error(`${new Date().toISOString()} - User not found for ID: ${decoded.user.id}`);
        res.status(401);
        throw new Error("User not found");
      }
      next();
    } catch (error) {
      console.error("Authentication error:", {
        message: error.message,
        code: error.code || "N/A",
        name: error.name,
        isJwtError: error.name === "JsonWebTokenError",
        timestamp: new Date().toISOString(),
      });
      res.status(401);
      throw new Error("Not authorized, token failed");
    }
  } else {
    res.status(401);
    throw new Error("Not authorized, no token");
  }
});

module.exports = auth;