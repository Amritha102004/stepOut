const User = require("../../model/userModel")
const Product = require("../../model/productModel")
const Cart = require("../../model/cartModel")
const Address = require("../../model/addressModel")
const Order = require("../../model/orderModel")
const mongoose = require("mongoose")
const statusCode = require("../../utils/httpStatusCodes")

// Load checkout page
const loadCheckout = async (req, res) => {
  try {
    const userId = req.session.user._id

    // Get user's cart
    const cart = await Cart.findOne({ user: userId })
      .populate({
        path: "products.product",
        populate: {
          path: "categoryId",
          model: "Category",
        },
      })
      .lean()

    if (!cart || cart.products.length === 0) {
      req.flash("error_msg", "Your cart is empty")
      return res.redirect("/cart")
    }

    // Get user's addresses
    const addresses = await Address.find({ user: userId }).sort({ isDefault: -1, createdAt: -1 })

    // Process cart items
    let cartItems = []
    let totalAmount = 0
    let totalItems = 0
    let hasOutOfStockItems = false

    cartItems = cart.products.filter((item) => {
      const product = item.product

      // Check if product exists and is active
      if (!product || !product.isActive || product.isDeleted) {
        return false
      }

      // Check if category is active
      if (!product.categoryId || !product.categoryId.isListed) {
        return false
      }

      // Find the specific variant for this cart item
      const variant = product.variants.find((v) => v.size === item.size)
      if (!variant) {
        return false
      }

      // Check stock availability
      if (variant.varientquantity === 0) {
        hasOutOfStockItems = true
        return false
      }

      // Check if requested quantity is available
      if (item.quantity > variant.varientquantity) {
        // Update cart quantity to available stock
        item.quantity = variant.varientquantity
      }

      // Add calculated fields to the item
      item.variant = variant
      item.itemTotal = variant.salePrice * item.quantity

      totalAmount += item.itemTotal
      totalItems += item.quantity

      return true
    })

    // If there are out of stock items, redirect back to cart
    if (hasOutOfStockItems) {
      req.flash("error_msg", "Some items in your cart are out of stock. Please review your cart.")
      return res.redirect("/cart")
    }

    // If no valid items remain
    if (cartItems.length === 0) {
      req.flash("error_msg", "No valid items in your cart")
      return res.redirect("/cart")
    }

    res.render("user/checkout", {
      req,
      addresses,
      cartItems,
      totalAmount,
      totalItems,
    })
  } catch (error) {
    console.log("Error loading checkout:", error)
    req.flash("error_msg", "Failed to load checkout page")
    res.status(statusCode.INTERNAL_SERVER_ERROR).redirect("/cart")
  }
}

// Place order
const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user._id
    const { addressId, paymentMethod, couponCode } = req.body

    if (!addressId || !paymentMethod) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Address and payment method are required",
      })
    }

    const address = await Address.findOne({ _id: addressId, user: userId })
    if (!address) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Invalid delivery address",
      })
    }

    const cart = await Cart.findOne({ user: userId }).populate({
      path: "products.product",
      populate: { path: "categoryId", model: "Category" },
    })

    if (!cart || cart.products.length === 0) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Your cart is empty",
      })
    }

    const orderProducts = []
    let totalAmount = 0

    for (const item of cart.products) {
      const product = item.product

      if (!product || !product.isActive || product.isDeleted) {
        return res.status(statusCode.BAD_REQUEST).json({
          success: false,
          message: `Product ${product?.name || "Unknown"} is no longer available`,
        })
      }

      if (!product.categoryId || !product.categoryId.isListed) {
        return res.status(statusCode.BAD_REQUEST).json({
          success: false,
          message: `Product ${product.name} category is not available`,
        })
      }

      const variant = product.variants.find((v) => v.size === item.size)
      if (!variant || variant.varientquantity === 0 || item.quantity > variant.varientquantity) {
        return res.status(statusCode.BAD_REQUEST).json({
          success: false,
          message: `${product.name} (Size: ${item.size}) is not available in sufficient quantity`,
        })
      }

      orderProducts.push({
        product: product._id,
        variant: {
          size: variant.size,
          varientPrice: variant.varientPrice,
          salePrice: variant.salePrice,
        },
        quantity: item.quantity,
        status: "pending",
      })

      totalAmount += variant.salePrice * item.quantity
    }

    const taxAmount = Math.round(totalAmount * 0.18)
    let discount = 0

    if (couponCode) {
      if (couponCode.toUpperCase() === "SAVE10") {
        discount = Math.round(totalAmount * 0.1)
      } else if (couponCode.toUpperCase() === "FLAT50") {
        discount = 50
      }
    }

    const finalAmount = totalAmount + taxAmount - discount

    const order = new Order({
      user: userId,
      products: orderProducts,
      address: addressId,
      totalAmount,
      discount,
      finalAmount,
      paymentMethod,
      orderStatus: "pending",
    })

    if (!order.orderID) {
      const date = new Date()
      const year = date.getFullYear().toString().slice(-2)
      const month = ("0" + (date.getMonth() + 1)).slice(-2)
      const day = ("0" + date.getDate()).slice(-2)
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0")
      order.orderID = `ORD${year}${month}${day}${random}`
    }

    await order.save()

    // Update product stock
    for (const item of cart.products) {
      const product = await Product.findById(item.product._id)
      const variantIndex = product.variants.findIndex((v) => v.size === item.size)
      if (variantIndex !== -1) {
        product.variants[variantIndex].varientquantity -= item.quantity
        await product.save()
      }
    }

    cart.products = []
    await cart.save()

    res.status(statusCode.OK).json({
      success: true,
      message: "Order placed successfully",
      orderId: order.orderID,
    })
  } catch (error) {
    console.log("Error placing order:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to place order. Please try again.",
    })
  }
}


// Load order success page
const loadOrderSuccess = async (req, res) => {
  try {
    const { orderId } = req.query
    const userId = req.session.user._id

    if (!orderId) {
      req.flash("error_msg", "Invalid order")
      return res.redirect("/")
    }

    // Find order with populated data
    const order = await Order.findOne({ orderID: orderId, user: userId })
      .populate("address")
      .populate({
        path: "products.product",
        select: "name images",
      })
      .lean()

    if (!order) {
      req.flash("error_msg", "Order not found")
      return res.redirect("/")
    }

    res.render("user/order-success", {
      req,
      order,
    })
  } catch (error) {
    console.log("Error loading order success:", error)
    req.flash("error_msg", "Failed to load order details")
    res.status(statusCode.INTERNAL_SERVER_ERROR).redirect("/")
  }
}

module.exports = {
  loadCheckout,
  placeOrder,
  loadOrderSuccess,
}
