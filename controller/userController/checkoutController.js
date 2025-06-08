const User = require("../../model/userModel")
const Product = require("../../model/productModel")
const Cart = require("../../model/cartModel")
const Address = require("../../model/addressModel")
const Order = require("../../model/orderModel")
const Coupon = require("../../model/couponModel")
const Wallet = require("../../model/walletModel")
const { useWalletBalance } = require("./walletController")
const mongoose = require("mongoose")
const statusCode = require("../../utils/httpStatusCodes")
const Razorpay = require("razorpay")
const crypto = require("crypto")

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

const loadCheckout = async (req, res) => {
  try {
    const user = req.session.user
    const userId = req.session.user._id

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

    const addresses = await Address.find({ user: userId }).sort({ isDefault: -1, createdAt: -1 })

    let wallet = await Wallet.findOne({ userId })
    if (!wallet) {
      wallet = new Wallet({ userId, balance: 0, transactions: [] })
      await wallet.save()
    }

    let cartItems = []
    let totalAmount = 0
    let totalItems = 0
    let hasOutOfStockItems = false

    cartItems = cart.products.filter((item) => {
      const product = item.product

      if (!product || !product.isActive || product.isDeleted) {
        return false
      }

      if (!product.categoryId || !product.categoryId.isListed) {
        return false
      }

      const variant = product.variants.find((v) => v.size === item.size)
      if (!variant) {
        return false
      }

      if (variant.varientquantity === 0) {
        hasOutOfStockItems = true
        return false
      }

      if (item.quantity > variant.varientquantity) {
        item.quantity = variant.varientquantity
      }

      item.variant = variant
      item.itemTotal = variant.salePrice * item.quantity

      totalAmount += item.itemTotal
      totalItems += item.quantity

      return true
    })

    if (hasOutOfStockItems) {
      req.flash("error_msg", "Some items in your cart are out of stock. Please review your cart.")
      return res.redirect("/cart")
    }

    if (cartItems.length === 0) {
      req.flash("error_msg", "No valid items in your cart")
      return res.redirect("/cart")
    }

    const now = new Date()
    const availableCoupons = await Coupon.find({
      isActive: true,
      startDate: { $lte: now },
      expiryDate: { $gt: now },
      $or: [
        { usageLimitGlobal: null },
        {
          $expr: { $lt: ["$usedCount", "$usageLimitGlobal"] },
        },
      ],
    })
      .limit(5)
      .lean()

    const formattedCoupons = availableCoupons.map((coupon) => ({
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscountValue: coupon.maxDiscountValue,
      minOrderAmount: coupon.minOrderAmount,
      expiryDate: coupon.expiryDate,
    }))

    res.render("user/checkout", {
      user,
      addresses,
      cartItems,
      totalAmount,
      totalItems,
      availableCoupons: formattedCoupons,
      walletBalance: wallet.balance,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    })
  } catch (error) {
    console.log("Error loading checkout:", error)
    req.flash("error_msg", "Failed to load checkout page")
    res.status(statusCode.INTERNAL_SERVER_ERROR).redirect("/cart")
  }
}

const createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.session.user._id
    const { addressId, couponCode, walletAmount } = req.body

    if (!addressId) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Address is required",
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

    let totalAmount = 0
    const applicableProducts = []
    let applicableAmount = 0

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

      const itemTotal = variant.salePrice * item.quantity
      totalAmount += itemTotal
    }

    const taxAmount = Math.round(totalAmount * 0.18)
    let discount = 0
    let couponData = null

    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() })

      if (!coupon) {
        return res.status(statusCode.BAD_REQUEST).json({
          success: false,
          message: "Invalid coupon code",
        })
      }

      if (!coupon.isActive) {
        return res.status(statusCode.BAD_REQUEST).json({
          success: false,
          message: "This coupon is inactive",
        })
      }

      const now = new Date()
      if (now < new Date(coupon.startDate) || now > new Date(coupon.expiryDate)) {
        return res.status(statusCode.BAD_REQUEST).json({
          success: false,
          message: now < new Date(coupon.startDate) ? "This coupon is not active yet" : "This coupon has expired",
        })
      }

      if (coupon.usageLimitGlobal !== null && coupon.usedCount >= coupon.usageLimitGlobal) {
        return res.status(statusCode.BAD_REQUEST).json({
          success: false,
          message: "This coupon has reached its usage limit",
        })
      }

      const userUsage = coupon.usedBy.find((usage) => usage.userId.toString() === userId.toString())
      if (userUsage && coupon.usageLimitPerUser !== null && userUsage.count >= coupon.usageLimitPerUser) {
        return res.status(statusCode.BAD_REQUEST).json({
          success: false,
          message: "You have already used this coupon the maximum number of times",
        })
      }

      if (coupon.minOrderAmount > 0 && totalAmount < coupon.minOrderAmount) {
        return res.status(statusCode.BAD_REQUEST).json({
          success: false,
          message: `Minimum order amount of ₹${coupon.minOrderAmount} required for this coupon`,
        })
      }

      for (const item of cart.products) {
        const product = item.product
        const variant = product.variants.find((v) => v.size === item.size)
        const itemTotal = variant.salePrice * item.quantity

        const isProductApplicable =
          (coupon.applicableProducts.length === 0 ||
            coupon.applicableProducts.some((p) => p.toString() === product._id.toString())) &&
          (coupon.applicableCategories.length === 0 ||
            coupon.applicableCategories.some((c) => c.toString() === product.categoryId._id.toString()))

        if (isProductApplicable) {
          applicableAmount += itemTotal
        }
      }

      if (coupon.discountType === "percentage") {
        discount = (applicableAmount * coupon.discountValue) / 100

        if (coupon.maxDiscountValue && discount > coupon.maxDiscountValue) {
          discount = coupon.maxDiscountValue
        }
      } else {
        discount = coupon.discountValue
      }

      discount = Math.round(discount)

      couponData = {
        _id: coupon._id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: discount,
      }
    }

    let finalAmount = totalAmount + taxAmount - discount
    let walletUsed = 0

    if (walletAmount && walletAmount > 0) {
      const wallet = await Wallet.findOne({ userId })
      if (!wallet || wallet.balance < walletAmount) {
        return res.status(statusCode.BAD_REQUEST).json({
          success: false,
          message: "Insufficient wallet balance",
        })
      }

      walletUsed = Math.min(walletAmount, finalAmount)
      finalAmount -= walletUsed
    }

    if (finalAmount <= 0) {
      return res.status(statusCode.OK).json({
        success: true,
        fullWalletPayment: true,
        walletAmount: walletUsed,
        totalAmount: totalAmount + taxAmount - discount,
      })
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: finalAmount * 100, // Amount in paise
      currency: "INR",
      receipt: `order_${Date.now()}`,
      notes: {
        userId: userId.toString(),
        addressId: addressId.toString(),
        couponCode: couponCode || "",
        walletAmount: walletUsed.toString(),
      },
    })

    res.status(statusCode.OK).json({
      success: true,
      orderId: razorpayOrder.id,
      amount: finalAmount,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      walletAmount: walletUsed,
    })
  } catch (error) {
    console.log("Error creating Razorpay order:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to create payment order. Please try again.",
    })
  }
}

const verifyPaymentAndPlaceOrder = async (req, res) => {
  try {
    const userId = req.session.user._id
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, addressId, couponCode, walletAmount } = req.body

    // payment signature thing here
    const sign = razorpay_order_id + "|" + razorpay_payment_id
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex")

    if (razorpay_signature !== expectedSign) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Payment verification failed",
      })
    }

    const payment = await razorpay.payments.fetch(razorpay_payment_id)

    if (payment.status !== "captured") {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Payment not completed",
      })
    }

    const orderResult = await placeOrderInternal(
      userId,
      addressId,
      "online",
      couponCode,
      {
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      },
      walletAmount,
    )

    if (orderResult.success) {
      res.status(statusCode.OK).json({
        success: true,
        message: "Order placed successfully",
        orderId: orderResult.orderId,
      })
    } else {
      res.status(statusCode.BAD_REQUEST).json(orderResult)
    }
  } catch (error) {
    console.log("Error verifying payment:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Payment verification failed. Please contact support.",
    })
  }
}

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user._id
    const { addressId, paymentMethod, couponCode, walletAmount } = req.body

    if (!addressId || !paymentMethod) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Address and payment method are required",
      })
    }

    if (paymentMethod === "COD" || paymentMethod === "wallet") {
      const orderResult = await placeOrderInternal(userId, addressId, paymentMethod, couponCode, null, walletAmount)

      if (orderResult.success) {
        res.status(statusCode.OK).json({
          success: true,
          message: "Order placed successfully",
          orderId: orderResult.orderId,
        })
      } else {
        res.status(statusCode.BAD_REQUEST).json(orderResult)
      }
    } else {
      res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Invalid payment method for this endpoint",
      })
    }
  } catch (error) {
    console.log("Error placing order:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to place order. Please try again.",
    })
  }
}

const placeOrderInternal = async (
  userId,
  addressId,
  paymentMethod,
  couponCode,
  paymentDetails = null,
  walletAmount = 0,
) => {
  try {
    const address = await Address.findOne({ _id: addressId, user: userId })
    if (!address) {
      return {
        success: false,
        message: "Invalid delivery address",
      }
    }

    const cart = await Cart.findOne({ user: userId }).populate({
      path: "products.product",
      populate: { path: "categoryId", model: "Category" },
    })

    if (!cart || cart.products.length === 0) {
      return {
        success: false,
        message: "Your cart is empty",
      }
    }

    const orderProducts = []
    let totalAmount = 0
    let applicableAmount = 0

    for (const item of cart.products) {
      const product = item.product

      if (!product || !product.isActive || product.isDeleted) {
        return {
          success: false,
          message: `Product ${product?.name || "Unknown"} is no longer available`,
        }
      }

      if (!product.categoryId || !product.categoryId.isListed) {
        return {
          success: false,
          message: `Product ${product.name} category is not available`,
        }
      }

      const variant = product.variants.find((v) => v.size === item.size)
      if (!variant || variant.varientquantity === 0 || item.quantity > variant.varientquantity) {
        return {
          success: false,
          message: `${product.name} (Size: ${item.size}) is not available in sufficient quantity`,
        }
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
    let couponId = null

    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() })

      if (coupon) {
        const now = new Date()
        const isValid =
          coupon.isActive &&
          now >= new Date(coupon.startDate) &&
          now <= new Date(coupon.expiryDate) &&
          (coupon.usageLimitGlobal === null || coupon.usedCount < coupon.usageLimitGlobal)

        if (isValid) {
          const userUsage = coupon.usedBy.find((usage) => usage.userId.toString() === userId.toString())
          const userCanUse =
            !userUsage || coupon.usageLimitPerUser === null || userUsage.count < coupon.usageLimitPerUser

          if (userCanUse && totalAmount >= coupon.minOrderAmount) {
            for (const item of cart.products) {
              const product = item.product
              const variant = product.variants.find((v) => v.size === item.size)
              const itemTotal = variant.salePrice * item.quantity

              const isProductApplicable =
                (coupon.applicableProducts.length === 0 ||
                  coupon.applicableProducts.some((p) => p.toString() === product._id.toString())) &&
                (coupon.applicableCategories.length === 0 ||
                  coupon.applicableCategories.some((c) => c.toString() === product.categoryId._id.toString()))

              if (isProductApplicable) {
                applicableAmount += itemTotal
              }
            }

            if (coupon.discountType === "percentage") {
              discount = (applicableAmount * coupon.discountValue) / 100
              if (coupon.maxDiscountValue && discount > coupon.maxDiscountValue) {
                discount = coupon.maxDiscountValue
              }
            } else {
              discount = coupon.discountValue
            }

            discount = Math.round(discount)
            couponId = coupon._id

            if (userUsage) {
              await Coupon.updateOne(
                { _id: coupon._id, "usedBy.userId": userId },
                {
                  $inc: {
                    usedCount: 1,
                    "usedBy.$.count": 1,
                  },
                  $set: { "usedBy.$.usedAt": new Date() },
                },
              )
            } else {
              await Coupon.updateOne(
                { _id: coupon._id },
                {
                  $inc: { usedCount: 1 },
                  $push: {
                    usedBy: {
                      userId: userId,
                      usedAt: new Date(),
                      count: 1,
                    },
                  },
                },
              )
            }
          }
        }
      }
    }

    let finalAmount = totalAmount + taxAmount - discount
    let walletUsed = 0

    if (walletAmount && walletAmount > 0) {
      const wallet = await Wallet.findOne({ userId })
      if (!wallet || wallet.balance < walletAmount) {
        return {
          success: false,
          message: "Insufficient wallet balance",
        }
      }

      walletUsed = Math.min(walletAmount, finalAmount)
      finalAmount -= walletUsed
    }

    const order = new Order({
      user: userId,
      products: orderProducts,
      address: addressId,
      totalAmount,
      discount,
      finalAmount: totalAmount + taxAmount - discount, // Original final amount
      paymentMethod: paymentMethod === "wallet" && finalAmount <= 0 ? "wallet" : paymentMethod,
      orderStatus: "pending",
      paymentStatus: paymentMethod === "COD" ? "pending" : finalAmount <= 0 ? "completed" : "completed",
      coupon: couponId,
      walletAmountUsed: walletUsed,
      remainingAmount: finalAmount,
    })

    if (paymentDetails) {
      order.paymentDetails = paymentDetails
    }

    if (!order.orderID) {
      const date = new Date()
      const year = date.getFullYear().toString().slice(-2)
      const month = ("0" + (date.getMonth() + 1)).slice(-2)
      const day = ("0" + date.getDate()).slice(-2)
      const random = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, "0")
      order.orderID = `ORD${year}${month}${day}${random}`
    }

    await order.save()

    if (walletUsed > 0) {
      const wallet = await Wallet.findOne({ userId })
      wallet.transactions.push({
        type: "debit",
        amount: walletUsed,
        orderId: order._id,
        reason: "Order payment",
        date: new Date(),
      })
      wallet.balance -= walletUsed
      await wallet.save()
    }

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

    return {
      success: true,
      orderId: order.orderID,
    }
  } catch (error) {
    console.log("Error in placeOrderInternal:", error)
    return {
      success: false,
      message: "Failed to place order. Please try again.",
    }
  }
}

const handlePaymentFailure = async (req, res) => {
  try {
    const { error, orderId, orderData } = req.body

    console.log("Payment failed:", { error, orderId })

    if (orderData) {
      const failedOrder = new Order({
        ...orderData,
        paymentStatus: "failed",
        paymentDetails: {
          failureReason: error.description || "Payment failed",
          retryCount: 0,
        },
      })
      await failedOrder.save()
    }

    res.status(statusCode.OK).json({
      success: false,
      message: "Payment failed",
      error: error,
      canRetry: true,
    })
  } catch (error) {
    console.log("Error handling payment failure:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Error processing payment failure",
    })
  }
}

const loadPaymentFailure = async (req, res) => {
  try {
    const user = req.session.user
    const { orderId, error } = req.query

    res.render("user/order-failure", {
      user,
      orderId: orderId || null,
      error: error ? JSON.parse(error) : null,
    })
  } catch (error) {
    console.log("Error loading payment failure page:", error)
    req.flash("error_msg", "Failed to load page")
    res.status(statusCode.INTERNAL_SERVER_ERROR).redirect("/")
  }
}

const retryPayment = async (req, res) => {
  try {
    const { orderId } = req.params
    const userId = req.session.user._id

    // Find the failed order
    const failedOrder = await Order.findOne({
      orderID: orderId,
      user: userId,
      paymentStatus: "failed",
    })

    if (!failedOrder) {
      req.flash("error_msg", "Order not found or cannot be retried")
      return res.redirect("/account/orders")
    }

    // Increment retry count
    failedOrder.paymentDetails.retryCount += 1
    await failedOrder.save()

    // Redirect to checkout with order data
    req.session.retryOrderData = {
      orderId: failedOrder._id,
      addressId: failedOrder.address,
      totalAmount: failedOrder.finalAmount,
    }

    res.redirect("/checkout")
  } catch (error) {
    console.log("Error retrying payment:", error)
    req.flash("error_msg", "Failed to retry payment")
    res.status(statusCode.INTERNAL_SERVER_ERROR).redirect("/")
  }
}

const loadOrderSuccess = async (req, res) => {
  try {
    const user = req.session.user
    const { orderId } = req.query
    const userId = req.session.user._id

    if (!orderId) {
      req.flash("error_msg", "Invalid order")
      return res.redirect("/")
    }

    const order = await Order.findOne({ orderID: orderId, user: userId })
      .populate("address")
      .populate({
        path: "products.product",
        select: "name images",
      })
      .populate("coupon", "code discountType discountValue")
      .lean()

    if (!order) {
      req.flash("error_msg", "Order not found")
      return res.redirect("/")
    }

    res.render("user/order-success", {
      user,
      order,
    })
  } catch (error) {
    console.log("Error loading order success:", error)
    req.flash("error_msg", "Failed to load order details")
    res.status(statusCode.INTERNAL_SERVER_ERROR).redirect("/")
  }
}

const createOrderWithWallet = async (req, res) => {
  try {
    const userId = req.session.user._id
    const { addressId, couponCode, useWalletAmount } = req.body

    if (!addressId) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Address is required",
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

    let totalAmount = 0
    for (const item of cart.products) {
      const product = item.product
      const variant = product.variants.find((v) => v.size === item.size)
      if (!variant || variant.varientquantity === 0 || item.quantity > variant.varientquantity) {
        return res.status(statusCode.BAD_REQUEST).json({
          success: false,
          message: `${product.name} (Size: ${item.size}) is not available in sufficient quantity`,
        })
      }
      totalAmount += variant.salePrice * item.quantity
    }

    const taxAmount = Math.round(totalAmount * 0.18)
    let discount = 0

    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase() })
      if (coupon && coupon.isActive) {
        if (coupon.discountType === "percentage") {
          discount = Math.min(
            (totalAmount * coupon.discountValue) / 100,
            coupon.maxDiscountValue || Number.POSITIVE_INFINITY,
          )
        } else {
          discount = coupon.discountValue
        }
        discount = Math.round(discount)
      }
    }

    const finalAmount = totalAmount + taxAmount - discount

    const wallet = await Wallet.findOne({ userId })
    if (!wallet || wallet.balance < finalAmount) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: `Insufficient wallet balance. Required: ₹${finalAmount}, Available: ₹${wallet ? wallet.balance : 0}`,
      })
    }

    const orderResult = await placeOrderInternal(userId, addressId, "wallet", couponCode, null, finalAmount)

    if (orderResult.success) {
      res.status(statusCode.OK).json({
        success: true,
        orderId: orderResult.orderId,
        message: "Order placed successfully using wallet",
      })
    } else {
      res.status(statusCode.BAD_REQUEST).json(orderResult)
    }
  } catch (error) {
    console.log("Error creating order with wallet:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to create order. Please try again.",
    })
  }
}

const verifyPartialPayment = async (req, res) => {
  try {
    return res.status(statusCode.BAD_REQUEST).json({
      success: false,
      message: "Partial wallet payments are not supported. Please use full wallet payment or other payment methods.",
    })
  } catch (error) {
    console.log("Error in partial payment:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Payment verification failed. Please contact support.",
    })
  }
}

const validateCoupon = async (req, res) => {
  try {
    const userId = req.session.user._id
    const { code } = req.body

    if (!code) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Coupon code is required",
      })
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase() })

    if (!coupon) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Invalid coupon code",
      })
    }

    if (!coupon.isActive) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "This coupon is inactive",
      })
    }

    const now = new Date()
    if (now < new Date(coupon.startDate) || now > new Date(coupon.expiryDate)) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: now < new Date(coupon.startDate) ? "This coupon is not active yet" : "This coupon has expired",
      })
    }

    if (coupon.usageLimitGlobal !== null && coupon.usedCount >= coupon.usageLimitGlobal) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "This coupon has reached its usage limit",
      })
    }

    const userUsage = coupon.usedBy.find((usage) => usage.userId.toString() === userId.toString())
    if (userUsage && coupon.usageLimitPerUser !== null && userUsage.count >= coupon.usageLimitPerUser) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "You have already used this coupon the maximum number of times",
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

    let totalAmount = 0
    let applicableAmount = 0
    const applicableProducts = []

    for (const item of cart.products) {
      const product = item.product
      const variant = product.variants.find((v) => v.size === item.size)
      const itemTotal = variant.salePrice * item.quantity
      totalAmount += itemTotal

      const isProductApplicable =
        (coupon.applicableProducts.length === 0 ||
          coupon.applicableProducts.some((p) => p.toString() === product._id.toString())) &&
        (coupon.applicableCategories.length === 0 ||
          coupon.applicableCategories.some((c) => c.toString() === product.categoryId._id.toString()))

      if (isProductApplicable) {
        applicableAmount += itemTotal
        applicableProducts.push({
          name: product.name,
          price: variant.salePrice,
          quantity: item.quantity,
        })
      }
    }

    if (coupon.minOrderAmount > 0 && totalAmount < coupon.minOrderAmount) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: `Minimum order amount of ₹${coupon.minOrderAmount} required for this coupon`,
      })
    }

    let discountAmount = 0
    if (coupon.discountType === "percentage") {
      discountAmount = (applicableAmount * coupon.discountValue) / 100
      if (coupon.maxDiscountValue && discountAmount > coupon.maxDiscountValue) {
        discountAmount = coupon.maxDiscountValue
      }
    } else {
      discountAmount = Math.min(coupon.discountValue, applicableAmount)
    }

    discountAmount = Math.round(discountAmount)

    res.status(statusCode.OK).json({
      success: true,
      message: "Coupon is valid",
      coupon: {
        code: coupon.code,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: discountAmount,
        maxDiscountValue: coupon.maxDiscountValue,
        applicableAmount: applicableAmount,
      },
      applicableProducts: applicableProducts.length > 0 ? applicableProducts : null,
    })
  } catch (error) {
    console.log("Error validating coupon:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      // message: "Failed to validate coupon",
    })
  }
}

module.exports = {
  loadCheckout,
  createRazorpayOrder,
  verifyPaymentAndPlaceOrder,
  placeOrder,
  createOrderWithWallet,
  verifyPartialPayment,
  validateCoupon,
  handlePaymentFailure,
  loadPaymentFailure,
  retryPayment,
  loadOrderSuccess,
}
