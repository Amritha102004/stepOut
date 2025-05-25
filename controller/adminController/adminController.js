const User = require('../../model/userModel');
const Order = require("../../model/orderModel");
const env = require('dotenv').config();
const bcrypt = require("bcrypt");
const statusCode = require("../../utils/httpStatusCodes")

const loadlogin=async (req,res)=>{
    try {
        if(req.session.admin){
            return res.redirect('/admin/dashboard');
        }
            res.render('admin/login',{error:null});
        
    } catch (error) {
        console.log("admin login page not loading:", error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).send("server error");
    }
}

const login = async (req, res) => {
    try {

        const { email, password } = req.body;
        const findadmin = await User.findOne({ isAdmin: true, email: email })

        if (!findadmin) {
            return res.render("admin/login", { error: "invalid credentials" })
        }

        const passwordmatch = await bcrypt.compare(password, findadmin.password)
        if (!passwordmatch) {
            return res.render('admin/login', { error: "incorrect password" })
        }
 
        req.session.admin = {
            id: findadmin._id,
            email: findadmin.email,
            name:findadmin.fullName,
            isAdmin:findadmin.isAdmin,
          };
        res.redirect('/admin/dashboard')

    } catch (error) {

        console.log('loggin error', error);
        res.render('admin/login', { error: "login failed , please try again later" })

    }
}

const loadDashboard = async (req, res) => {
  try {
    const dashboardStats = await getDashboardStats()

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

    res.render("admin/dashboard", {
      dashboardStats,
      latestOrders,
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


const logout=async (req,res)=>{
    try {
        req.session.destroy(() => {
            res.redirect('/admin/login');                   
        });
    } catch (error) {
        console.log('error during logout:',error);
        res.status(statusCode.INTERNAL_SERVER_ERROR).send('error during logout');
    }
}


module.exports = {
    loadlogin,
    login,
    loadDashboard,
    logout,
}