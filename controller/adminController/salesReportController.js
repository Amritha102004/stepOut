const Order = require("../../model/orderModel")
const User = require("../../model/userModel")
const Product = require("../../model/productModel")
const PDFDocument = require("pdfkit")
const ExcelJS = require("exceljs")
const fs = require("fs")
const path = require("path")
const statusCode = require("../../utils/httpStatusCodes")
const mongoose = require("mongoose")


const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount)
}


const formatDate = (date) => {
  return new Date(date).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}


const getDateRange = (period) => {
  const endDate = new Date()
  const startDate = new Date()

  switch (period) {
    case "today":
      startDate.setHours(0, 0, 0, 0)
      break
    case "yesterday":
      startDate.setDate(startDate.getDate() - 1)
      startDate.setHours(0, 0, 0, 0)
      endDate.setDate(endDate.getDate() - 1)
      endDate.setHours(23, 59, 59, 999)
      break
    case "week":
      startDate.setDate(startDate.getDate() - 7)
      break
    case "month":
      startDate.setMonth(startDate.getMonth() - 1)
      break
    case "year":
      startDate.setFullYear(startDate.getFullYear() - 1)
      break
    case "custom":
      return null 
    default:
      startDate.setDate(startDate.getDate() - 30) 
  }

  return { startDate, endDate }
}


const loadSalesReport = async (req, res) => {
  try {
    const period = req.query.period || "month"
    const paymentMethod = req.query.paymentMethod || "all"
    const orderStatus = req.query.orderStatus || "all"

    const analysisPage = parseInt(req.query.analysisPage) || 1
    const ordersPage = parseInt(req.query.ordersPage) || 1
    const limit = 5

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

    const filter = {
      orderDate: {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      },
    }

    if (paymentMethod !== "all") {
      filter.paymentMethod = paymentMethod
    }

    if (orderStatus !== "all") {
      filter.orderStatus = orderStatus
    }

    const salesAnalysis = await getSalesAnalysis(dateRange.startDate, dateRange.endDate, period, analysisPage, limit)

    const ordersSkip = (ordersPage - 1) * limit
    const orders = await Order.find(filter)
      .populate("user", "fullName email")
      .populate("products.product", "name")
      .populate("coupon")
      .sort({ orderDate: -1 })
      .skip(ordersSkip)
      .limit(limit)

    const totalOrdersCount = await Order.countDocuments(filter)
    const totalOrdersPages = Math.ceil(totalOrdersCount / limit)


    const allOrders = await Order.find(filter)
    const totalOrders = allOrders.length
    const totalRevenue = allOrders.reduce((sum, order) => sum + order.finalAmount, 0)
    const totalDiscount = allOrders.reduce((sum, order) => sum + order.discount, 0)
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
    const couponUsage = allOrders.filter((order) => order.coupon).length

    res.render("admin/salesReport", {
      admin: req.session.admin,
      activePage: "salesReport",
      orders,
      salesAnalysis,
      period,
      paymentMethod,
      orderStatus,
      startDate: dateRange.startDate.toISOString().split("T")[0],
      endDate: dateRange.endDate.toISOString().split("T")[0],
      query: req.query,
      summary: {
        totalOrders,
        totalRevenue,
        totalDiscount,
        avgOrderValue,
        couponUsage,
      },
      pagination: {
        analysis: {
          currentPage: analysisPage,
          totalPages: salesAnalysis.totalPages,
          hasNext: analysisPage < salesAnalysis.totalPages,
          hasPrev: analysisPage > 1,
          totalCount: salesAnalysis.totalCount
        },
        orders: {
          currentPage: ordersPage,
          totalPages: totalOrdersPages,
          hasNext: ordersPage < totalOrdersPages,
          hasPrev: ordersPage > 1,
          totalCount: totalOrdersCount
        }
      },
      formatCurrency,
      formatDate,
    })
  } catch (error) {
    console.error("Error loading sales report:", error)
    req.flash("error_msg", "Failed to load sales report")
    res.status(statusCode.INTERNAL_SERVER_ERROR).redirect("/admin/dashboard")
  }
}

const getSalesAnalysis = async (startDate, endDate, period, page = 1, limit = 10) => {
  let groupByFormat
  let sortField = "_id"

  switch (period) {
    case "today":
      groupByFormat = "%Y-%m-%d %H:00" 
      break
    case "week":
      groupByFormat = "%Y-%m-%d" 
      break
    case "month":
      groupByFormat = "%Y-%m-%d" 
      break
    case "year":
      groupByFormat = "%Y-%m" 
      break
    case "custom":
      const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
      if (daysDiff <= 1) {
        groupByFormat = "%Y-%m-%d %H:00" 
      } else if (daysDiff <= 31) {
        groupByFormat = "%Y-%m-%d" 
      } else if (daysDiff <= 365) {
        groupByFormat = "%Y-%m" 
      } else {
        groupByFormat = "%Y" 
      }
      break
    default:
      groupByFormat = "%Y-%m-%d"
  }

  const pipeline = [
    {
      $match: {
        orderDate: { $gte: startDate, $lte: endDate },
        orderStatus: { $nin: ["cancelled"] }
      }
    },
    {
      $addFields: {
        productDiscount: {
          $reduce: {
            input: "$products",
            initialValue: 0,
            in: {
              $add: [
                "$$value",
                {
                  $multiply: [
                    {
                      $subtract: [
                        "$$this.variant.regularPrice",
                        "$$this.variant.salePrice"
                      ]
                    },
                    "$$this.quantity"
                  ]
                }
              ]
            }
          }
        }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: groupByFormat, date: "$orderDate" }
        },
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: "$finalAmount" },
        totalAmount: { $sum: "$totalAmount" },
        productDiscount: { $sum: "$productDiscount" },
        couponDiscount: { $sum: { $ifNull: ["$couponDiscount", 0] } },
        totalDiscount: { $sum: "$discount" },
        netRevenue: { $sum: "$finalAmount" }
      }
    },
    { $sort: { [sortField]: -1 } }
  ]

  const countPipeline = [...pipeline]
  const allResults = await Order.aggregate(countPipeline)
  const totalCount = allResults.length
  const totalPages = Math.ceil(totalCount / limit)

  pipeline.push({ $skip: (page - 1) * limit })
  pipeline.push({ $limit: limit })

  const analysisData = await Order.aggregate(pipeline)

  return {
    data: analysisData,
    totalPages,
    currentPage: page,
    totalCount
  }
}

const getDailyRevenue = async (startDate, endDate) => {
  const pipeline = [
    {
      $match: {
        orderDate: { $gte: startDate, $lte: endDate },
        paymentStatus: { $in: ["completed", "partial"] },
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
    {
      $sort: { _id: 1 },
    },
  ]

  const dailyData = await Order.aggregate(pipeline)

  if (dailyData.length === 0) {
    return {
      labels: [],
      revenue: [],
      orders: [],
    }
  }

  return {
    labels: dailyData.map((item) => item._id),
    revenue: dailyData.map((item) => item.revenue),
    orders: dailyData.map((item) => item.orders),
  }
}

const getTopSellingProducts = async (startDate, endDate) => {
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
        totalQuantity: 1,
        totalRevenue: 1,
      },
    },
    { $sort: { totalQuantity: -1 } },
    { $limit: 5 },
  ]

  return await Order.aggregate(pipeline)
}

const downloadPdfReport = async (req, res) => {
  try {
    const period = req.query.period || "month"
    const paymentMethod = req.query.paymentMethod || "all"
    const orderStatus = req.query.orderStatus || "all"

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

    const filter = {
      orderDate: {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      },
    }

    if (paymentMethod !== "all") {
      filter.paymentMethod = paymentMethod
    }

    if (orderStatus !== "all") {
      filter.orderStatus = orderStatus
    }

    const orders = await Order.find(filter)
      .populate("user", "fullName email")
      .populate("products.product", "name")
      .populate("coupon")
      .sort({ orderDate: -1 })

    const totalOrders = orders.length
    const totalRevenue = orders.reduce((sum, order) => sum + order.finalAmount, 0)
    const totalDiscount = orders.reduce((sum, order) => sum + order.discount, 0)
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    const doc = new PDFDocument({ margin: 50 })

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename=sales-report-${period}.pdf`)

    doc.pipe(res)

    doc.fontSize(20).text("StepOut - Sales Report", { align: "center" })
    doc.moveDown()

    doc.fontSize(12).text(`Report Period: ${formatDate(dateRange.startDate)} to ${formatDate(dateRange.endDate)}`, {
      align: "center",
    })
    doc.moveDown(2)

    doc.fontSize(16).text("Summary", { underline: true })
    doc.moveDown()
    doc.fontSize(12).text(`Total Orders: ${totalOrders}`)
    doc.fontSize(12).text(`Total Revenue: ${formatCurrency(totalRevenue)}`)
    doc.fontSize(12).text(`Total Discount: ${formatCurrency(totalDiscount)}`)
    doc.fontSize(12).text(`Average Order Value: ${formatCurrency(avgOrderValue)}`)
    doc.moveDown(2)

    doc.fontSize(16).text("Order Details", { underline: true })
    doc.moveDown()

    const tableTop = doc.y
    const tableHeaders = ["Order ID", "Date", "Customer", "Amount", "Status"]
    const tableColumnWidths = [80, 80, 150, 80, 80]

    let currentX = 50
    tableHeaders.forEach((header, i) => {
      doc.fontSize(10).text(header, currentX, tableTop, { width: tableColumnWidths[i], align: "left" })
      currentX += tableColumnWidths[i]
    })

    doc
      .moveTo(50, tableTop + 20)
      .lineTo(550, tableTop + 20)
      .stroke()

    let currentY = tableTop + 30
    orders.slice(0, 20).forEach((order) => {
      if (currentY > 700) {
        doc.addPage()
        currentY = 50
      }

      currentX = 50
      doc.fontSize(9).text(order.orderID, currentX, currentY, { width: tableColumnWidths[0], align: "left" })
      currentX += tableColumnWidths[0]

      doc
        .fontSize(9)
        .text(formatDate(order.orderDate), currentX, currentY, { width: tableColumnWidths[1], align: "left" })
      currentX += tableColumnWidths[1]

      doc.fontSize(9).text(order.user ? order.user.fullName : "Unknown", currentX, currentY, {
        width: tableColumnWidths[2],
        align: "left",
      })
      currentX += tableColumnWidths[2]

      doc
        .fontSize(9)
        .text(formatCurrency(order.finalAmount), currentX, currentY, { width: tableColumnWidths[3], align: "left" })
      currentX += tableColumnWidths[3]

      doc.fontSize(9).text(order.orderStatus, currentX, currentY, { width: tableColumnWidths[4], align: "left" })

      currentY += 20
    })

    doc.end()
  } catch (error) {
    console.error("Error generating PDF report:", error)
    req.flash("error_msg", "Failed to generate PDF report")
    res.status(statusCode.INTERNAL_SERVER_ERROR).redirect("/admin/sales-report")
  }
}

const downloadExcelReport = async (req, res) => {
  try {
    const period = req.query.period || "month"
    const paymentMethod = req.query.paymentMethod || "all"
    const orderStatus = req.query.orderStatus || "all"

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

    const filter = {
      orderDate: {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      },
    }

    if (paymentMethod !== "all") {
      filter.paymentMethod = paymentMethod
    }

    if (orderStatus !== "all") {
      filter.orderStatus = orderStatus
    }

    const orders = await Order.find(filter)
      .populate("user", "fullName email")
      .populate("products.product", "name")
      .populate("coupon")
      .sort({ orderDate: -1 })

    const totalOrders = orders.length
    const totalRevenue = orders.reduce((sum, order) => sum + order.finalAmount, 0)
    const totalDiscount = orders.reduce((sum, order) => sum + order.discount, 0)

    const workbook = new ExcelJS.Workbook()
    workbook.creator = "StepOut Admin"
    workbook.created = new Date()

    const summarySheet = workbook.addWorksheet("Summary")

    summarySheet.mergeCells("A1:E1")
    summarySheet.getCell("A1").value = "StepOut - Sales Report"
    summarySheet.getCell("A1").font = { size: 16, bold: true }
    summarySheet.getCell("A1").alignment = { horizontal: "center" }

    summarySheet.mergeCells("A2:E2")
    summarySheet.getCell("A2").value =
      `Report Period: ${formatDate(dateRange.startDate)} to ${formatDate(dateRange.endDate)}`
    summarySheet.getCell("A2").alignment = { horizontal: "center" }

    summarySheet.addRow([])
    summarySheet.addRow(["Total Orders", totalOrders])
    summarySheet.addRow(["Total Revenue", totalRevenue])
    summarySheet.addRow(["Total Discount", totalDiscount])
    summarySheet.addRow(["Average Order Value", totalOrders > 0 ? totalRevenue / totalOrders : 0])

    summarySheet.getCell("B5").numFmt = "₹#,##0.00"
    summarySheet.getCell("B6").numFmt = "₹#,##0.00"
    summarySheet.getCell("B7").numFmt = "₹#,##0.00"

    const ordersSheet = workbook.addWorksheet("Orders")

    ordersSheet.columns = [
      { header: "Order ID", key: "orderId", width: 15 },
      { header: "Date", key: "date", width: 15 },
      { header: "Customer", key: "customer", width: 20 },
      { header: "Email", key: "email", width: 25 },
      { header: "Payment Method", key: "paymentMethod", width: 15 },
      { header: "Status", key: "status", width: 15 },
      { header: "Items", key: "items", width: 10 },
      { header: "Subtotal", key: "subtotal", width: 15 },
      { header: "Discount", key: "discount", width: 15 },
      { header: "Final Amount", key: "finalAmount", width: 15 },
    ]

    ordersSheet.getRow(1).font = { bold: true }
    ordersSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF333333" },
    }
    ordersSheet.getRow(1).font = { color: { argb: "FFFFFFFF" }, bold: true }

    orders.forEach((order) => {
      const itemCount = order.products.reduce((sum, product) => sum + product.quantity, 0)

      ordersSheet.addRow({
        orderId: order.orderID,
        date: order.orderDate,
        customer: order.user ? order.user.fullName : "Unknown",
        email: order.user ? order.user.email : "Unknown",
        paymentMethod: order.paymentMethod,
        status: order.orderStatus,
        items: itemCount,
        subtotal: order.totalAmount,
        discount: order.discount,
        finalAmount: order.finalAmount,
      })
    })

    ordersSheet.getColumn("date").numFmt = "dd/mm/yyyy"
    ordersSheet.getColumn("subtotal").numFmt = "₹#,##0.00"
    ordersSheet.getColumn("discount").numFmt = "₹#,##0.00"
    ordersSheet.getColumn("finalAmount").numFmt = "₹#,##0.00"

    const productsSheet = workbook.addWorksheet("Top Products")

    const topProducts = await getTopSellingProducts(dateRange.startDate, dateRange.endDate)

    productsSheet.columns = [
      { header: "Product", key: "product", width: 30 },
      { header: "Quantity Sold", key: "quantity", width: 15 },
      { header: "Revenue", key: "revenue", width: 15 },
    ]

    productsSheet.getRow(1).font = { bold: true }
    productsSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF333333" },
    }
    productsSheet.getRow(1).font = { color: { argb: "FFFFFFFF" }, bold: true }

    topProducts.forEach((product) => {
      productsSheet.addRow({
        product: product.name,
        quantity: product.totalQuantity,
        revenue: product.totalRevenue,
      })
    })

    productsSheet.getColumn("revenue").numFmt = "₹#,##0.00"

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    res.setHeader("Content-Disposition", `attachment; filename=sales-report-${period}.xlsx`)

    await workbook.xlsx.write(res)
    res.end()
  } catch (error) {
    console.error("Error generating Excel report:", error)
    req.flash("error_msg", "Failed to generate Excel report")
    res.status(statusCode.INTERNAL_SERVER_ERROR).redirect("/admin/sales-report")
  }
}

module.exports = {
  loadSalesReport,
  downloadPdfReport,
  downloadExcelReport,
}
