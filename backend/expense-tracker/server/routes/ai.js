// routes/ai.js
const express = require("express");
const router = express.Router();
const { check, validationResult } = require("express-validator");

const auth = require("../middleware/auth");
const aiService = require("../services/aiService");
const Transaction = require("../models/Transaction");

// @route   POST /api/ai/categorize
// @desc    Get AI category suggestion for expense
// @access  Private
router.post("/categorize", [
  auth,
  [
    check("description", "Description is required").not().isEmpty(),
    check("amount", "Amount is required").isNumeric()
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { description, amount } = req.body;
    const suggestion = await aiService.categorizeExpense(description, amount);

    res.json({
      suggestedCategory: suggestion.category,
      confidence: suggestion.confidence,
      message: `AI suggests: ${suggestion.category}`
    });
  } catch (error) {
    console.error('Categorization error:', error);
    res.status(500).json({
      message: "AI categorization failed",
      suggestedCategory: "Others",
      confidence: 0.1
    });
  }
});


// @route   GET /api/ai/insights
// @desc    Get AI-powered spending insights
// @access  Private
router.get("/insights", auth, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const transactions = await Transaction.find({
      user: req.user.id,
      createdAt: { $gte: thirtyDaysAgo }
    }).sort({ createdAt: -1 });

    const userBudgets = {
      Food: 15000, Transportation: 8000, Entertainment: 5000,
      Health: 5000, Shopping: 10000, Bills: 7000, Education: 3000
    };

    const insights = await aiService.getInsights();
    res.json({
      insights,
      totalTransactions: transactions.length,
      analysisPeriod: "Last 30 days"
    });
    console.log(`${new Date().toISOString()} - [GET /ai/insights] Successfully generated insights for ${req.user.id}`);
  } catch (error) {
    console.error('Insights generation error:', error);
    res.status(500).json({ message: "Failed to generate insights" });
  }
});


// @route   POST /api/ai/chat
// @desc    Chat with AI about expenses
// @access  Private
router.post("/chat", [
  auth,
  [
    check("query", "Query is required").not().isEmpty()
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { query } = req.body;
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const transactions = await Transaction.find({
      user: req.user.id,
      createdAt: { $gte: threeMonthsAgo }
    }).sort({ createdAt: -1 }).limit(50).lean();

    const userContext = {
      totalTransactions: transactions.length,
      userId: req.user.id
    };

    if (!transactions || transactions.length === 0) {
      console.log(`${new Date().toISOString()} - No transactions found, using empty array`);
      transactions = [];
    }

    const response = await aiService.chatWithExpenses(query, transactions, userContext);

    res.json({
      query,
      response: response.response || response,
      timestamp: new Date().toISOString()
    });
    console.log(`${new Date().toISOString()} - [POST /ai/chat] Successfully responded to query: ${query}`);
  } catch (error) {
    console.error(`${new Date().toISOString()} - AI Chat error:`, error);
    res.status(500).json({
      message: "Sorry, I couldn't process your question right now.",
      response: "I'm experiencing technical difficulties. Please try again later."
    });
  }
});

// @route   GET /api/ai/predictions
// @desc    Get AI spending predictions
// @access  Private
router.get("/predictions", auth, async (req, res) => {
  try {
    const { category } = req.query;
    if (category && !['Food', 'Transportation', 'Entertainment', 'Health', 'Shopping', 'Bills', 'Education', 'Others'].includes(category)) {
      return res.status(400).json({ msg: "Invalid category" });
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const transactions = await Transaction.find({
      user: req.user.id,
      createdAt: { $gte: sixMonthsAgo },
      type: 'expense'
    });

    const prediction = await aiService.getPredictions(category);
    res.json({
      predictedAmount: prediction.predictedAmount,
      category: category || 'overall',
      confidence: prediction.confidence,
      period: "next month"
    });
    console.log(`${new Date().toISOString()} - [GET /ai/predictions] Successfully predicted for ${category || 'overall'}`);
  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({
      message: "Failed to generate predictions",
      predictedAmount: 0
    });
  }
});

// @route   GET /api/ai/analytics
// @desc    Get comprehensive AI analytics for dashboard
// @access  Private
router.get("/analytics", auth, async (req, res) => {
  try {
    const now = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const transactions = await Transaction.find({
      user: req.user.id,
      createdAt: { $gte: threeMonthsAgo }
    }).lean();

    const currentMonthTransactions = transactions.filter(t =>
      new Date(t.createdAt) >= currentMonth
    );

    const totalSpent = currentMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const totalIncome = currentMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const balance = totalIncome - totalSpent;

    const categoryBreakdown = currentMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        const category = t.category || 'Others';
        acc[category] = (acc[category] || 0) + Math.abs(t.amount);
        return acc;
      }, {});

    const generateInsights = (transactions) => {
      const insights = [];
      const categories = Object.keys(categoryBreakdown);

      if (categories.length > 0) {
        const topCategory = categories.reduce((a, b) =>
          categoryBreakdown[a] > categoryBreakdown[b] ? a : b
        );
        insights.push(`Your highest spending category this month is ${topCategory} (₹${categoryBreakdown[topCategory].toFixed(2)})`);
      }

      if (totalSpent > totalIncome) {
        insights.push("You're spending more than your income this month. Consider reviewing your expenses.");
      } else if (totalIncome - totalSpent > totalIncome * 0.2) {
        insights.push("Great job! You're saving more than 20% of your income.");
      }

      const weeklySpending = currentMonthTransactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
          const day = new Date(t.createdAt).getDay();
          const isWeekend = day === 0 || day === 6;
          if (isWeekend) acc.weekend += Math.abs(t.amount);
          else acc.weekday += Math.abs(t.amount);
          return acc;
        }, { weekend: 0, weekday: 0 });

      if (weeklySpending.weekend > weeklySpending.weekday * 0.4) {
        insights.push("You tend to spend more on weekends. Consider setting a weekend budget.");
      }

      return insights;
    };

    const predictRemainingSpending = (transactions) => {
      if (currentMonthTransactions.length === 0) return 0;

      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysPassed = now.getDate();
      const daysRemaining = daysInMonth - daysPassed;

      if (daysRemaining <= 0) return 0;

      const avgDailySpending = totalSpent / daysPassed;

      const predictedRemaining = avgDailySpending * daysRemaining;

      return Math.round(predictedRemaining);
    };

    const monthlyBudget = 50000;
    const budgetUsedPercentage = totalSpent > 0 ? (totalSpent / monthlyBudget) * 100 : 0;

    const response = {
      summary: {
        totalSpent: Math.round(totalSpent),
        totalIncome: Math.round(totalIncome),
        balance: Math.round(balance),
        transactionCount: currentMonthTransactions.length,
        budgetUsed: Math.round(budgetUsedPercentage * 100) / 100,
        monthlyBudget
      },
      categoryBreakdown,
      insights: {
        messages: generateInsights(currentMonthTransactions),
        period: 'current_month',
        generatedAt: new Date().toISOString()
      },
      predictions: {
        remainingMonthSpending: predictRemainingSpending(transactions),
        budgetStatus: budgetUsedPercentage > 100 ? 'over_budget' :
                      budgetUsedPercentage > 80 ? 'approaching_limit' : 'within_budget',
        projectedMonthEnd: Math.round(totalSpent + predictRemainingSpending(transactions))
      }
    };

    res.json(response);
  } catch (error) {
    console.error(`${new Date().toISOString()} - Analytics error:`, error.message, error.stack);
    res.status(500).json({
      message: 'Failed to generate analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;