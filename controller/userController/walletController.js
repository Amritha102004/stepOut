const User = require("../../model/userModel")
const Wallet = require("../../model/walletModel")
const Order = require("../../model/orderModel")
const mongoose = require("mongoose")
const statusCode = require("../../utils/httpStatusCodes")

const loadWallet = async (req, res) => {
  try {
    const userId = req.session.user._id
    const page = Number.parseInt(req.query.page) || 1
    const limit = 10
    const skip = (page - 1) * limit
    const transactionType = req.query.type || "all"

    let wallet = await Wallet.findOne({ userId }).populate({
      path: "transactions.orderId",
      select: "orderID orderDate",
    })

    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0, transactions: [] })
      await wallet.save()
    }

    let filteredTransactions = wallet.transactions
    if (transactionType !== "all") {
      filteredTransactions = wallet.transactions.filter((t) => t.type === transactionType)
    }

    filteredTransactions.sort((a, b) => new Date(b.date) - new Date(a.date))

    const totalTransactions = filteredTransactions.length
    const paginatedTransactions = filteredTransactions.slice(skip, skip + limit)
    const totalPages = Math.ceil(totalTransactions / limit)

    const stats = {
      totalCredits: wallet.transactions.filter((t) => t.type === "credit").reduce((sum, t) => sum + t.amount, 0),
      totalDebits: wallet.transactions.filter((t) => t.type === "debit").reduce((sum, t) => sum + t.amount, 0),
      totalTransactions: wallet.transactions.length,
    }

    res.render("user/wallet", {
      req,
      wallet,
      transactions: paginatedTransactions,
      currentPage: page,
      totalPages,
      totalTransactions,
      transactionType,
      stats,
      activePage: "wallet",
    })
  } catch (error) {
    console.log("Error loading wallet:", error)
    req.flash("error_msg", "Failed to load wallet")
    res.status(statusCode.INTERNAL_SERVER_ERROR).redirect("/account")
  }
}

const addMoney = async (req, res) => {
  try {
    const userId = req.session.user._id
    const { amount } = req.body

    if (!amount || amount <= 0 || amount > 50000) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Invalid amount. Amount should be between ₹1 and ₹50,000",
      })
    }

    let wallet = await Wallet.findOne({ userId })
    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0, transactions: [] })
    }
    wallet.transactions.push({
      type: "add",
      amount: amount,
      reason: "Money added to wallet",
      date: new Date(),
    })

    wallet.balance += amount
    await wallet.save()

    res.status(statusCode.OK).json({
      success: true,
      message: "Money added to wallet successfully",
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

const processRefund = async (userId, amount, orderId, reason, refundedItems = []) => {
  try {
 
    let wallet = await Wallet.findOne({ userId })
    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0, transactions: [] })
    }

    wallet.transactions.push({
      type: "credit",
      amount: amount,
      orderId: orderId,
      reason: reason,
      refundedItems: refundedItems,
      date: new Date(),
    })

    wallet.balance += amount
    await wallet.save()

    console.log(`Refund processed: ₹${amount} added to user ${userId} wallet`)
    return { success: true, newBalance: wallet.balance }
  } catch (error) {
    console.log("Error processing refund:", error)
    return { success: false, error: error.message }
  }
}

const useWalletBalance = async (userId, amount, orderId, reason) => {
  try {
    const wallet = await Wallet.findOne({ userId })

    if (!wallet || wallet.balance < amount) {
      return { success: false, message: "Insufficient wallet balance" }
    }

    wallet.transactions.push({
      type: "debit",
      amount: amount,
      orderId: orderId,
      reason: reason,
      date: new Date(),
    })

    wallet.balance -= amount
    await wallet.save()

    return { success: true, newBalance: wallet.balance }
  } catch (error) {
    console.log("Error using wallet balance:", error)
    return { success: false, error: error.message }
  }
}

const getWalletBalance = async (req, res) => {
  try {
    const userId = req.session.user._id

    let wallet = await Wallet.findOne({ userId })
    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0, transactions: [] })
      await wallet.save()
    }

    res.status(statusCode.OK).json({
      success: true,
      balance: wallet.balance,
    })
  } catch (error) {
    console.log("Error getting wallet balance:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get wallet balance",
    })
  }
}

const getTransactionDetails = async (req, res) => {
  try {
    const userId = req.session.user._id
    const { transactionId } = req.params

    const wallet = await Wallet.findOne({ userId }).populate({
      path: "transactions.orderId",
      select: "orderID orderDate products",
      populate: {
        path: "products.product",
        select: "name images",
      },
    })

    if (!wallet) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Wallet not found",
      })
    }

    const transaction = wallet.transactions.id(transactionId)
    if (!transaction) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Transaction not found",
      })
    }

    res.status(statusCode.OK).json({
      success: true,
      transaction,
    })
  } catch (error) {
    console.log("Error getting transaction details:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get transaction details",
    })
  }
}

module.exports = {
  loadWallet,
  addMoney,
  processRefund,
  useWalletBalance,
  getWalletBalance,
  getTransactionDetails,
}
