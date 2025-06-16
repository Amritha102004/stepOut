const User = require('../../model/userModel');
const Order = require("../../model/orderModel");
const Product = require("../../model/productModel");
const Category = require("../../model/categoryModel");
const env = require('dotenv').config();
const bcrypt = require("bcrypt");
const statusCode = require("../../utils/httpStatusCodes")

const loadDashboard = async (req, res) => {
  try {
    const period = req.query.period || "month"
    const paymentMethod = req.query.paymentMethod || "all"
    const orderStatus = req.query.orderStatus || "all"

    // Get date range based on period
    let dateRange
    if (period === "custom") {
      const startDate = req.query.startDate
        ? new Date(req.query.startDate)
        : new Date(new Date().setMonth(new Date().getMonth() - 1))
      const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date()

      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(23, 59, 59, 999)

      dateRange = { startDate, endDate }
    } else {
      dateRange = getDateRange(period)
    }

    // Get dashboard stats
    const dashboardStats = await getDashboardStats()

    // Get latest orders
    const latestOrders = await Order.find()
      .populate("user", "name email")
      .populate("address")
      .populate({
        path: "products.product",
        select: "name images",
      })
      .sort({ orderDate: -1 })
      .limit(3)
      .lean()

    // Get chart data
    const dailyRevenue = await getDailyRevenue(dateRange.startDate, dateRange.endDate)
    const paymentMethodCounts = await getPaymentMethodCounts(dateRange.startDate, dateRange.endDate)
    const orderStatusCounts = await getOrderStatusCounts(dateRange.startDate, dateRange.endDate)

    // Get best selling data
    const topProducts = await getTopSellingProducts(dateRange.startDate, dateRange.endDate, 10)
    const topCategories = await getTopSellingCategories(dateRange.startDate, dateRange.endDate, 10)
    const topBrands = await getTopSellingBrands(dateRange.startDate, dateRange.endDate, 10)

    res.render("admin/dashboard", {
      admin: req.session.admin,
      activePage: "dashboard",
      dashboardStats,
      latestOrders,
      period,
      paymentMethod,
      orderStatus,
      startDate: dateRange.startDate.toISOString().split("T")[0],
      endDate: dateRange.endDate.toISOString().split("T")[0],
      query: req.query,
      dailyRevenue,
      paymentMethodCounts,
      orderStatusCounts,
      topProducts,
      topCategories,
      topBrands,
      formatCurrency,
      formatDate,
    })
  } catch (error) {
    console.log("something wrong:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).send(error)
  }
}

const getDashboardStats = async () => {
  try {
    const now = new Date()
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const totalOrders = await Order.countDocuments()
    const lastMonthOrders = await Order.countDocuments({
      orderDate: { $gte: lastMonth },
    })
    const orderGrowth = lastMonthOrders > 0 ? Math.round(((totalOrders - lastMonthOrders) / lastMonthOrders) * 100) : 0

    const totalUsers = await User.countDocuments({ isAdmin: false })
    const lastMonthUsers = await User.countDocuments({
      isAdmin: false,
      createdAt: { $gte: lastMonth },
    })
    const userGrowth = lastMonthUsers > 0 ? Math.round(((totalUsers - lastMonthUsers) / lastMonthUsers) * 100) : 0

    const revenueResult = await Order.aggregate([
      { $match: { orderStatus: { $ne: "cancelled" } } },
      { $group: { _id: null, total: { $sum: "$finalAmount" } } },
    ])
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0

    const lastMonthRevenueResult = await Order.aggregate([
      {
        $match: {
          orderStatus: { $ne: "cancelled" },
          orderDate: { $gte: lastMonth },
        },
      },
      { $group: { _id: null, total: { $sum: "$finalAmount" } } },
    ])
    const lastMonthRevenue = lastMonthRevenueResult.length > 0 ? lastMonthRevenueResult[0].total : 0
    const revenueGrowth =
      lastMonthRevenue > 0 ? Math.round(((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) : 0

    const totalVisitors = 2500
    const visitorGrowth = 12

    return {
      totalOrders,
      orderGrowth,
      totalUsers,
      userGrowth,
      totalRevenue,
      revenueGrowth,
      totalVisitors,
      visitorGrowth,
    }
  } catch (error) {
    console.log("Error getting dashboard stats:", error)
    return {
      totalOrders: 0,
      orderGrowth: 0,
      totalUsers: 0,
      userGrowth: 0,
      totalRevenue: 0,
      revenueGrowth: 0,
      totalVisitors: 0,
      visitorGrowth: 0,
    }
  }
}

// Helper function to get date range based on period
const getDateRange = (period) => {
  const now = new Date()
  let startDate, endDate = new Date()

  switch (period) {
    case "day":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      break
    case "week":
      const dayOfWeek = now.getDay()
      startDate = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000)
      startDate.setHours(0, 0, 0, 0)
      break
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1)
      break
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  endDate.setHours(23, 59, 59, 999)
  return { startDate, endDate }
}

// Get daily revenue data for charts
const getDailyRevenue = async (startDate, endDate) => {
  const pipeline = [
    {
      $match: {
        orderDate: { $gte: startDate, $lte: endDate },
        orderStatus: { $nin: ["cancelled"] },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$orderDate" },
        },
        revenue: { $sum: "$finalAmount" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]

  const result = await Order.aggregate(pipeline)

  const labels = result.map((item) => item._id)
  const revenue = result.map((item) => item.revenue)
  const orders = result.map((item) => item.orders)

  return { labels, revenue, orders }
}

// Get payment method distribution
const getPaymentMethodCounts = async (startDate, endDate) => {
  const pipeline = [
    {
      $match: {
        orderDate: { $gte: startDate, $lte: endDate },
        orderStatus: { $nin: ["cancelled"] },
      },
    },
    {
      $group: {
        _id: "$paymentMethod",
        count: { $sum: 1 },
        revenue: { $sum: "$finalAmount" },
      },
    },
  ]

  return await Order.aggregate(pipeline)
}

// Get order status distribution
const getOrderStatusCounts = async (startDate, endDate) => {
  const pipeline = [
    {
      $match: {
        orderDate: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: "$orderStatus",
        count: { $sum: 1 },
      },
    },
  ]

  return await Order.aggregate(pipeline)
}

// Get top selling products
const getTopSellingProducts = async (startDate, endDate, limit = 10) => {
  const pipeline = [
    {
      $match: {
        orderDate: { $gte: startDate, $lte: endDate },
        orderStatus: { $nin: ["cancelled", "returned"] },
      },
    },
    { $unwind: "$products" },
    {
      $group: {
        _id: "$products.product",
        totalQuantity: { $sum: "$products.quantity" },
        totalRevenue: { $sum: { $multiply: ["$products.variant.salePrice", "$products.quantity"] } },
      },
    },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "productDetails",
      },
    },
    { $unwind: "$productDetails" },
    {
      $project: {
        _id: 1,
        name: "$productDetails.name",
        brand: "$productDetails.brand",
        totalQuantity: 1,
        totalRevenue: 1,
        image: { $arrayElemAt: ["$productDetails.images", 0] },
      },
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: limit },
  ]

  return await Order.aggregate(pipeline)
}

// Get top selling categories
const getTopSellingCategories = async (startDate, endDate, limit = 10) => {
  const pipeline = [
    {
      $match: {
        orderDate: { $gte: startDate, $lte: endDate },
        orderStatus: { $nin: ["cancelled", "returned"] },
      },
    },
    { $unwind: "$products" },
    {
      $lookup: {
        from: "products",
        localField: "products.product",
        foreignField: "_id",
        as: "productDetails",
      },
    },
    { $unwind: "$productDetails" },
    {
      $group: {
        _id: "$productDetails.categoryId",
        totalQuantity: { $sum: "$products.quantity" },
        totalRevenue: { $sum: { $multiply: ["$products.variant.salePrice", "$products.quantity"] } },
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "_id",
        as: "categoryDetails",
      },
    },
    { $unwind: "$categoryDetails" },
    {
      $project: {
        _id: 1,
        name: "$categoryDetails.name",
        totalQuantity: 1,
        totalRevenue: 1,
      },
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: limit },
  ]

  return await Order.aggregate(pipeline)
}

// Get top selling brands
const getTopSellingBrands = async (startDate, endDate, limit = 10) => {
  const pipeline = [
    {
      $match: {
        orderDate: { $gte: startDate, $lte: endDate },
        orderStatus: { $nin: ["cancelled", "returned"] },
      },
    },
    { $unwind: "$products" },
    {
      $lookup: {
        from: "products",
        localField: "products.product",
        foreignField: "_id",
        as: "productDetails",
      },
    },
    { $unwind: "$productDetails" },
    {
      $match: {
        "productDetails.brand": { $ne: null, $ne: "" },
      },
    },
    {
      $group: {
        _id: "$productDetails.brand",
        totalQuantity: { $sum: "$products.quantity" },
        totalRevenue: { $sum: { $multiply: ["$products.variant.salePrice", "$products.quantity"] } },
      },
    },
    {
      $project: {
        _id: 1,
        name: "$_id",
        totalQuantity: 1,
        totalRevenue: 1,
      },
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: limit },
  ]

  return await Order.aggregate(pipeline)
}

// Format currency helper
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Format date helper
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

module.exports = {
  loadDashboard,
}