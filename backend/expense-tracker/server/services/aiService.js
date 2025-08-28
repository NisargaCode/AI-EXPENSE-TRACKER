// backend/server/services/aiService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

class AIService {
  constructor() {
    // Check if API key is available
    if (!process.env.GEMINI_API_KEY) {
      console.error(`${new Date().toISOString()} - ❌ GEMINI_API_KEY is not set in environment variables`);
      this.genAI = null;
      this.model = null;
    } else {
      try {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log(`${new Date().toISOString()} - ✅ Gemini AI initialized successfully`);
      } catch (error) {
        console.error(`${new Date().toISOString()} - ❌ Failed to initialize Gemini AI:`, error.message);
        this.genAI = null;
        this.model = null;
      }
    }
    
    // Predefined categories
    this.categories = ['Food', 'Transportation', 'Entertainment', 'Health', 'Shopping', 'Bills', 'Education', 'Others'];
  }

  // Check if AI is available
  isAIAvailable() {
    return this.model !== null;
  }

  // AI-powered expense categorization
  async categorizeExpense(description, amount) {
    if (!this.isAIAvailable()) {
      console.warn(`${new Date().toISOString()} - AI not available, using fallback categorization for:`, description);
      return this.fallbackCategorization(description);
    }

    try {
      const prompt = `
        Analyze this expense and categorize it:
        Description: "${description}"
        Amount: ₹${amount}
        
        Choose the MOST appropriate category from: ${this.categories.join(', ')}
        
        Return ONLY the category name, nothing else.
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const category = response.text().trim();
      
      console.log(`${new Date().toISOString()} - AI raw category response:`, category);
      if (this.categories.includes(category)) {
        return { category, confidence: 0.9 };
      } else {
        console.warn(`${new Date().toISOString()} - Invalid AI category: ${category}, falling back to Others`);
        return { category: 'Others', confidence: 0.5 };
      }
    } catch (error) {
      console.error(`${new Date().toISOString()} - AI Categorization failed for "${description}":`, error.message);
      return this.fallbackCategorization(description);
    }
  }

  // Fallback categorization when AI is not available
  fallbackCategorization(description) {
    const desc = description.toLowerCase();
    let category = 'Others';
    let confidence = 0.3;

    if (desc.includes('food') || desc.includes('restaurant') || desc.includes('zomato') || desc.includes('swiggy')) {
      category = 'Food'; confidence = 0.7;
    } else if (desc.includes('uber') || desc.includes('taxi') || desc.includes('bus') || desc.includes('transport')) {
      category = 'Transportation'; confidence = 0.7;
    } else if (desc.includes('netflix') || desc.includes('movie') || desc.includes('entertainment')) {
      category = 'Entertainment'; confidence = 0.7;
    } else if (desc.includes('bill') || desc.includes('electricity') || desc.includes('water')) {
      category = 'Bills'; confidence = 0.7;
    } else if (desc.includes('amazon') || desc.includes('shop') || desc.includes('store')) {
      category = 'Shopping'; confidence = 0.7;
    }

    console.log(`${new Date().toISOString()} - Fallback category for "${description}":`, { category, confidence });
    return { category, confidence };
  }

  // Generate spending insights
  async generateInsights(transactions, userBudgets) {
    const totalSpent = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const categorySpending = this.calculateCategorySpending(transactions);

    if (!this.isAIAvailable()) {
      return this.generateDefaultInsights(transactions, categorySpending, totalSpent);
    }

    try {
      const prompt = `
        Analyze this user's spending pattern and provide 3 key insights:
        
        Total Monthly Spend: ₹${totalSpent}
        Category Breakdown: ${JSON.stringify(categorySpending)}
        Budgets: ${JSON.stringify(userBudgets)}
        
        Provide insights in this JSON format:
        {
          "insights": [
            {
              "type": "alert|success|prediction",
              "message": "Brief insight message",
              "category": "category_name"
            }
          ]
        }
        
        Focus on:
        - Budget overruns or good savings
        - Unusual spending patterns
        - Predictions based on trends
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      
      try {
        const insights = JSON.parse(response.text());
        return insights.insights || [];
      } catch (parseError) {
        return this.generateDefaultInsights(transactions, categorySpending, totalSpent);
      }
    } catch (error) {
      console.error('AI Insights generation failed:', error.message);
      return this.generateDefaultInsights(transactions, categorySpending, totalSpent);
    }
  }

  // Chat with expenses
  async chatWithExpenses(query, transactions = [], userContext = {}) {
    if (!this.isAIAvailable()) {
      return {
        query,
        response: "I'm sorry, AI features are currently unavailable. Please check your API configuration.",
        timestamp: new Date().toISOString()
      };
    }

    try {
      console.log(`${new Date().toISOString()} - Received transactions in chatWithExpenses:`, JSON.stringify(transactions));
      if (!Array.isArray(transactions)) {
        console.log(`${new Date().toISOString()} - Invalid transactions data, defaulting to empty array`);
        transactions = [];
      }

      let totalSpent = 0;
      if (Array.isArray(transactions)) {
        totalSpent = transactions.reduce((sum, t) => {
          console.log(`${new Date().toISOString()} - Processing transaction:`, JSON.stringify(t));
          return sum + (t && typeof t.amount === 'number' ? Math.abs(t.amount) : 0);
        }, 0);
      } else {
        console.log(`${new Date().toISOString()} - Transactions not an array, defaulting totalSpent to 0`);
      }

      const categorySpending = this.calculateCategorySpending(transactions);
      const recentTransactions = transactions.slice(0, 10);

      const prompt = `
        You are a personal financial advisor AI. Answer the user's query about their expenses.
        
        User Query: "${query}"
        
        User's Financial Data:
        - Total Spent: ₹${totalSpent}
        - Category Spending: ${JSON.stringify(categorySpending)}
        - Recent Transactions: ${JSON.stringify(recentTransactions)}
        - User Context: ${JSON.stringify(userContext)}
        
        Provide a helpful, conversational response. Be specific with numbers and actionable advice.
        Keep the response under 100 words and friendly in tone.
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text().trim();
      return {
        query,
        response: responseText,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`${new Date().toISOString()} - AI Chat failed for "${query}":`, error.message, error.stack);
      return {
        query,
        response: "I'm sorry, I couldn't process your question right now. Please try again later.",
        timestamp: new Date().toISOString()
      };
    }
  }

  // Predict future spending
  async predictSpending(transactions, category = null) {
    if (!this.isAIAvailable()) {
      const monthlyData = this.calculateMonthlyTrends(transactions, category);
      const amounts = Object.values(monthlyData);
      if (amounts.length === 0) return 0;
      
      const average = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
      return Math.round(average);
    }

    try {
      const monthlyData = this.calculateMonthlyTrends(transactions, category);
      
      const prompt = `
        Based on this spending history, predict next month's spending:
        ${JSON.stringify(monthlyData)}
        
        Return only a number (predicted amount in rupees) without currency symbol.
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const prediction = parseFloat(response.text().replace(/[^\d.]/g, ''));
      
      return isNaN(prediction) ? 0 : prediction;
    } catch (error) {
      console.error('AI Prediction failed:', error.message);
      return 0;
    }
  }

  // Helper methods
  calculateCategorySpending(transactions) {
    return transactions.reduce((acc, transaction) => {
      const category = transaction.category || 'Others';
      const amount = Math.abs(transaction.amount);
      acc[category] = (acc[category] || 0) + amount;
      return acc;
    }, {});
  }

  calculateMonthlyTrends(transactions, category) {
    const monthlySpending = {};
    transactions.forEach(transaction => {
      if (category && transaction.category !== category) return;
      
      const month = new Date(transaction.createdAt).toISOString().substring(0, 7);
      monthlySpending[month] = (monthlySpending[month] || 0) + Math.abs(transaction.amount);
    });
    return monthlySpending;
  }

  generateDefaultInsights(transactions, categorySpending, totalSpent) {
    const insights = [];
    
    if (totalSpent > 40000) {
      insights.push({
        type: 'alert',
        message: `You've spent ₹${totalSpent.toFixed(0)} this month, which is quite high. Consider reviewing your expenses.`,
        category: 'general'
      });
    }
    
    const topCategory = Object.keys(categorySpending).reduce((a, b) => 
      categorySpending[a] > categorySpending[b] ? a : b, 'Others');
    
    if (topCategory && categorySpending[topCategory] > 15000) {
      insights.push({
        type: 'prediction',
        message: `Your top spending category is ${topCategory} with ₹${categorySpending[topCategory].toFixed(0)}.`,
        category: topCategory
      });
    }
    
    insights.push({
      type: 'success',
      message: 'Keep tracking your expenses to maintain good financial habits!',
      category: 'general'
    });
    
    return insights;
  }

  // Fetch analytics from the backend
  async getAnalytics() {
    try {
      const apiClient = require('axios').create({
        baseURL: process.env.API_BASE_URL || 'http://localhost:5000/api',
        withCredentials: true
      });
      // Corrected API path
      const response = await apiClient.get('/ai/analytics');
      return response.data;
    } catch (error) {
      console.error(`${new Date().toISOString()} - Failed to fetch analytics:`, error.message);
      return {
        summary: { totalSpent: 0, totalIncome: 0, balance: 0, transactionCount: 0 },
        categoryBreakdown: {},
        insights: [],
        predictions: { remainingMonthSpending: 0, budgetStatus: 'unknown' }
      };
    }
  }
}

module.exports = new AIService();
