const Wallet = require("../../model/walletModel")
const User = require("../../model/userModel")
const Order = require("../../model/orderModel")
const statusCode = require("../../utils/httpStatusCodes")

const loadWalletManagement = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = 10
    const skip = (page - 1) * limit
    const searchQuery = req.query.search || ""
    const transactionType = req.query.type || "all"

    const userQuery = {}
    if (searchQuery) {
      userQuery.$or = [
        { fullName: { $regex: searchQuery, $options: "i" } },
        { email: { $regex: searchQuery, $options: "i" } },
      ]
    }

    const users = await User.find(userQuery).select("_id fullName email").lean()
    const userIds = users.map((user) => user._id)

    const wallets = await Wallet.find({ userId: { $in: userIds } })
      .populate("userId", "fullName email")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)

    const totalWallets = await Wallet.countDocuments({ userId: { $in: userIds } })
    const totalPages = Math.ceil(totalWallets / limit)

    const stats = await Wallet.aggregate([
      { $match: { userId: { $in: userIds } } },
      {
        $group: {
          _id: null,
          totalBalance: { $sum: "$balance" },
          totalWallets: { $sum: 1 },
          totalTransactions: { $sum: { $size: "$transactions" } },
        },
      },
    ])

    const walletStats = stats[0] || {
      totalBalance: 0,
      totalWallets: 0,
      totalTransactions: 0,
    }

    res.render("admin/wallet-management", {
      wallets,
      currentPage: page,
      totalPages,
      totalWallets,
      searchQuery,
      transactionType,
      stats: walletStats,
    })
  } catch (error) {
    console.log("Error loading wallet management:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).render("admin/error", {
      error: "Failed to load wallet management",
    })
  }
}

const getWalletTransactions = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = 20
    const skip = (page - 1) * limit
    const transactionType = req.query.type || "all"
    const searchQuery = req.query.search || ""

    const pipeline = [
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $unwind: "$transactions" },
      {
        $lookup: {
          from: "orders",
          localField: "transactions.orderId",
          foreignField: "_id",
          as: "order",
        },
      },
    ]

    if (searchQuery) {
      pipeline.push({
        $match: {
          $or: [
            { "user.fullName": { $regex: searchQuery, $options: "i" } },
            { "user.email": { $regex: searchQuery, $options: "i" } },
            { "order.orderID": { $regex: searchQuery, $options: "i" } },
          ],
        },
      })
    }

    if (transactionType !== "all") {
      pipeline.push({
        $match: { "transactions.type": transactionType },
      })
    }

    pipeline.push({ $sort: { "transactions.date": -1 } }, { $skip: skip }, { $limit: limit })

    pipeline.push({
      $project: {
        _id: "$transactions._id",
        type: "$transactions.type",
        amount: "$transactions.amount",
        reason: "$transactions.reason",
        date: "$transactions.date",
        orderId: { $arrayElemAt: ["$order.orderID", 0] },
        orderObjectId: { $arrayElemAt: ["$order._id", 0] },
        user: {
          _id: "$user._id",
          fullName: "$user.fullName",
          email: "$user.email",
        },
        walletBalance: "$balance",
      },
    })

    const transactions = await Wallet.aggregate(pipeline)

    const countPipeline = [
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      { $unwind: "$transactions" },
    ]

    if (searchQuery) {
      countPipeline.push({
        $match: {
          $or: [
            { "user.fullName": { $regex: searchQuery, $options: "i" } },
            { "user.email": { $regex: searchQuery, $options: "i" } },
          ],
        },
      })
    }

    if (transactionType !== "all") {
      countPipeline.push({
        $match: { "transactions.type": transactionType },
      })
    }

    countPipeline.push({ $count: "total" })

    const countResult = await Wallet.aggregate(countPipeline)
    const totalTransactions = countResult[0]?.total || 0
    const totalPages = Math.ceil(totalTransactions / limit)

    res.status(statusCode.OK).json({
      success: true,
      transactions,
      currentPage: page,
      totalPages,
      totalTransactions,
      transactionType,
    })
  } catch (error) {
    console.log("Error getting wallet transactions:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get wallet transactions",
    })
  }
}

const getUserWalletDetails = async (req, res) => {
  try {
    const userId = req.params.userId

    const wallet = await Wallet.findOne({ userId }).populate("userId", "fullName email phoneNumber").populate({
      path: "transactions.orderId",
      select: "orderID orderDate finalAmount",
    })

    if (!wallet) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Wallet not found",
      })
    }

    const stats = {
      totalCredits: wallet.transactions.filter((t) => t.type === "credit").reduce((sum, t) => sum + t.amount, 0),
      totalDebits: wallet.transactions.filter((t) => t.type === "debit").reduce((sum, t) => sum + t.amount, 0),
      totalAdded: wallet.transactions.filter((t) => t.type === "add").reduce((sum, t) => sum + t.amount, 0),
      totalTransactions: wallet.transactions.length,
    }

    res.status(statusCode.OK).json({
      success: true,
      wallet,
      stats,
    })
  } catch (error) {
    console.log("Error getting user wallet details:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get wallet details",
    })
  }
}

const addMoneyToWallet = async (req, res) => {
  try {
    const userId = req.params.userId
    const { amount, reason } = req.body

    if (!amount || amount <= 0 || amount > 100000) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Invalid amount. Amount should be between ₹1 and ₹100,000",
      })
    }

    let wallet = await Wallet.findOne({ userId })
    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0, transactions: [] })
    }

    wallet.transactions.push({
      type: "add",
      amount: amount,
      reason: reason || "Money added by admin",
      date: new Date(),
    })

    wallet.balance += amount
    await wallet.save()

    res.status(statusCode.OK).json({
      success: true,
      message: `₹${amount} added to user's wallet successfully`,
      newBalance: wallet.balance,
    })
  } catch (error) {
    console.log("Error adding money to wallet:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to add money to wallet",
    })
  }
}

const deductMoneyFromWallet = async (req, res) => {
  try {
    const userId = req.params.userId
    const { amount, reason } = req.body

    if (!amount || amount <= 0) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Invalid amount",
      })
    }

    const wallet = await Wallet.findOne({ userId })
    if (!wallet) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Wallet not found",
      })
    }

    if (wallet.balance < amount) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Insufficient wallet balance",
      })
    }

    wallet.transactions.push({
      type: "debit",
      amount: amount,
      reason: reason || "Money deducted by admin",
      date: new Date(),
    })

    wallet.balance -= amount
    await wallet.save()

    res.status(statusCode.OK).json({
      success: true,
      message: `₹${amount} deducted from user's wallet successfully`,
      newBalance: wallet.balance,
    })
  } catch (error) {
    console.log("Error deducting money from wallet:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to deduct money from wallet",
    })
  }
}

const getWalletAnalytics = async (req, res) => {
  try {
    const { period = "month" } = req.query

    let dateFilter = {}
    const now = new Date()

    switch (period) {
      case "week":
        dateFilter = {
          $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        }
        break
      case "month":
        dateFilter = {
          $gte: new Date(now.getFullYear(), now.getMonth(), 1),
        }
        break
      case "year":
        dateFilter = {
          $gte: new Date(now.getFullYear(), 0, 1),
        }
        break
    }

    const analytics = await Wallet.aggregate([
      { $unwind: "$transactions" },
      {
        $match: {
          "transactions.date": dateFilter,
        },
      },
      {
        $group: {
          _id: "$transactions.type",
          totalAmount: { $sum: "$transactions.amount" },
          count: { $sum: 1 },
        },
      },
    ])

    const overallStats = await Wallet.aggregate([
      {
        $group: {
          _id: null,
          totalWallets: { $sum: 1 },
          totalBalance: { $sum: "$balance" },
          averageBalance: { $avg: "$balance" },
          totalTransactions: { $sum: { $size: "$transactions" } },
        },
      },
    ])

    res.status(statusCode.OK).json({
      success: true,
      analytics,
      overallStats: overallStats[0] || {},
      period,
    })
  } catch (error) {
    console.log("Error getting wallet analytics:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get wallet analytics",
    })
  }
}

module.exports = {
  loadWalletManagement,
  getWalletTransactions,
  getUserWalletDetails,
  addMoneyToWallet,
  deductMoneyFromWallet,
  getWalletAnalytics,
}
