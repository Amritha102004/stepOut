const Order = require("../../model/orderModel")
const User = require("../../model/userModel")
const Product = require("../../model/productModel")
const Address = require("../../model/addressModel")
const Wallet = require("../../model/walletModel")
const PDFDocument = require("pdfkit")
const statusCode = require("../../utils/httpStatusCodes")
const ExcelJS = require("exceljs")


const recalculateOrderTotals = async (order) => {
  let newTotalAmount = 0
  let activeItemsCount = 0

  order.products.forEach((item) => {
    if (!["cancelled", "returned"].includes(item.status)) {
      newTotalAmount += item.variant.salePrice * item.quantity
      activeItemsCount++
    }
  })

  if (activeItemsCount === 0) {
    order.totalAmount = 0
    order.finalAmount = 0
    return order
  }

  const taxAmount = Math.round(newTotalAmount * 0.18)

  const applicableDiscount = Math.min(order.discount || 0, newTotalAmount)

  const newFinalAmount = newTotalAmount + taxAmount - applicableDiscount - (order.walletAmountUsed || 0)

  order.totalAmount = newTotalAmount
  order.finalAmount = Math.max(0, newFinalAmount)

  return order
}

const calculateProportionalRefund = (order, refundItems) => {
  const originalTotalAmount = order.products.reduce((sum, item) => sum + (item.variant.salePrice * item.quantity), 0)
  const refundItemsAmount = refundItems.reduce((sum, item) => sum + (item.variant.salePrice * item.quantity), 0)

  if (originalTotalAmount === 0) return 0

  const proportionOfOrder = refundItemsAmount / originalTotalAmount

  const proportionalGST = Math.round(refundItemsAmount * 0.18)

  const proportionalDiscount = Math.round((order.discount || 0) * proportionOfOrder)

  const proportionalWalletUsed = Math.round((order.walletAmountUsed || 0) * proportionOfOrder)

  const refundAmount = refundItemsAmount + proportionalGST - proportionalDiscount - proportionalWalletUsed

  console.log(`Proportional refund calculation:
    - Items amount: ₹${refundItemsAmount}
    - Proportional GST: ₹${proportionalGST}
    - Proportional discount: ₹${proportionalDiscount}
    - Proportional wallet used: ₹${proportionalWalletUsed}
    - Final refund: ₹${Math.max(0, refundAmount)}`)

  return Math.max(0, refundAmount)
}

const calculateItemProportionalRefund = (order, item) => {
  return calculateProportionalRefund(order, [item])
}

const loadOrders = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = 5
    const skip = (page - 1) * limit
    const query = {}
    const searchQuery = req.query.search || ""
    const statusFilter = req.query.status || ""
    const paymentFilter = req.query.payment || ""
    const dateFilter = req.query.date || ""
    const sortBy = req.query.sort || "newest"

    if (searchQuery) {
      query.$or = [
        { orderID: { $regex: searchQuery, $options: "i" } },
        { "user.name": { $regex: searchQuery, $options: "i" } },
        { "user.email": { $regex: searchQuery, $options: "i" } },
      ]
    }

    if (statusFilter) {
      query.orderStatus = statusFilter
    }

    if (paymentFilter) {
      query.paymentMethod = paymentFilter
    }

    if (dateFilter) {
      const now = new Date()
      let startDate, endDate

      switch (dateFilter) {
        case "today":
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
          break
        case "week":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          endDate = now
          break
        case "month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
          break
        case "custom":
          if (req.query.fromDate) startDate = new Date(req.query.fromDate)
          if (req.query.toDate) endDate = new Date(req.query.toDate)
          break
      }

      if (startDate || endDate) {
        query.orderDate = {}
        if (startDate) query.orderDate.$gte = startDate
        if (endDate) query.orderDate.$lt = endDate
      }
    }

    let sortOptions = {}
    switch (sortBy) {
      case "oldest":
        sortOptions = { orderDate: 1 }
        break
      case "amount_high":
        sortOptions = { finalAmount: -1 }
        break
      case "amount_low":
        sortOptions = { finalAmount: 1 }
        break
      default:
        sortOptions = { orderDate: -1 }
    }

    if (req.query.export === "true") {
      return await exportOrders(req, res, query, sortOptions)
    }

    const orders = await Order.find(query)
      .populate("user", "fullName email")
      .populate("address")
      .populate({
        path: "products.product",
        select: "name images",
      })
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean()

    const totalOrders = await Order.countDocuments(query)
    const totalPages = Math.ceil(totalOrders / limit)

    const buildQueryString = () => {
      const params = new URLSearchParams()
      if (searchQuery) params.append("search", searchQuery)
      if (statusFilter) params.append("status", statusFilter)
      if (paymentFilter) params.append("payment", paymentFilter)
      if (dateFilter) params.append("date", dateFilter)
      if (sortBy) params.append("sort", sortBy)
      if (req.query.fromDate) params.append("fromDate", req.query.fromDate)
      if (req.query.toDate) params.append("toDate", req.query.toDate)
      return params.toString() ? "&" + params.toString() : ""
    }

    res.render("admin/orders", {
      orders,
      currentPage: page,
      totalPages,
      totalOrders,
      searchQuery,
      statusFilter,
      paymentFilter,
      dateFilter,
      sortBy,
      fromDate: req.query.fromDate || "",
      toDate: req.query.toDate || "",
      limit,
      buildQueryString,
    })
  } catch (error) {
    console.log("Error loading admin orders:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).render("admin/error", {
      error: "Failed to load orders",
    })
  }
}

const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId

    const order = await Order.findById(orderId)
      .populate("user", "fullName email")
      .populate("address")
      .populate({
        path: "products.product",
        select: "name images",
      })
      .lean()

    if (!order) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      })
    }

    const wallet = await Wallet.findOne({ userId: order.user._id })

    order.userWalletBalance = wallet ? wallet.balance : 0

    res.status(statusCode.OK).json({
      success: true,
      order,
    })
  } catch (error) {
    console.log("Error getting order details:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get order details",
    })
  }
}

const updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.orderId
    const { status } = req.body

    const validStatuses = ["pending", "confirmed", "shipped", "out for delivery", "delivered", "cancelled", "returned"]
    if (!validStatuses.includes(status)) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Invalid status",
      })
    }

    const order = await Order.findById(orderId).populate("user", "_id fullName email")
    if (!order) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      })
    }

    const previousStatus = order.orderStatus
    order.orderStatus = status

    if (status === "delivered") {
      order.deliveredAt = new Date()

      order.products.forEach((item) => {
        if (["shipped", "out for delivery", "confirmed"].includes(item.status)) {
          item.status = "delivered"
        }
      })

      if (order.paymentMethod === "COD" && order.paymentStatus === "pending") {
        order.paymentStatus = "completed"
        console.log(`COD payment status updated to completed for order ${order.orderID}`)
      }
    } else if (status === "cancelled") {
      order.products.forEach((item) => {
        if (["pending", "confirmed"].includes(item.status)) {
          item.status = status
          item.cancelledAt = new Date()
          item.cancellationReason = "Cancelled by admin"
        }
      })

      await recalculateOrderTotals(order)
      await restoreInventory(order)

      if (order.paymentMethod !== "COD") {
        const cancelledItems = order.products.filter(item => item.status === "cancelled")
        const refundAmount = calculateProportionalRefund(order, cancelledItems)

        if (refundAmount > 0) {
          await processRefundToWallet(order, "Order cancelled by admin", refundAmount)
        }
      }
    } else if (status === "returned") {
      order.products.forEach((item) => {
        if (item.status !== "cancelled") {
          item.status = status
          item.returnedAt = new Date()
          item.returnReason = "Returned - approved by admin"
        }
      })

      await recalculateOrderTotals(order)
      await restoreInventory(order)

      const returnedItems = order.products.filter(item => item.status === "returned")
      const refundAmount = calculateProportionalRefund(order, returnedItems)

      if (refundAmount > 0) {
        await processRefundToWallet(order, "Order return approved by admin", refundAmount)
      }
    } else {
      order.products.forEach((item) => {
        if (item.status === "pending" || (status === "shipped" && item.status === "confirmed")) {
          item.status = status
        }
      })
    }

    await order.save()

    res.status(statusCode.OK).json({
      success: true,
      message: `Order status updated to ${status}`,
    })
  } catch (error) {
    console.log("Error updating order status:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update order status",
    })
  }
}

const updateItemStatus = async (req, res) => {
  try {
    const { orderId } = req.params
    const { productId, size, status } = req.body

    const validStatuses = ["pending", "confirmed", "shipped", "out for delivery", "delivered", "cancelled", "returned"]
    if (!validStatuses.includes(status)) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Invalid status",
      })
    }

    const order = await Order.findById(orderId).populate("products.product")
    if (!order) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      })
    }

    const itemIndex = order.products.findIndex(
      (item) => item.product._id.toString() === productId && item.variant.size === size,
    )

    if (itemIndex === -1) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Item not found in order",
      })
    }

    const item = order.products[itemIndex]
    const previousStatus = item.status
    item.status = status

    if (status === "delivered") {
      item.deliveredAt = new Date()

      if (order.paymentMethod === "COD" && order.paymentStatus === "pending") {
        const allItemsDelivered = order.products.every((p) => ["delivered", "cancelled", "returned"].includes(p.status))
        if (allItemsDelivered) {
          order.paymentStatus = "completed"
          console.log(`COD payment status updated to completed for order ${order.orderID}`)
        }
      }
    } else if (status === "cancelled") {
      item.cancelledAt = new Date()
      item.cancellationReason = "Cancelled by admin"

      const product = await Product.findById(productId)
      if (product) {
        const variantIndex = product.variants.findIndex((v) => v.size === size)
        if (variantIndex !== -1) {
          product.variants[variantIndex].varientquantity += item.quantity
          await product.save()
        }
      }

      if (order.paymentMethod !== "COD") {
        const itemRefundAmount = calculateItemProportionalRefund(order, item)
        console.log(`Item cancellation refund amount: ₹${itemRefundAmount}`)

        if (itemRefundAmount > 0) {
          await processItemRefund(order, item, itemRefundAmount, "Item cancelled by admin")
        }
      }
    } else if (status === "returned") {
      item.returnedAt = new Date()
      item.returnReason = "Returned - approved by admin"

      const product = await Product.findById(productId)
      if (product) {
        const variantIndex = product.variants.findIndex((v) => v.size === size)
        if (variantIndex !== -1) {
          product.variants[variantIndex].varientquantity += item.quantity
          await product.save()
        }
      }

      if (order.paymentMethod === "online" || order.walletAmountUsed > 0) {
        const itemRefundAmount = item.variant.salePrice * item.quantity
        await processItemRefund(order, item, itemRefundAmount, "Item returned - approved by admin")
      }
    }
    if (["cancelled", "returned"].includes(status)) {
      await recalculateOrderTotals(order)
    }

    const allItemStatuses = order.products.map((p) => p.status)
    const uniqueStatuses = [...new Set(allItemStatuses)]

    if (uniqueStatuses.length === 1) {
      order.orderStatus = uniqueStatuses[0]
    } else if (allItemStatuses.every((s) => ["delivered", "cancelled", "returned"].includes(s))) {
      
      if (allItemStatuses.includes("delivered")) {
        order.orderStatus = "delivered"
      } else if (allItemStatuses.every((s) => s === "cancelled")) {
        order.orderStatus = "cancelled"
      } else if (allItemStatuses.every((s) => ["returned", "cancelled"].includes(s))) {
        order.orderStatus = allItemStatuses.includes("returned") ? "returned" : "cancelled"
      }
    } else {
      
      if (allItemStatuses.includes("delivered")) {
        order.orderStatus = "delivered"
      } else if (allItemStatuses.includes("shipped") || allItemStatuses.includes("out for delivery")) {
        order.orderStatus = "shipped"
      } else if (allItemStatuses.includes("confirmed")) {
        order.orderStatus = "confirmed"
      }
    }

    await order.save()

    res.status(statusCode.OK).json({
      success: true,
      message: `Item status updated to ${status}`,
      orderStatus: order.orderStatus,
      finalAmount: order.finalAmount,
    })
  } catch (error) {
    console.log("Error updating item status:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update item status",
    })
  }
}

const approveReturn = async (req, res) => {
  try {
    const orderId = req.params.orderId
    const { reason, itemId } = req.body

    const order = await Order.findById(orderId).populate("user", "_id fullName email")
    if (!order) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      })
    }

    if (itemId) {
      const item = order.products.id(itemId)
      if (!item) {
        return res.status(statusCode.NOT_FOUND).json({
          success: false,
          message: "Item not found",
        })
      }

      if (item.status !== "return_requested") {
        return res.status(statusCode.BAD_REQUEST).json({
          success: false,
          message: "Item is not in return requested status",
        })
      }

      item.status = "returned"
      item.returnApprovedAt = new Date()
      item.returnApprovalReason = reason || "Return approved by admin"

      const product = await Product.findById(item.product)
      if (product) {
        const variantIndex = product.variants.findIndex((v) => v.size === item.variant.size)
        if (variantIndex !== -1) {
          product.variants[variantIndex].varientquantity += item.quantity
          await product.save()
        }
      }

      const itemRefundAmount = calculateItemProportionalRefund(order, item)
      console.log(`Item return refund amount: ₹${itemRefundAmount}`)

      const refundResult = await processItemRefund(order, item, itemRefundAmount, "Item return approved by admin")

      await recalculateOrderTotals(order)
      await order.save()

      if (refundResult.success) {
        res.status(statusCode.OK).json({
          success: true,
          message: `Item return approved and refund of ₹${itemRefundAmount} processed to user's wallet`,
        })
      } else {
        res.status(statusCode.OK).json({
          success: true,
          message: "Item return approved but refund processing failed. Please process refund manually.",
        })
      }
    } else {
      if (order.orderStatus !== "return_requested") {
        return res.status(statusCode.BAD_REQUEST).json({
          success: false,
          message: "Order is not in return requested status",
        })
      }

      order.orderStatus = "returned"
      order.returnApprovedAt = new Date()
      order.returnApprovalReason = reason || "Return approved by admin"

      order.products.forEach((item) => {
        if (item.status === "return_requested") {
          item.status = "returned"
          item.returnApprovedAt = new Date()
        }
      })

      await recalculateOrderTotals(order)
      await order.save()

      await restoreInventory(order)

      const returnedItems = order.products.filter(item => item.status === "returned")
      const refundAmount = calculateProportionalRefund(order, returnedItems)
      console.log(`Full order return refund amount: ₹${refundAmount}`)

      const refundResult = await processRefundToWallet(order, "Return approved - refund processed", refundAmount)

      if (refundResult.success) {
        res.status(statusCode.OK).json({
          success: true,
          message: `Return approved and refund of ₹${refundResult.amount} processed to user's wallet`,
        })
      } else {
        res.status(statusCode.OK).json({
          success: true,
          message: "Return approved but refund processing failed. Please process refund manually.",
        })
      }
    }
  } catch (error) {
    console.log("Error approving return:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to approve return",
    })
  }
}

const rejectReturn = async (req, res) => {
  try {
    const orderId = req.params.orderId
    const { reason, itemId } = req.body

    const order = await Order.findById(orderId)
    if (!order) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      })
    }

    if (itemId) {
      const item = order.products.id(itemId)
      if (!item) {
        return res.status(statusCode.NOT_FOUND).json({
          success: false,
          message: "Item not found",
        })
      }

      if (item.status !== "return_requested") {
        return res.status(statusCode.BAD_REQUEST).json({
          success: false,
          message: "Item is not in return requested status",
        })
      }

      item.status = "delivered"
      item.returnRejectedAt = new Date()
      item.returnRejectionReason = reason || "Return rejected by admin"

      await order.save()

      res.status(statusCode.OK).json({
        success: true,
        message: "Item return request rejected successfully",
      })
    } else {
      if (order.orderStatus !== "return_requested") {
        return res.status(statusCode.BAD_REQUEST).json({
          success: false,
          message: "Order is not in return requested status",
        })
      }

      order.orderStatus = "delivered"
      order.returnRejectedAt = new Date()
      order.returnRejectionReason = reason || "Return rejected by admin"

      order.products.forEach((item) => {
        if (item.status === "return_requested") {
          item.status = "delivered"
          item.returnRejectedAt = new Date()
          item.returnRejectionReason = reason || "Return rejected by admin"
        }
      })

      await order.save()

      res.status(statusCode.OK).json({
        success: true,
        message: "Return request rejected successfully",
      })
    }
  } catch (error) {
    console.log("Error rejecting return:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to reject return",
    })
  }
}

const processRefundToWallet = async (order, reason, customRefundAmount = null) => {
  try {
    const userId = order.user._id
    const refundAmount = customRefundAmount !== null ? customRefundAmount : order.finalAmount

    if (refundAmount <= 0) {
      console.log(`No refund needed - amount is ₹${refundAmount}`)
      return { success: true, amount: 0 }
    }

    let wallet = await Wallet.findOne({ userId })
    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0, transactions: [] })
    }

    wallet.transactions.push({
      type: "credit",
      amount: refundAmount,
      orderId: order._id,
      reason: reason,
      refundedItems: order.products.map((item) => item.product),
      date: new Date(),
    })

    wallet.balance += refundAmount
    await wallet.save()

    order.refundStatus = "completed"
    order.refundAmount = (order.refundAmount || 0) + refundAmount
    order.refundProcessedAt = new Date()
    order.refundMethod = "wallet"
    await order.save()

    console.log(`Refund processed: ₹${refundAmount} added to user ${userId} wallet for order ${order.orderID}`)
    return { success: true, amount: refundAmount }
  } catch (error) {
    console.log("Error processing refund to wallet:", error)
    return { success: false, error: error.message }
  }
}

const processItemRefund = async (order, item, refundAmount, reason) => {
  try {
    const userId = order.user._id

    let wallet = await Wallet.findOne({ userId })
    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0, transactions: [] })
    }

    wallet.transactions.push({
      type: "credit",
      amount: refundAmount,
      orderId: order._id,
      reason: reason,
      refundedItems: [item.product],
      date: new Date(),
    })

    wallet.balance += refundAmount
    await wallet.save()

    order.refundAmount = (order.refundAmount || 0) + refundAmount
    order.refundStatus = order.refundStatus === "completed" ? "completed" : "partial"
    order.refundProcessedAt = new Date()
    order.refundMethod = "wallet"

    console.log(`Item refund processed: ₹${refundAmount} added to user ${userId} wallet`)
    return { success: true, amount: refundAmount }
  } catch (error) {
    console.log("Error processing item refund:", error)
    return { success: false, error: error.message }
  }
}

const restoreInventory = async (order) => {
  try {
    for (const item of order.products) {
      if (item.status === "cancelled" || item.status === "returned") {
        const product = await Product.findById(item.product)
        if (product) {
          const variantIndex = product.variants.findIndex((v) => v.size === item.variant.size)
          if (variantIndex !== -1) {
            product.variants[variantIndex].varientquantity += item.quantity
            await product.save()
          }
        }
      }
    }
  } catch (error) {
    console.log("Error restoring inventory:", error)
  }
}

const processRefund = async (req, res) => {
  try {
    res.status(statusCode.BAD_REQUEST).json({
      success: false,
      message: "Manual refunds are disabled. Refunds are processed automatically when returns are approved or orders are cancelled.",
    })
  } catch (error) {
    console.log("Error processing refund:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to process refund",
    })
  }
}

const getWalletTransactions = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = 10
    const skip = (page - 1) * limit
    const userId = req.query.userId
    const transactionType = req.query.type || "all"

    const query = {}
    if (userId) {
      query.userId = userId
    }

    const wallets = await Wallet.find(query)
      .populate("userId", "fullName email")
      .populate({
        path: "transactions.orderId",
        select: "orderID orderDate",
      })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)

    let allTransactions = []
    wallets.forEach((wallet) => {
      wallet.transactions.forEach((transaction) => {
        allTransactions.push({
          ...transaction.toObject(),
          userInfo: {
            _id: wallet.userId._id,
            name: wallet.userId.fullName,
            email: wallet.userId.email,
          },
          walletBalance: wallet.balance,
        })
      })
    })

    if (transactionType !== "all") {
      allTransactions = allTransactions.filter((t) => t.type === transactionType)
    }

    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date))

    const totalTransactions = allTransactions.length
    const paginatedTransactions = allTransactions.slice(skip, skip + limit)
    const totalPages = Math.ceil(totalTransactions / limit)

    res.status(statusCode.OK).json({
      success: true,
      transactions: paginatedTransactions,
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

const sendNotification = async (req, res) => {
  try {
    const orderId = req.params.orderId

    const order = await Order.findById(orderId).populate("user", "email fullName")
    if (!order) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      })
    }

    //  email notification
    console.log(`Sending notification to ${order.user.email} for order ${order.orderID}`)

    res.status(statusCode.OK).json({
      success: true,
      message: "Notification sent successfully",
    })
  } catch (error) {
    console.log("Error sending notification:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to send notification",
    })
  }
}

const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId

    const order = await Order.findById(orderId).populate("user", "_id fullName email")
    if (!order) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      })
    }

    if (!["pending", "confirmed"].includes(order.orderStatus)) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Order cannot be cancelled at this stage",
      })
    }

    order.orderStatus = "cancelled"
    order.cancellationReason = "Cancelled by admin"
    order.cancelledAt = new Date()

    order.products.forEach((item) => {
      if (item.status === "pending" || item.status === "confirmed") {
        item.status = "cancelled"
        item.cancellationReason = "Cancelled by admin"
        item.cancelledAt = new Date()
      }
    })

    await recalculateOrderTotals(order)
    await order.save()
    await restoreInventory(order)

    if (order.paymentMethod !== "COD") {
      const cancelledItems = order.products.filter(item => item.status === "cancelled")
      const refundAmount = calculateProportionalRefund(order, cancelledItems)

      if (refundAmount > 0) {
        const refundResult = await processRefundToWallet(order, "Order cancelled by admin - automatic refund", refundAmount)

        if (refundResult.success) {
          res.status(statusCode.OK).json({
            success: true,
            message: `Order cancelled successfully and refund of ₹${refundResult.amount} processed to user's wallet`,
          })
        } else {
          res.status(statusCode.OK).json({
            success: true,
            message: "Order cancelled successfully but refund processing failed. Please process refund manually.",
          })
        }
      } else {
        res.status(statusCode.OK).json({
          success: true,
          message: "Order cancelled successfully",
        })
      }
    } else {
      res.status(statusCode.OK).json({
        success: true,
        message: "Order cancelled successfully",
      })
    }
  } catch (error) {
    console.log("Error cancelling order:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to cancel order",
    })
  }
}

const deleteOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId

    const order = await Order.findById(orderId)
    if (!order) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      })
    }

    await Order.findByIdAndDelete(orderId)

    res.status(statusCode.OK).json({
      success: true,
      message: "Order deleted successfully",
    })
  } catch (error) {
    console.log("Error deleting order:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to delete order",
    })
  }
}

const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.orderId

    const order = await Order.findById(orderId)
      .populate("user", "fullName email")
      .populate("address")
      .populate({
        path: "products.product",
        select: "name",
      })
      .lean()

    if (!order) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      })
    }

    //  invoice 
    if (order.orderStatus !== "delivered") {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Invoice can only be downloaded for delivered orders",
      })
    }

    const doc = new PDFDocument({ margin: 50 })

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${order.orderID}.pdf"`)

    doc.pipe(res)

    doc.fontSize(20).text("StepOut - Admin", 50, 50)
    doc.fontSize(10).text("Premium Footwear Store", 50, 75)
    doc.text("Email: admin@stepout.com", 50, 90)
    doc.text("Phone: +91 9876543210", 50, 105)

    doc.fontSize(18).text("INVOICE", 400, 50)
    doc.fontSize(12).text(`Invoice #: ${order.orderID}`, 400, 75)
    doc.text(`Date: ${new Date(order.orderDate).toLocaleDateString("en-IN")}`, 400, 90)
    doc.text(`Status: ${order.orderStatus.toUpperCase()}`, 400, 105)

    doc.moveTo(50, 130).lineTo(550, 130).stroke()

    doc.fontSize(14).text("Bill To:", 50, 150)
    doc.fontSize(12).text(order.address.name, 50, 170)
    doc.text(order.address.address, 50, 185)
    doc.text(`${order.address.city}, ${order.address.state}`, 50, 200)
    doc.text(`PIN: ${order.address.pincode}`, 50, 215)
    doc.text(`Phone: ${order.address.mobile}`, 50, 230)

    doc.fontSize(14).text("Payment Information:", 300, 150)
    doc
      .fontSize(12)
      .text(
        `Method: ${order.paymentMethod === "COD" ? "Cash on Delivery" : order.paymentMethod === "wallet" ? "Wallet Payment" : "Online Payment"}`,
        300,
        170,
      )
    doc.text(`Payment Status: ${order.paymentStatus}`, 300, 185)
    if (order.walletAmountUsed > 0) {
      doc.text(`Wallet Used: ₹${order.walletAmountUsed}`, 300, 200)
    }

    let yPosition = 270
    doc.fontSize(12).text("Item", 50, yPosition)
    doc.text("Size", 250, yPosition)
    doc.text("Qty", 300, yPosition)
    doc.text("Price", 350, yPosition)
    doc.text("Total", 450, yPosition)

    yPosition += 15
    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke()

    yPosition += 20
    order.products.forEach((item) => {
      doc.text(item.product.name, 50, yPosition, { width: 180 })
      doc.text(item.variant.size, 250, yPosition)
      doc.text(item.quantity.toString(), 300, yPosition)
      doc.text(`₹${item.variant.salePrice}`, 350, yPosition)
      doc.text(`₹${item.variant.salePrice * item.quantity}`, 450, yPosition)
      yPosition += 25
    })

    yPosition += 20
    doc.moveTo(300, yPosition).lineTo(550, yPosition).stroke()
    yPosition += 15

    doc.text("Subtotal:", 350, yPosition)
    doc.text(`₹${order.totalAmount}`, 450, yPosition)
    yPosition += 20

    if (order.discount > 0) {
      doc.text("Discount:", 350, yPosition)
      doc.text(`-₹${order.discount}`, 450, yPosition)
      yPosition += 20
    }

    if (order.walletAmountUsed > 0) {
      doc.text("Wallet Used:", 350, yPosition)
      doc.text(`-₹${order.walletAmountUsed}`, 450, yPosition)
      yPosition += 20
    }

    doc.text("Tax (18% GST):", 350, yPosition)
    doc.text(`₹${Math.round(order.totalAmount * 0.18)}`, 450, yPosition)
    yPosition += 20

    doc.text("Shipping:", 350, yPosition)
    doc.text("FREE", 450, yPosition)
    yPosition += 20

    doc.moveTo(300, yPosition).lineTo(550, yPosition).stroke()
    yPosition += 15

    doc.fontSize(14).text("Total Amount:", 350, yPosition)
    doc.text(`₹${order.finalAmount}`, 450, yPosition)

    yPosition += 60
    doc.fontSize(10).text("Thank you for choosing StepOut!", 50, yPosition)
    doc.text("For any queries, contact us at admin@stepout.com", 50, yPosition + 15)

    doc.end()
  } catch (error) {
    console.log("Error generating invoice:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to generate invoice",
    })
  }
}

const exportOrders = async (req, res, query, sortOptions) => {
  try {
    const orders = await Order.find(query)
      .populate("user", "fullName email")
      .populate("address")
      .populate({
        path: "products.product",
        select: "name",
      })
      .sort(sortOptions)
      .lean()

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Orders")

    worksheet.columns = [
      { header: "Order ID", key: "orderID", width: 15 },
      { header: "Customer Name", key: "customerName", width: 20 },
      { header: "Customer Email", key: "customerEmail", width: 25 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Items", key: "items", width: 30 },
      { header: "Total Amount", key: "totalAmount", width: 15 },
      { header: "Final Amount", key: "finalAmount", width: 15 },
      { header: "Payment Method", key: "paymentMethod", width: 15 },
      { header: "Wallet Used", key: "walletUsed", width: 12 },
      { header: "Status", key: "status", width: 12 },
      { header: "Order Date", key: "orderDate", width: 20 },
      { header: "Address", key: "address", width: 40 },
    ]

    orders.forEach((order) => {
      const itemsText = order.products
        .map((item) => `${item.product.name} (${item.variant.size}) x${item.quantity}`)
        .join(", ")

      const addressText = `${order.address.address}, ${order.address.city}, ${order.address.state} - ${order.address.pincode}`

      worksheet.addRow({
        orderID: order.orderID,
        customerName: order.user.fullName,
        customerEmail: order.user.email,
        phone: order.address.mobile,
        items: itemsText,
        totalAmount: order.totalAmount,
        finalAmount: order.finalAmount,
        paymentMethod: order.paymentMethod,
        walletUsed: order.walletAmountUsed || 0,
        status: order.orderStatus,
        orderDate: new Date(order.orderDate).toLocaleString(),
        address: addressText,
      })
    })

    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="orders-export-${new Date().toISOString().split("T")[0]}.xlsx"`,
    )

    await workbook.xlsx.write(res)
    res.end()
  } catch (error) {
    console.log("Error exporting orders:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to export orders",
    })
  }
}

module.exports = {
  loadOrders,
  getOrderDetails,
  updateOrderStatus,
  updateItemStatus,
  processRefund,
  approveReturn,
  rejectReturn,
  getWalletTransactions,
  sendNotification,
  cancelOrder,
  deleteOrder,
  downloadInvoice,
}
