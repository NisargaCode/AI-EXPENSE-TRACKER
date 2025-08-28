const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");

const auth = require("../middleware/auth");
const Transaction = require("../models/Transaction");
const aiService = require("../services/aiService");

// @route   GET /api/transactions
// @route   GET /api/transactions
// @route   GET /api/transactions
router.get("/", auth, async (req, res) => {
  console.log(`${new Date().toISOString()} - [GET /transactions] Received request for user:`, req.user?.id);
  try {
  if (!req.user?.id) {
    console.error(`${new Date().toISOString()} - [GET /transactions] User ID not found in request`);
    return res.status(401).json({ msg: "User not authenticated" });
  }
  const transactions = await Transaction.find({ user: req.user.id }).sort({ createdAt: -1 });
  console.log(`${new Date().toISOString()} - [GET /transactions] Found ${transactions.length} transactions`);
  res.json(transactions);
} catch (err) {
  console.error(`${new Date().toISOString()} - [GET /transactions] Error:`, err.message, err.stack);
  res.status(500).json({ msg: "Server error", error: err.message });
}
});

// @route   POST /api/transactions
router.post("/", [auth, /* validation middleware if any */], async (req, res) => {
  console.log(`${new Date().toISOString()} - [POST /transactions] Received data for user:`, req.user?.id, req.body);
  try {
    const { text, amount, category, type } = req.body;
    if (!text || !amount || !type) {
      return res.status(400).json({ msg: "Missing required fields" });
    }

    let aiSuggested = false;
    let aiConfidence = 0;
    let finalCategory = category;

    if (!category || category === "AI_SUGGEST") {
      const suggestion = await aiService.categorizeExpense(text, Math.abs(amount));
      finalCategory = suggestion.category;
      aiSuggested = true;
      aiConfidence = suggestion.confidence;
    }

    const newTransaction = new Transaction({
      user: req.user.id,
      text,
      amount: type === "income" ? Math.abs(amount) : -Math.abs(amount),
      category: finalCategory,
      type,
      aiSuggested,
      aiConfidence,
    });

    const transaction = await newTransaction.save();
    console.log(`${new Date().toISOString()} - [POST /transactions] Saved transaction:`, transaction._id);
    res.json(transaction);
  } catch (err) {
    console.error(`${new Date().toISOString()} - [POST /transactions] Error:`, err.message, err.stack);
    res.status(500).json({ msg: "Server error", error: err.message });
  }
});

// @route   PUT /api/transactions/:id
router.put("/:id", auth, async (req, res) => {
  const { text, amount, category, type } = req.body;
  const updatedFields = {};
  if (text) updatedFields.text = text;
  if (amount) updatedFields.amount = type === 'expense' ? -Math.abs(amount) : Math.abs(amount);
  if (category) updatedFields.category = category;
  if (type) updatedFields.type = type;

  try {
    let transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ msg: "Transaction not found" });
    if (transaction.user.toString() !== req.user.id) return res.status(401).json({ msg: "Not authorized" });

    if (category && transaction.aiSuggested && category !== transaction.category) {
      updatedFields.aiSuggested = false;
      updatedFields.originalCategory = transaction.category;
    }

    transaction = await Transaction.findByIdAndUpdate(req.params.id, { $set: updatedFields }, { new: true });
    res.json(transaction);
  } catch (err) {
    console.error(`${new Date().toISOString()} - Update transaction error:`, err.message);
    res.status(500).send("Server error");
  }
});

// @route   DELETE /api/transactions/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ msg: "Transaction not found" });
    if (transaction.user.toString() !== req.user.id) return res.status(401).json({ msg: "Not authorized" });

    await Transaction.findByIdAndRemove(req.params.id);
    res.json({ msg: "Transaction removed" });
  } catch (err) {
    console.error(`${new Date().toISOString()} - Delete transaction error:`, err.message);
    res.status(500).send("Server error");
  }
});

module.exports = router;