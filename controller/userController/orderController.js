const User = require("../../model/userModel");
const Product = require("../../model/productModel");
const Order = require("../../model/orderModel");
const Address = require("../../model/addressModel");
const PDFDocument = require("pdfkit")
const statusCode = require("../../utils/httpStatusCodes")
const generateInvoicePDF = require("../../utils/invoiceGenerator")

const loadOrders = async (req, res) => {
  try {
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
      .sort({ orderDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    const totalOrders = await Order.countDocuments({ user: userId })
    const totalPages = Math.ceil((await Order.countDocuments(query)) / limit)

    res.render("user/orders", {
      req,
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
    const userId = req.session.user._id
    const orderId = req.params.orderId

    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate("address")
      .populate({
        path: "products.product",
        select: "name images",
      })
      .lean()

    if (!order) {
      req.flash("error_msg", "Order not found")
      return res.redirect("/account/orders")
    }

    res.render("user/order-detail", {
      req,
      order,
    })
  } catch (error) {
    console.log("Error loading order detail:", error)
    req.flash("error_msg", "Failed to load order details")
    res.status(statusCode.INTERNAL_SERVER_ERROR).redirect("/account/orders")
  }
}

const cancelOrder = async (req, res) => {
  try {
    const userId = req.session.user._id
    const orderId = req.params.orderId
    const { reason } = req.body

    const order = await Order.findOne({ _id: orderId, user: userId }).populate("products.product")

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
    order.cancelReason = reason || "No reason provided"

    order.products.forEach((item) => {
      if (item.status === "pending") {
        item.status = "cancelled"
        item.cancelReason = reason || "Order cancelled"
      }
    })

    await order.save()

    for (const item of order.products) {
      if (item.status === "cancelled") {
        const product = await Product.findById(item.product._id)
        const variantIndex = product.variants.findIndex((v) => v.size === item.variant.size)

        if (variantIndex !== -1) {
          product.variants[variantIndex].varientquantity += item.quantity
          await product.save()
        }
      }
    }

    res.status(statusCode.OK).json({
      success: true,
      message: "Order cancelled successfully",
    })
  } catch (error) {
    console.log("Error cancelling order:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to cancel order",
    })
  }
}

const returnOrder = async (req, res) => {
  try {
    const userId = req.session.user._id
    const orderId = req.params.orderId
    const { reason } = req.body

    if (!reason) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Return reason is required",
      })
    }

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

    order.orderStatus = "returned"
    order.returnReason = reason

    order.products.forEach((item) => {
      if (item.status === "delivered") {
        item.status = "returned"
        item.returnReason = reason
      }
    })

    await order.save()

    for (const item of order.products) {
      if (item.status === "returned") {
        const product = await Product.findById(item.product._id)
        const variantIndex = product.variants.findIndex((v) => v.size === item.variant.size)

        if (variantIndex !== -1) {
          product.variants[variantIndex].varientquantity += item.quantity
          await product.save()
        }
      }
    }

    res.status(statusCode.OK).json({
      success: true,
      message: "Return request submitted successfully",
    })
  } catch (error) {
    console.log("Error processing return:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to process return request",
    })
  }
}

const cancelOrderItem = async (req, res) => {
  try {
    const userId = req.session.user._id
    const orderId = req.params.orderId
    const { productId, variantSize, reason } = req.body

    const order = await Order.findOne({ _id: orderId, user: userId }).populate("products.product")

    if (!order) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      })
    }

    if (!["pending", "confirmed"].includes(order.orderStatus)) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Order items cannot be cancelled at this stage",
      })
    }

    const itemIndex = order.products.findIndex(
      (item) => item.product._id.toString() === productId && item.variant.size === variantSize,
    )

    if (itemIndex === -1) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Item not found in order",
      })
    }

    const item = order.products[itemIndex]

    if (item.status !== "pending") {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Item cannot be cancelled",
      })
    }

    item.status = "cancelled"
    item.cancelReason = reason || "Item cancelled"

    const activeitems = order.products.filter((item) => item.status !== "cancelled")
    if (activeitems.length === 0) {
      order.orderStatus = "cancelled"
      order.cancelReason = "All items cancelled"
    }

    await order.save()

    const product = await Product.findById(productId)
    const variantIndex = product.variants.findIndex((v) => v.size === variantSize)

    if (variantIndex !== -1) {
      product.variants[variantIndex].varientquantity += item.quantity
      await product.save()
    }

    res.status(statusCode.OK).json({
      success: true,
      message: "Item cancelled successfully",
    })
  } catch (error) {
    console.log("Error cancelling item:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to cancel item",
    })
  }
}

const returnOrderItem = async (req, res) => {
  try {
    const userId = req.session.user._id
    const orderId = req.params.orderId
    const { productId, variantSize, reason } = req.body

    if (!reason) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Return reason is required",
      })
    }

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
        message: "Only delivered items can be returned",
      })
    }

    const itemIndex = order.products.findIndex(
      (item) => item.product._id.toString() === productId && item.variant.size === variantSize,
    )

    if (itemIndex === -1) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Item not found in order",
      })
    }

    const item = order.products[itemIndex]

    if (item.status !== "delivered") {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Item cannot be returned",
      })
    }

    item.status = "returned"
    item.returnReason = reason

    await order.save()

    const product = await Product.findById(productId)
    const variantIndex = product.variants.findIndex((v) => v.size === variantSize)

    if (variantIndex !== -1) {
      product.variants[variantIndex].varientquantity += item.quantity
      await product.save()
    }

    res.status(statusCode.OK).json({
      success: true,
      message: "Return request submitted successfully",
    })
  } catch (error) {
    console.log("Error processing item return:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to process return request",
    })
  }
}

const downloadInvoice = async (req, res) => {
  try {
    const userId = req.session.user._id
    const orderId = req.params.orderId

    const order = await Order.findOne({ _id: orderId, user: userId })
      .populate("address")
      .populate("user", "name email")
      .populate({ path: "products.product", select: "name" })
      .lean()

    if (!order) {
      req.flash("error_msg", "Order not found")
      return res.redirect("/account/orders")
    }

    generateInvoicePDF(order, res)
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
