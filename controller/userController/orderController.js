const User = require("../../model/userModel")
const Product = require("../../model/productModel")
const Order = require("../../model/orderModel")
const Address = require("../../model/addressModel")
const Wallet = require("../../model/walletModel")
const { processRefund } = require("./walletController")
const mongoose = require("mongoose")
const statusCode = require("../../utils/httpStatusCodes")
const PDFDocument = require("pdfkit")

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

  console.log(`Order totals recalculated: Total: ₹${newTotalAmount}, Final: ₹${order.finalAmount}`)
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
    const user = req.session.user
    const userId = req.session.user._id
    const page = Number.parseInt(req.query.page) || 1
    const limit = 10
    const skip = (page - 1) * limit
    const statusFilter = req.query.status || "all"
    const searchQuery = req.query.search || ""
    const query = { user: userId }

    if (statusFilter && statusFilter !== "all") {
      query.orderStatus = statusFilter
    }
    if (searchQuery) {
      query.orderID = { $regex: searchQuery, $options: "i" }
    }

    const orders = await Order.find(query)
      .populate({
        path: "products.product",
        select: "name images",
      })
      .populate("address")
      .populate("coupon", "code discountType discountValue")
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    const totalOrders = await Order.countDocuments({ user: userId })
    const totalPages = Math.ceil((await Order.countDocuments(query)) / limit)

    res.render("user/orders", {
      user,
      orders,
      currentPage: page,
      totalPages,
      totalOrders,
      statusFilter,
      searchQuery,
    })
  } catch (error) {
    console.log("Error loading orders:", error)
    req.flash("error_msg", "Failed to load orders")
    res.status(statusCode.INTERNAL_SERVER_ERROR).redirect("/account")
  }
}

const loadOrderDetail = async (req, res) => {
  try {
    const user = req.session.user
    const { orderId } = req.params
    const userId = req.session.user._id

    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate("address")
      .populate({
        path: "products.product",
        select: "name images brand",
      })
      .populate("coupon", "code discountType discountValue description")
      .lean()

    if (!order) {
      req.flash("error_msg", "Order not found")
      return res.redirect("/account/orders")
    }

    const timeline = [
      {
        status: "pending",
        label: "Order Placed",
        date: order.createdAt,
        completed: true,
      },
      {
        status: "confirmed",
        label: "Order Confirmed",
        date:
          order.orderStatus === "confirmed" || order.orderStatus === "shipped" || order.orderStatus === "delivered"
            ? order.updatedAt
            : null,
        completed: ["confirmed", "shipped", "delivered"].includes(order.orderStatus),
      },
      {
        status: "shipped",
        label: "Shipped",
        date: order.orderStatus === "shipped" || order.orderStatus === "delivered" ? order.updatedAt : null,
        completed: ["shipped", "delivered"].includes(order.orderStatus),
      },
      {
        status: "delivered",
        label: "Delivered",
        date: order.orderStatus === "delivered" ? order.updatedAt : null,
        completed: order.orderStatus === "delivered",
      },
    ]

    res.render("user/order-detail", {
      user,
      order,
      timeline,
    })
  } catch (error) {
    console.log("Error loading order detail:", error)
    req.flash("error_msg", "Failed to load order details")
    res.status(statusCode.INTERNAL_SERVER_ERROR).redirect("/account/orders")
  }
}

const processWalletRefund = async (userId, amount, orderId, reason, refundedItems = []) => {
  try {
    console.log(`Processing wallet refund: User ${userId}, Amount: ₹${amount}, Order: ${orderId}`)

    let wallet = await Wallet.findOne({ userId })
    if (!wallet) {
      console.log(`Creating new wallet for user ${userId}`)
      wallet = new Wallet({
        userId,
        balance: 0,
        transactions: [],
      })
    }

    const transaction = {
      type: "credit",
      amount: amount,
      orderId: orderId,
      reason: reason,
      refundedItems: refundedItems,
      date: new Date(),
    }

    wallet.transactions.push(transaction)
    wallet.balance += amount

    await wallet.save()

    console.log(`Wallet refund successful: New balance ₹${wallet.balance}`)
    return { success: true, newBalance: wallet.balance, transactionId: transaction._id }
  } catch (error) {
    console.error("Error processing wallet refund:", error)
    return { success: false, error: error.message }
  }
}

const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params
    const { reason } = req.body
    const userId = req.session.user._id

    console.log(`Cancel order request: Order ${orderId}, User ${userId}, Reason: ${reason}`)

    const order = await Order.findOne({ _id: orderId, user: userId }).populate("products.product")

    if (!order) {
      console.log(`Order not found: ${orderId}`)
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      })
    }

    if (!["pending", "confirmed"].includes(order.orderStatus)) {
      console.log(`Order cannot be cancelled - current status: ${order.orderStatus}`)
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Order cannot be cancelled at this stage",
      })
    }

    const cancellableItems = order.products.filter((item) => !["cancelled", "returned"].includes(item.status))

    if (cancellableItems.length === 0) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "No items available for cancellation",
      })
    }

    order.orderStatus = "cancelled"
    order.cancellationReason = reason
    order.cancelledAt = new Date()

    order.products.forEach((item) => {
      if (!["cancelled", "returned"].includes(item.status)) {
        item.status = "cancelled"
        item.cancelledAt = new Date()
        item.cancellationReason = reason
      }
    })

    await recalculateOrderTotals(order)
    await order.save()
    console.log(`Order ${orderId} cancelled successfully`)

    for (const item of cancellableItems) {
      const product = await Product.findById(item.product._id)
      if (product) {
        const variantIndex = product.variants.findIndex((v) => v.size === item.variant.size)
        if (variantIndex !== -1) {
          product.variants[variantIndex].varientquantity += item.quantity
          await product.save()
          console.log(`Stock restored for product ${item.product._id}, size ${item.variant.size}`)
        }
      }
    }

    if (order.paymentMethod !== "COD" && order.paymentStatus === "completed") {
      console.log(`Processing refund for ${order.paymentMethod} payment`)

      const refundAmount = calculateProportionalRefund(order, cancellableItems)

      if (refundAmount > 0) {
        const refundResult = await processWalletRefund(
          userId,
          refundAmount,
          order._id,
          `Order cancellation refund - ${reason}`,
          cancellableItems.map((item) => item.product._id),
        )

        if (refundResult.success) {
          order.refundStatus = "completed"
          order.refundAmount = refundAmount
          order.refundProcessedAt = new Date()
          order.refundMethod = "wallet"
          await order.save()

          console.log(`Refund processed successfully: ₹${refundAmount} to wallet`)

          res.status(statusCode.OK).json({
            success: true,
            message: `Order cancelled successfully. Refund of ₹${refundAmount} has been processed to your wallet.`,
            refundAmount: refundAmount,
            newWalletBalance: refundResult.newBalance,
          })
        } else {
          console.error(`Refund processing failed: ${refundResult.error}`)
          res.status(statusCode.OK).json({
            success: true,
            message: "Order cancelled successfully, but refund processing failed. Please contact support.",
          })
        }
      } else {
        res.status(statusCode.OK).json({
          success: true,
          message: "Order cancelled successfully",
        })
      }
    } else {
      const message = order.paymentMethod === "COD"
        ? "Order cancelled successfully"
        : "Order cancelled successfully"

      res.status(statusCode.OK).json({
        success: true,
        message: message,
      })
    }
  } catch (error) {
    console.error("Error cancelling order:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to cancel order",
    })
  }
}

const returnOrder = async (req, res) => {
  try {
    const { orderId } = req.params
    const { reason } = req.body
    const userId = req.session.user._id

    console.log(`Return order request: Order ${orderId}, User ${userId}, Reason: ${reason}`)

    const order = await Order.findOne({ _id: orderId, user: userId }).populate("products.product")

    if (!order) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      })
    }

    if (order.orderStatus !== "delivered") {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Only delivered orders can be returned",
      })
    }

    const deliveryDate = order.deliveredAt || order.updatedAt
    const daysSinceDelivery = Math.floor((new Date() - deliveryDate) / (1000 * 60 * 60 * 24))

    if (daysSinceDelivery > 30) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Return window has expired (30 days)",
      })
    }

    const returnableItems = order.products.filter(
      (item) => !["cancelled", "returned", "return_requested"].includes(item.status),
    )

    if (returnableItems.length === 0) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "No items available for return",
      })
    }

    order.orderStatus = "return_requested"
    order.returnReason = reason
    order.returnRequestedAt = new Date()

    order.products.forEach((item) => {
      if (!["cancelled", "returned", "return_requested"].includes(item.status)) {
        item.status = "return_requested"
        item.returnRequestDate = new Date()
        item.returnReason = reason
      }
    })

    await order.save()
    console.log(`Return request submitted for order ${orderId}`)

    res.status(statusCode.OK).json({
      success: true,
      message: "Return request submitted successfully. We will process your request within 2-3 business days.",
    })
  } catch (error) {
    console.log("Error returning order:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to submit return request",
    })
  }
}

const cancelOrderItem = async (req, res) => {
  try {
    const { orderId } = req.params
    const { productId, size, reason } = req.body
    const userId = req.session.user._id

    console.log(`Cancel item request: Order ${orderId}, Product ${productId}, Size ${size}, User ${userId}`)

    const order = await Order.findOne({ _id: orderId, user: userId }).populate("products.product")

    if (!order) {
      console.log(`Order not found: ${orderId}`)
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      })
    }

    const itemIndex = order.products.findIndex((item) => {
      const productMatch = item.product._id.toString() === productId.toString()
      const sizeMatch = item.variant.size === size
      console.log(
        `Checking item: Product ${item.product._id} vs ${productId} (${productMatch}), Size ${item.variant.size} vs ${size} (${sizeMatch})`,
      )
      return productMatch && sizeMatch
    })

    if (itemIndex === -1) {
      console.log(`Item not found in order. Available items:`)
      order.products.forEach((item, index) => {
        console.log(`  ${index}: Product ${item.product._id}, Size ${item.variant.size}, Status ${item.status}`)
      })
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Item not found in order",
      })
    }

    const item = order.products[itemIndex]
    console.log(`Found item: ${item.product.name}, Size: ${item.variant.size}, Current status: ${item.status}`)

    if (["cancelled", "returned"].includes(item.status)) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Item is already cancelled or returned",
      })
    }

    if (!["pending", "confirmed"].includes(order.orderStatus)) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Item cannot be cancelled at this stage",
      })
    }

    item.status = "cancelled"
    item.cancelledAt = new Date()
    item.cancellationReason = reason

    const activeItems = order.products.filter((item) => !["cancelled", "returned"].includes(item.status))

    if (activeItems.length === 0) {
      order.orderStatus = "cancelled"
      order.cancellationReason = "All items cancelled"
      order.cancelledAt = new Date()
    }

    await recalculateOrderTotals(order)
    await order.save()
    console.log(`Item cancelled successfully: ${item.product.name}`)

    const product = await Product.findById(productId)
    if (product) {
      const variantIndex = product.variants.findIndex((v) => v.size === size)
      if (variantIndex !== -1) {
        product.variants[variantIndex].varientquantity += item.quantity
        await product.save()
        console.log(`Stock restored: Product ${productId}, Size ${size}, Quantity ${item.quantity}`)
      }
    }

    if (order.paymentMethod !== "COD" && order.paymentStatus === "completed") {
      console.log(`Processing partial refund for ${order.paymentMethod} payment`)

      const itemRefundAmount = calculateItemProportionalRefund(order, item)
      console.log(`Item proportional refund amount: ₹${itemRefundAmount}`)

      if (itemRefundAmount > 0) {
        const refundResult = await processWalletRefund(
          userId,
          itemRefundAmount,
          order._id,
          `Item cancellation refund - ${item.product.name} (${size}) - ${reason}`,
          [item.product._id],
        )

        if (refundResult.success) {
          order.refundStatus = order.refundStatus === "completed" ? "completed" : "partial"
          order.refundAmount = (order.refundAmount || 0) + itemRefundAmount
          order.refundProcessedAt = new Date()
          order.refundMethod = "wallet"
          await order.save()

          console.log(`Partial refund processed: ₹${itemRefundAmount}`)

          res.status(statusCode.OK).json({
            success: true,
            message: `Item cancelled successfully. Refund of ₹${itemRefundAmount} has been processed to your wallet.`,
            refundAmount: itemRefundAmount,
            newWalletBalance: refundResult.newBalance,
          })
        } else {
          console.error(`Refund processing failed: ${refundResult.error}`)
          res.status(statusCode.OK).json({
            success: true,
            message: "Item cancelled successfully, but refund processing failed. Please contact support.",
          })
        }
      } else {
        res.status(statusCode.OK).json({
          success: true,
          message: "Item cancelled successfully",
        })
      }
    } else {
      res.status(statusCode.OK).json({
        success: true,
        message: "Item cancelled successfully",
      })
    }
  } catch (error) {
    console.error("Error cancelling order item:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to cancel item",
    })
  }
}

const returnOrderItem = async (req, res) => {
  try {
    const { orderId } = req.params
    const { productId, size, reason } = req.body
    const userId = req.session.user._id

    console.log(`Return item request: Order ${orderId}, Product ${productId}, Size ${size}`)

    const order = await Order.findOne({ _id: orderId, user: userId }).populate("products.product")

    if (!order) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      })
    }

    if (order.orderStatus !== "delivered") {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Only delivered orders can be returned",
      })
    }

    const itemIndex = order.products.findIndex((item) => {
      return item.product._id.toString() === productId.toString() && item.variant.size === size
    })

    if (itemIndex === -1) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Item not found in order",
      })
    }

    const item = order.products[itemIndex]

    if (["cancelled", "returned", "return_requested"].includes(item.status)) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Item is already cancelled, returned, or return requested",
      })
    }

    const deliveryDate = order.deliveredAt || order.updatedAt
    const daysSinceDelivery = Math.floor((new Date() - deliveryDate) / (1000 * 60 * 60 * 24))

    if (daysSinceDelivery > 30) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Return window has expired (30 days)",
      })
    }

    item.status = "return_requested"
    item.returnRequestDate = new Date()
    item.returnReason = reason

    await order.save()
    console.log(`Return request submitted for item: ${item.product.name}`)

    res.status(statusCode.OK).json({
      success: true,
      message: "Return request submitted successfully for this item",
    })
  } catch (error) {
    console.log("Error returning order item:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to submit return request",
    })
  }
}

const downloadInvoice = async (req, res) => {
  try {
    const { orderId } = req.params
    const userId = req.session.user._id

    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate("address")
      .populate("user", "fullName email phoneNumber")
      .populate({
        path: "products.product",
        select: "name brand",
      })
      .populate("coupon", "code discountType discountValue")
      .lean()

    if (!order) {
      req.flash("error_msg", "Order not found")
      return res.redirect("/account/orders")
    }

    if (order.orderStatus !== "delivered") {
      req.flash("error_msg", "Invoice can only be downloaded for delivered orders")
      return res.redirect("/account/orders")
    }

    const doc = new PDFDocument({ margin: 50 })

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${orderId}.pdf"`)

    doc.pipe(res)

    doc.fontSize(20).text("StepOut", 50, 50)
    doc.fontSize(10).text("Premium Footwear Store", 50, 75)
    doc.text("Email: support@stepout.com", 50, 90)
    doc.text("Phone: +91 9876543210", 50, 105)

    doc.fontSize(16).text("INVOICE", 400, 50)
    doc.fontSize(10).text(`Invoice #: ${order.orderID}`, 400, 75)
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, 400, 90)

    doc.fontSize(12).text("Bill To:", 50, 150)
    doc.fontSize(10).text(order.user.fullName, 50, 170)
    doc.text(order.user.email, 50, 185)
    doc.text(order.user.phoneNumber, 50, 200)

    doc.fontSize(12).text("Ship To:", 300, 150)
    doc.fontSize(10).text(order.address.name, 300, 170)
    doc.text(order.address.address, 300, 185)
    doc.text(`${order.address.city}, ${order.address.state}`, 300, 200)
    doc.text(order.address.pincode, 300, 215)

    const tableTop = 280
    doc.fontSize(10)
    doc.text("Item", 50, tableTop)
    doc.text("Size", 200, tableTop)
    doc.text("Qty", 250, tableTop)
    doc.text("Price", 300, tableTop)
    doc.text("Total", 400, tableTop)
    doc
      .moveTo(50, tableTop + 15)
      .lineTo(500, tableTop + 15)
      .stroke()

    let yPosition = tableTop + 30
    order.products.forEach((item, index) => {
      doc.text(item.product.name, 50, yPosition)
      doc.text(item.variant.size, 200, yPosition)
      doc.text(item.quantity.toString(), 250, yPosition)
      doc.text(`₹${item.variant.salePrice}`, 300, yPosition)
      doc.text(`₹${item.variant.salePrice * item.quantity}`, 400, yPosition)
      yPosition += 20
    })

    yPosition += 20
    doc.moveTo(300, yPosition).lineTo(500, yPosition).stroke()
    yPosition += 15

    doc.text("Subtotal:", 300, yPosition)
    doc.text(`₹${order.totalAmount}`, 400, yPosition)
    yPosition += 15

    if (order.discount > 0) {
      doc.text("Discount:", 300, yPosition)
      if (order.coupon) {
        const couponText =
          order.coupon.discountType === "percentage"
            ? `${order.coupon.discountValue}% (${order.coupon.code})`
            : `₹${order.coupon.discountValue} (${order.coupon.code})`
        doc.text(`-₹${order.discount} ${couponText}`, 400, yPosition)
      } else {
        doc.text(`-₹${order.discount}`, 400, yPosition)
      }
      yPosition += 15
    }

    if (order.walletAmountUsed > 0) {
      doc.text("Wallet Used:", 300, yPosition)
      doc.text(`-₹${order.walletAmountUsed}`, 400, yPosition)
      yPosition += 15
    }

    doc.text("Tax (18%):", 300, yPosition)
    doc.text(`₹${Math.round(order.totalAmount * 0.18)}`, 400, yPosition)
    yPosition += 15

    doc.fontSize(12).text("Total:", 300, yPosition)
    doc.text(`₹${order.finalAmount}`, 400, yPosition)

    yPosition += 40
    doc
      .fontSize(10)
      .text(
        `Payment Method: ${order.paymentMethod === "COD" ? "Cash on Delivery" : order.paymentMethod === "wallet" ? "Wallet Payment" : "Online Payment"}`,
        50,
        yPosition,
      )
    doc.text(`Payment Status: ${order.paymentStatus}`, 50, yPosition + 15)

    doc.text("Thank you for shopping with StepOut!", 50, yPosition + 50)

    doc.end()
  } catch (error) {
    console.log("Error generating invoice:", error)
    req.flash("error_msg", "Failed to generate invoice")
    res.status(statusCode.INTERNAL_SERVER_ERROR).redirect("/account/orders")
  }
}

module.exports = {
  loadOrders,
  loadOrderDetail,
  cancelOrder,
  returnOrder,
  cancelOrderItem,
  returnOrderItem,
  downloadInvoice,
}
