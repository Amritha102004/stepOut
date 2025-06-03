const Coupon = require("../../model/couponModel")
const User = require("../../model/userModel")
const Cart = require("../../model/cartModel")
const mongoose = require("mongoose")
const statusCode = require("../../utils/httpStatusCodes")

const validateCoupon = async (req, res) => {
  try {
    const { code } = req.body
    const userId = req.session.user._id

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

    let cartTotal = 0
    const applicableProducts = []
    let applicableAmount = 0

    for (const item of cart.products) {
      const product = item.product

      if (!product || !product.isActive || product.isDeleted || !product.categoryId || !product.categoryId.isListed) {
        continue
      }

      const variant = product.variants.find((v) => v.size === item.size)
      if (!variant || variant.varientquantity === 0) {
        continue
      }

      const itemTotal = variant.salePrice * item.quantity
      cartTotal += itemTotal

      const isProductApplicable =
        (coupon.applicableProducts.length === 0 ||
          coupon.applicableProducts.some((p) => p.toString() === product._id.toString())) &&
        (coupon.applicableCategories.length === 0 ||
          coupon.applicableCategories.some((c) => c.toString() === product.categoryId._id.toString()))

      if (isProductApplicable) {
        applicableProducts.push({
          id: product._id,
          name: product.name,
          price: variant.salePrice,
          quantity: item.quantity,
          total: itemTotal,
        })
        applicableAmount += itemTotal
      }
    }

    if (coupon.minOrderAmount > 0 && cartTotal < coupon.minOrderAmount) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: `Minimum order amount of ₹${coupon.minOrderAmount} required for this coupon`,
        minOrderAmount: coupon.minOrderAmount,
        currentAmount: cartTotal,
      })
    }

    let discountAmount = 0
    if (coupon.discountType === "percentage") {
      discountAmount = (applicableAmount * coupon.discountValue) / 100

      if (coupon.maxDiscountValue && discountAmount > coupon.maxDiscountValue) {
        discountAmount = coupon.maxDiscountValue
      }
    } else {
      discountAmount = coupon.discountValue
    }

    discountAmount = Math.round(discountAmount)

    res.status(statusCode.OK).json({
      success: true,
      message: "Coupon applied successfully",
      coupon: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: discountAmount,
        description: coupon.description,
        minOrderAmount: coupon.minOrderAmount,
        expiryDate: coupon.expiryDate,
        maxDiscountValue: coupon.maxDiscountValue,
      },
      applicableProducts: applicableProducts.length === cart.products.length ? [] : applicableProducts,
      applicableAmount: applicableAmount,
      cartTotal: cartTotal,
    })
  } catch (error) {
    console.log("Error validating coupon:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to validate coupon. Please try again.",
    })
  }
}

const getAvailableCoupons = async (req, res) => {
  try {
    const userId = req.session.user._id
    const now = new Date()

    const coupons = await Coupon.find({
      isActive: true,
      startDate: { $lte: now },
      expiryDate: { $gt: now },
    }).lean()

    const availableCoupons = coupons.filter((coupon) => {
      if (coupon.usageLimitGlobal !== null && coupon.usedCount >= coupon.usageLimitGlobal) {
        return false
      }

      const userUsage = coupon.usedBy.find((usage) => usage.userId.toString() === userId.toString())
      if (userUsage && coupon.usageLimitPerUser !== null && userUsage.count >= coupon.usageLimitPerUser) {
        return false
      }

      return true
    })

    const formattedCoupons = availableCoupons.map((coupon) => ({
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscountValue: coupon.maxDiscountValue,
      minOrderAmount: coupon.minOrderAmount,
      expiryDate: coupon.expiryDate,
      hasProductRestrictions: coupon.applicableProducts.length > 0 || coupon.applicableCategories.length > 0,
    }))

    res.status(statusCode.OK).json({
      success: true,
      coupons: formattedCoupons,
    })
  } catch (error) {
    console.log("Error fetching available coupons:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to fetch available coupons. Please try again.",
    })
  }
}

module.exports = {
  validateCoupon,
  getAvailableCoupons,
}
