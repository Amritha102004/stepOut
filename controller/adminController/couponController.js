const Coupon = require("../../model/couponModel")
const Category = require("../../model/categoryModel")
const Product = require("../../model/productModel")
const mongoose = require("mongoose")
const statusCode = require("../../utils/httpStatusCodes")

const loadCoupons = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = 10
    const skip = (page - 1) * limit
    const searchQuery = req.query.search || ""
    const statusFilter = req.query.status || ""
    const filter = {}

    if (searchQuery) {
      filter.$or = [
        { code: { $regex: searchQuery, $options: "i" } },
        { description: { $regex: searchQuery, $options: "i" } },
      ]
    }

    const currentDate = new Date()
    if (statusFilter === "active") {
      filter.isActive = true
      filter.startDate = { $lte: currentDate }
      filter.expiryDate = { $gte: currentDate }
    } else if (statusFilter === "inactive") {
      filter.isActive = false
    } else if (statusFilter === "expired") {
      filter.expiryDate = { $lt: currentDate }
    }

    const totalCoupons = await Coupon.countDocuments(filter)
    const totalPages = Math.ceil(totalCoupons / limit)

    const coupons = await Coupon.find(filter)
      .populate("applicableCategories", "name")
      .populate("applicableProducts", "name")
      .populate("createdByAdmin", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    const couponsWithStatus = coupons.map((coupon) => {
      let status = "inactive"
      const now = new Date()

      if (coupon.isActive) {
        if (now < coupon.startDate) {
          status = "scheduled"
        } else if (now > coupon.expiryDate) {
          status = "expired"
        } else if (coupon.usageLimitGlobal && coupon.usedCount >= coupon.usageLimitGlobal) {
          status = "limit_reached"
        } else {
          status = "active"
        }
      }

      return { ...coupon, computedStatus: status }
    })

    const admin = req.session.admin
      ? {
          name: req.session.admin.name,
          email: req.session.admin.email,
        }
      : {}

    res.render("admin/coupons", {
      admin,
      coupons: couponsWithStatus,
      currentPage: page,
      totalPages,
      totalCoupons,
      searchQuery,
      statusFilter,
      limit,
      query: req.query,
    })
  } catch (error) {
    console.error("Error loading coupons:", error)
    req.flash("error_msg", "Failed to load coupons")
    res.status(statusCode.INTERNAL_SERVER_ERROR).render("admin/coupons", {
      admin: req.session.admin || {},
      coupons: [],
      currentPage: 1,
      totalPages: 0,
      totalCoupons: 0,
      searchQuery: req.query.search || "",
      statusFilter: req.query.status || "",
      query: req.query,
      error_msg: "Failed to load coupons",
    })
  }
}

const loadAddCoupon = async (req, res) => {
  try {
    const categories = await Category.find({ isListed: true }).select("name").lean()
    const products = await Product.find({ isActive: true, isDeleted: false }).select("name").lean()

    const admin = {
      name: req.session.admin.name,
      email: req.session.admin.email,
    }

    res.render("admin/addCoupon", {
      admin,
      categories,
      products,
      errors:null,
      formData:null,
    })
  } catch (error) {
    console.error("Error loading add coupon page:", error)
    req.flash("error_msg", "Failed to load page")
    res.status(statusCode.INTERNAL_SERVER_ERROR).redirect("/admin/coupons")
  }
}

const addCoupon = async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      maxDiscountValue,
      minOrderAmount,
      startDate,
      expiryDate,
      usageLimitGlobal,
      usageLimitPerUser,
      applicableCategories,
      applicableProducts,
    } = req.body

    const errors = {}

    if (!code || code.trim().length < 3) {
      errors.code = "Coupon code must be at least 3 characters long"
    }

    if (!discountType || !["fixed", "percentage"].includes(discountType)) {
      errors.discountType = "Please select a valid discount type"
    }

    if (!discountValue || discountValue <= 0) {
      errors.discountValue = "Discount value must be greater than 0"
    }

    if (discountType === "percentage" && discountValue > 100) {
      errors.discountValue = "Percentage discount cannot exceed 100%"
    }

    if (!startDate) {
      errors.startDate = "Start date is required"
    }

    if (!expiryDate) {
      errors.expiryDate = "Expiry date is required"
    }

    if (startDate && expiryDate && new Date(startDate) >= new Date(expiryDate)) {
      errors.expiryDate = "Expiry date must be after start date"
    }

    const existingCoupon = await Coupon.findOne({
      code: code.toUpperCase().trim(),
    })

    if (existingCoupon) {
      errors.code = "Coupon code already exists"
    }

    if (Object.keys(errors).length > 0) {
      const categories = await Category.find({ isListed: true }).select("name").lean()
      const products = await Product.find({ isActive: true, isDeleted: false }).select("name").lean()

      return res.render("admin/addCoupon", {
        admin: req.session.admin,
        categories,
        products,
        errors,
        formData: req.body,
      })
    }

    const newCoupon = new Coupon({
      code: code.toUpperCase().trim(),
      description: description || "",
      discountType,
      discountValue: Number.parseFloat(discountValue),
      maxDiscountValue: maxDiscountValue ? Number.parseFloat(maxDiscountValue) : null,
      minOrderAmount: minOrderAmount ? Number.parseFloat(minOrderAmount) : 0,
      startDate: new Date(startDate),
      expiryDate: new Date(expiryDate),
      usageLimitGlobal: usageLimitGlobal ? Number.parseInt(usageLimitGlobal) : null,
      usageLimitPerUser: usageLimitPerUser ? Number.parseInt(usageLimitPerUser) : 1,
      applicableCategories: applicableCategories || [],
      applicableProducts: applicableProducts || [],
      createdByAdmin: req.session.admin._id,
      isActive: true,
    })

    await newCoupon.save()

    req.flash("success_msg", "Coupon created successfully")
    res.redirect("/admin/coupons")
  } catch (error) {
    console.error("Error adding coupon:", error)
    req.flash("error_msg", "Failed to create coupon")
    res.redirect("/admin/addCoupon")
  }
}

const loadEditCoupon = async (req, res) => {
  try {
    const couponId = req.query.id

    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      req.flash("error_msg", "Invalid coupon ID")
      return res.redirect("/admin/coupons")
    }

    const coupon = await Coupon.findById(couponId)
      .populate("applicableCategories", "name")
      .populate("applicableProducts", "name")
      .lean()

    if (!coupon) {
      req.flash("error_msg", "Coupon not found")
      return res.redirect("/admin/coupons")
    }

    const categories = await Category.find({ isListed: true }).select("name").lean()
    const products = await Product.find({ isActive: true, isDeleted: false }).select("name").lean()

    const admin = {
      name: req.session.admin.name,
      email: req.session.admin.email,
    }

    res.render("admin/editCoupon", {
      admin,
      coupon,
      categories,
      products,
    })
  } catch (error) {
    console.error("Error loading edit coupon page:", error)
    req.flash("error_msg", "Failed to load coupon details")
    res.status(statusCode.INTERNAL_SERVER_ERROR).redirect("/admin/coupons")
  }
}

const updateCoupon = async (req, res) => {
  try {
    const couponId = req.params.id
    const {
      code,
      description,
      discountType,
      discountValue,
      maxDiscountValue,
      minOrderAmount,
      startDate,
      expiryDate,
      usageLimitGlobal,
      usageLimitPerUser,
      applicableCategories,
      applicableProducts,
      isActive,
    } = req.body

    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Invalid coupon ID",
      })
    }

    const coupon = await Coupon.findById(couponId)
    if (!coupon) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Coupon not found",
      })
    }

    const errors = {}
    if (!code || code.trim().length < 3) {
      errors.code = "Coupon code must be at least 3 characters long"
    }
    const existingCoupon = await Coupon.findOne({
      code: code.toUpperCase().trim(),
      _id: { $ne: couponId },
    })

    if (existingCoupon) {
      errors.code = "Coupon code already exists"
    }

    if (!discountType || !["fixed", "percentage"].includes(discountType)) {
      errors.discountType = "Please select a valid discount type"
    }

    if (!discountValue || discountValue <= 0) {
      errors.discountValue = "Discount value must be greater than 0"
    }

    if (discountType === "percentage" && discountValue > 100) {
      errors.discountValue = "Percentage discount cannot exceed 100%"
    }

    if (!startDate) {
      errors.startDate = "Start date is required"
    }

    if (!expiryDate) {
      errors.expiryDate = "Expiry date is required"
    }

    if (startDate && expiryDate && new Date(startDate) >= new Date(expiryDate)) {
      errors.expiryDate = "Expiry date must be after start date"
    }

    if (Object.keys(errors).length > 0) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Validation failed",
        errors,
      })
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      {
        code: code.toUpperCase().trim(),
        description: description || "",
        discountType,
        discountValue: Number.parseFloat(discountValue),
        maxDiscountValue: maxDiscountValue ? Number.parseFloat(maxDiscountValue) : null,
        minOrderAmount: minOrderAmount ? Number.parseFloat(minOrderAmount) : 0,
        startDate: new Date(startDate),
        expiryDate: new Date(expiryDate),
        usageLimitGlobal: usageLimitGlobal ? Number.parseInt(usageLimitGlobal) : null,
        usageLimitPerUser: usageLimitPerUser ? Number.parseInt(usageLimitPerUser) : 1,
        applicableCategories: applicableCategories || [],
        applicableProducts: applicableProducts || [],
        isActive: isActive === "true",
      },
      { new: true },
    )

    res.status(statusCode.OK).json({
      success: true,
      message: "Coupon updated successfully",
      coupon: updatedCoupon,
    })
  } catch (error) {
    console.error("Error updating coupon:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update coupon",
    })
  }
}

const toggleCouponStatus = async (req, res) => {
  try {
    const couponId = req.params.id

    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Invalid coupon ID",
      })
    }

    const coupon = await Coupon.findById(couponId)
    if (!coupon) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Coupon not found",
      })
    }

    coupon.isActive = !coupon.isActive
    await coupon.save()

    res.status(statusCode.OK).json({
      success: true,
      message: `Coupon ${coupon.isActive ? "activated" : "deactivated"} successfully`,
      isActive: coupon.isActive,
    })
  } catch (error) {
    console.error("Error toggling coupon status:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update coupon status",
    })
  }
}

const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id

    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Invalid coupon ID",
      })
    }

    const coupon = await Coupon.findById(couponId)
    if (!coupon) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Coupon not found",
      })
    }

    if (coupon.usedCount > 0) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Cannot delete coupon that has been used",
      })
    }

    await Coupon.findByIdAndDelete(couponId)

    res.status(statusCode.OK).json({
      success: true,
      message: "Coupon deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting coupon:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to delete coupon",
    })
  }
}

const getCouponDetails = async (req, res) => {
  try {
    const couponId = req.params.id

    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Invalid coupon ID",
      })
    }

    const coupon = await Coupon.findById(couponId)
      .populate("applicableCategories", "name")
      .populate("applicableProducts", "name")
      .populate("createdByAdmin", "name email")
      .lean()

    if (!coupon) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Coupon not found",
      })
    }

    let status = "inactive"
    const now = new Date()

    if (coupon.isActive) {
      if (now < coupon.startDate) {
        status = "scheduled"
      } else if (now > coupon.expiryDate) {
        status = "expired"
      } else if (coupon.usageLimitGlobal && coupon.usedCount >= coupon.usageLimitGlobal) {
        status = "limit_reached"
      } else {
        status = "active"
      }
    }

    res.status(statusCode.OK).json({
      success: true,
      coupon: { ...coupon, computedStatus: status },
    })
  } catch (error) {
    console.error("Error getting coupon details:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get coupon details",
    })
  }
}

const generateCouponCode = async (req, res) => {
  try {
    const { prefix = "", length = 8 } = req.query

    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let code = prefix.toUpperCase()

    for (let i = 0; i < length; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length))
    }

    const existingCoupon = await Coupon.findOne({ code })
    if (existingCoupon) {
      return generateCouponCode(req, res)
    }

    res.status(statusCode.OK).json({
      success: true,
      code,
    })
  } catch (error) {
    console.error("Error generating coupon code:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to generate coupon code",
    })
  }
}

module.exports = {
  loadCoupons,
  loadAddCoupon,
  addCoupon,
  loadEditCoupon,
  updateCoupon,
  toggleCouponStatus,
  deleteCoupon,
  getCouponDetails,
  generateCouponCode,
}
