const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { check, validationResult } = require("express-validator");
const rateLimit = require("express-rate-limit");

const User = require("../models/User");
const auth = require("../middleware/auth");

// Rate limiter: 20 requests per 1 minute for development
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Allow 20 requests
  message: "Too many requests, please try again later.",
});

const validateAuth = (isRegister = false) => [
  ...(isRegister ? [check("name", "Name is required").not().isEmpty().trim().escape()] : []),
  check("email", "Please include a valid email").isEmail().normalizeEmail(),
  check("password", "Password must be at least 6 characters").isLength({ min: 6 }).trim().escape(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(`${new Date().toISOString()} - Validation errors:`, errors.array());
      return res.status(400).json({ msg: errors.array()[0].msg });
    }
    next();
  },
];

// @route   GET /api/auth/user
router.get("/user", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json(user);
  } catch (err) {
    console.error(`${new Date().toISOString()} - Error fetching user:`, err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST /api/auth/register
router.post("/register", authLimiter, validateAuth(true), async (req, res) => {
  const { name, email, password } = req.body;
  console.log(`${new Date().toISOString()} - Register attempt:`, { name, email, password });

  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: "User already exists" });

    user = new User({ name, email, password });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    console.log(`${new Date().toISOString()} - Hashed password:`, user.password);
    await user.save();
    console.log(`${new Date().toISOString()} - User saved:`, user._id);

    const payload = { user: { id: user.id } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" }, (err, token) => {
      if (err) {
        console.error(`${new Date().toISOString()} - JWT sign error:`, err.message);
        return res.status(500).json({ msg: "Server error during token generation" });
      }
      res.json({ token, username: user.name });
    });
  } catch (err) {
    console.error(`${new Date().toISOString()} - Registration error:`, err.message);
    res.status(500).send("Server error");
  }
});

// @route   POST /api/auth/login
router.post("/login", authLimiter, validateAuth(false), async (req, res) => {
  const { email, password } = req.body;
  console.log(`${new Date().toISOString()} - Login attempt:`, { email, password });

  try {
    let user = await User.findOne({ email: email.toLowerCase() }); // Case-insensitive search
    console.log(`${new Date().toISOString()} - User found:`, user ? user._id : null);
    if (!user) return res.status(400).json({ msg: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    console.log(`${new Date().toISOString()} - Password match:`, isMatch);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    const payload = { user: { id: user.id } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" }, (err, token) => {
      if (err) {
        console.error(`${new Date().toISOString()} - JWT sign error:`, err.message);
        return res.status(500).json({ msg: "Server error during token generation" });
      }
      console.log(`${new Date().toISOString()} - Login successful, token generated:`, token);
      res.json({ token, username: user.name });
    });
  } catch (err) {
    console.error(`${new Date().toISOString()} - Login error:`, err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;