// models/Transaction.js
const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  text: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Food', 'Transportation', 'Entertainment', 'Health', 'Shopping', 'Bills', 'Education', 'Income', 'Others'],
    default: 'Others'
  },
  type: {
    type: String,
    required: true,
    enum: ['income', 'expense'],
    default: 'expense'
  },
  // AI-related fields
  aiSuggested: {
    type: Boolean,
    default: false
  },
  aiConfidence: {
    type: Number,
    default: 0,
    min: 0,
    max: 1
  },
  originalCategory: {
    type: String,
    default: null
  }
}, { 
  timestamps: true 
});

// Index for better query performance
TransactionSchema.index({ user: 1, createdAt: -1 });
TransactionSchema.index({ user: 1, category: 1 });
TransactionSchema.index({ user: 1, type: 1 });

module.exports = mongoose.model("Transaction", TransactionSchema);