const Order = require("../../model/orderModel")
const User = require("../../model/userModel")
const Product = require("../../model/productModel")
const PDFDocument = require("pdfkit")
const ExcelJS = require("exceljs")
const fs = require("fs")
const path = require("path")
const statusCode = require("../../utils/httpStatusCodes")
const mongoose = require("mongoose")

// Helper function to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount)
}

// Helper function to format date
const formatDate = (date) => {
  return new Date(date).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

// Helper function to get date range
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
      return null // Will be handled separately
    default:
      startDate.setDate(startDate.getDate() - 30) // Default to last 30 days
  }

  return { startDate, endDate }
}

// Main controller to load sales report page
const loadSalesReport = async (req, res) => {
  try {
    const period = req.query.period || "month"
    const paymentMethod = req.query.paymentMethod || "all"
    const orderStatus = req.query.orderStatus || "all"

    // Handle custom date range
    let dateRange
    if (period === "custom") {
      const startDate = req.query.startDate
        ? new Date(req.query.startDate)
        : new Date(new Date().setMonth(new Date().getMonth() - 1))
      const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date()

      // Set time to start and end of day
      startDate.setHours(0, 0, 0, 0)
      endDate.setHours(23, 59, 59, 999)

      dateRange = { startDate, endDate }
    } else {
      dateRange = getDateRange(period)
    }

    // Build filter for MongoDB query
    const filter = {
      orderDate: {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      },
    }

    // Add payment method filter if specified
    if (paymentMethod !== "all") {
      filter.paymentMethod = paymentMethod
    }

    // Add order status filter if specified
    if (orderStatus !== "all") {
      filter.orderStatus = orderStatus
    }

    // Get orders based on filters
    const orders = await Order.find(filter)
      .populate("user", "fullName email")
      .populate("products.product", "name")
      .populate("coupon")
      .sort({ orderDate: -1 })

    // Calculate summary statistics
    const totalOrders = orders.length
    const totalRevenue = orders.reduce((sum, order) => sum + order.finalAmount, 0)
    const totalDiscount = orders.reduce((sum, order) => sum + order.discount, 0)

    // Calculate average order value
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    // Count orders by payment method
    const paymentMethodCounts = {
      COD: orders.filter((order) => order.paymentMethod === "COD").length,
      online: orders.filter((order) => order.paymentMethod === "online").length,
      wallet: orders.filter((order) => order.paymentMethod === "wallet").length,
      "partial-wallet": orders.filter((order) => order.paymentMethod === "partial-wallet").length,
    }

    // Count orders by status
    const orderStatusCounts = {
      pending: orders.filter((order) => order.orderStatus === "pending").length,
      confirmed: orders.filter((order) => order.orderStatus === "confirmed").length,
      shipped: orders.filter((order) => order.orderStatus === "shipped").length,
      delivered: orders.filter((order) => order.orderStatus === "delivered").length,
      cancelled: orders.filter((order) => order.orderStatus === "cancelled").length,
      returned: orders.filter((order) => order.orderStatus === "returned").length,
    }

    // Count coupon usage
    const couponUsage = orders.filter((order) => order.coupon).length

    // Get daily revenue data for chart
    const dailyRevenue = await getDailyRevenue(dateRange.startDate, dateRange.endDate)

    // Ensure we have data for charts
    if (dailyRevenue.labels.length === 0) {
      // Add a default data point to prevent chart rendering issues
      dailyRevenue.labels = ["No data"]
      dailyRevenue.revenue = [0]
      dailyRevenue.orders = [0]
    }

    // Get top selling products
    const topProducts = await getTopSellingProducts(dateRange.startDate, dateRange.endDate)

    // Render the sales report page
    res.render("admin/salesReport", {
      admin: req.session.admin,
      activePage: "salesReport",
      orders,
      period,
      paymentMethod,
      orderStatus,
      startDate: dateRange.startDate.toISOString().split("T")[0],
      endDate: dateRange.endDate.toISOString().split("T")[0],
      query: req.query, // Add this line
      summary: {
        totalOrders,
        totalRevenue,
        totalDiscount,
        avgOrderValue,
        couponUsage,
      },
      paymentMethodCounts,
      orderStatusCounts,
      dailyRevenue,
      topProducts,
      formatCurrency,
      formatDate,
    })
  } catch (error) {
    console.error("Error loading sales report:", error)
    req.flash("error_msg", "Failed to load sales report")
    res.status(statusCode.INTERNAL_SERVER_ERROR).redirect("/admin/dashboard")
  }
}

// Helper function to get daily revenue data for charts
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

  // If no data, provide default empty arrays
  if (dailyData.length === 0) {
    return {
      labels: [],
      revenue: [],
      orders: [],
    }
  }

  // Format for chart.js
  return {
    labels: dailyData.map((item) => item._id),
    revenue: dailyData.map((item) => item.revenue),
    orders: dailyData.map((item) => item.orders),
  }
}

// Helper function to get top selling products
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

// Generate and download PDF report
const downloadPdfReport = async (req, res) => {
  try {
    const period = req.query.period || "month"
    const paymentMethod = req.query.paymentMethod || "all"
    const orderStatus = req.query.orderStatus || "all"

    // Get date range
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

    // Build filter
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

    // Get orders
    const orders = await Order.find(filter)
      .populate("user", "fullName email")
      .populate("products.product", "name")
      .populate("coupon")
      .sort({ orderDate: -1 })

    // Calculate summary
    const totalOrders = orders.length
    const totalRevenue = orders.reduce((sum, order) => sum + order.finalAmount, 0)
    const totalDiscount = orders.reduce((sum, order) => sum + order.discount, 0)
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    // Create PDF document
    const doc = new PDFDocument({ margin: 50 })

    // Set response headers
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename=sales-report-${period}.pdf`)

    // Pipe PDF to response
    doc.pipe(res)

    // Add content to PDF
    doc.fontSize(20).text("StepOut - Sales Report", { align: "center" })
    doc.moveDown()

    // Add date range
    doc.fontSize(12).text(`Report Period: ${formatDate(dateRange.startDate)} to ${formatDate(dateRange.endDate)}`, {
      align: "center",
    })
    doc.moveDown(2)

    // Add summary section
    doc.fontSize(16).text("Summary", { underline: true })
    doc.moveDown()
    doc.fontSize(12).text(`Total Orders: ${totalOrders}`)
    doc.fontSize(12).text(`Total Revenue: ${formatCurrency(totalRevenue)}`)
    doc.fontSize(12).text(`Total Discount: ${formatCurrency(totalDiscount)}`)
    doc.fontSize(12).text(`Average Order Value: ${formatCurrency(avgOrderValue)}`)
    doc.moveDown(2)

    // Add orders table
    doc.fontSize(16).text("Order Details", { underline: true })
    doc.moveDown()

    // Table headers
    const tableTop = doc.y
    const tableHeaders = ["Order ID", "Date", "Customer", "Amount", "Status"]
    const tableColumnWidths = [80, 80, 150, 80, 80]

    // Draw headers
    let currentX = 50
    tableHeaders.forEach((header, i) => {
      doc.fontSize(10).text(header, currentX, tableTop, { width: tableColumnWidths[i], align: "left" })
      currentX += tableColumnWidths[i]
    })

    // Draw divider
    doc
      .moveTo(50, tableTop + 20)
      .lineTo(550, tableTop + 20)
      .stroke()

    // Draw rows
    let currentY = tableTop + 30
    orders.slice(0, 20).forEach((order) => {
      // Limit to 20 orders for PDF
      if (currentY > 700) {
        // Check if we need a new page
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

    // Finalize PDF
    doc.end()
  } catch (error) {
    console.error("Error generating PDF report:", error)
    req.flash("error_msg", "Failed to generate PDF report")
    res.status(statusCode.INTERNAL_SERVER_ERROR).redirect("/admin/sales-report")
  }
}

// Generate and download Excel report
const downloadExcelReport = async (req, res) => {
  try {
    const period = req.query.period || "month"
    const paymentMethod = req.query.paymentMethod || "all"
    const orderStatus = req.query.orderStatus || "all"

    // Get date range
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

    // Build filter
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

    // Get orders
    const orders = await Order.find(filter)
      .populate("user", "fullName email")
      .populate("products.product", "name")
      .populate("coupon")
      .sort({ orderDate: -1 })

    // Calculate summary
    const totalOrders = orders.length
    const totalRevenue = orders.reduce((sum, order) => sum + order.finalAmount, 0)
    const totalDiscount = orders.reduce((sum, order) => sum + order.discount, 0)

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook()
    workbook.creator = "StepOut Admin"
    workbook.created = new Date()

    // Add Summary worksheet
    const summarySheet = workbook.addWorksheet("Summary")

    // Add title and date range
    summarySheet.mergeCells("A1:E1")
    summarySheet.getCell("A1").value = "StepOut - Sales Report"
    summarySheet.getCell("A1").font = { size: 16, bold: true }
    summarySheet.getCell("A1").alignment = { horizontal: "center" }

    summarySheet.mergeCells("A2:E2")
    summarySheet.getCell("A2").value =
      `Report Period: ${formatDate(dateRange.startDate)} to ${formatDate(dateRange.endDate)}`
    summarySheet.getCell("A2").alignment = { horizontal: "center" }

    // Add summary data
    summarySheet.addRow([])
    summarySheet.addRow(["Total Orders", totalOrders])
    summarySheet.addRow(["Total Revenue", totalRevenue])
    summarySheet.addRow(["Total Discount", totalDiscount])
    summarySheet.addRow(["Average Order Value", totalOrders > 0 ? totalRevenue / totalOrders : 0])

    // Format currency cells
    summarySheet.getCell("B5").numFmt = "₹#,##0.00"
    summarySheet.getCell("B6").numFmt = "₹#,##0.00"
    summarySheet.getCell("B7").numFmt = "₹#,##0.00"

    // Add Orders worksheet
    const ordersSheet = workbook.addWorksheet("Orders")

    // Add headers
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

    // Style header row
    ordersSheet.getRow(1).font = { bold: true }
    ordersSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF333333" },
    }
    ordersSheet.getRow(1).font = { color: { argb: "FFFFFFFF" }, bold: true }

    // Add order data
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

    // Format date and currency columns
    ordersSheet.getColumn("date").numFmt = "dd/mm/yyyy"
    ordersSheet.getColumn("subtotal").numFmt = "₹#,##0.00"
    ordersSheet.getColumn("discount").numFmt = "₹#,##0.00"
    ordersSheet.getColumn("finalAmount").numFmt = "₹#,##0.00"

    // Add Products worksheet
    const productsSheet = workbook.addWorksheet("Top Products")

    // Get top products data
    const topProducts = await getTopSellingProducts(dateRange.startDate, dateRange.endDate)

    // Add headers
    productsSheet.columns = [
      { header: "Product", key: "product", width: 30 },
      { header: "Quantity Sold", key: "quantity", width: 15 },
      { header: "Revenue", key: "revenue", width: 15 },
    ]

    // Style header row
    productsSheet.getRow(1).font = { bold: true }
    productsSheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF333333" },
    }
    productsSheet.getRow(1).font = { color: { argb: "FFFFFFFF" }, bold: true }

    // Add product data
    topProducts.forEach((product) => {
      productsSheet.addRow({
        product: product.name,
        quantity: product.totalQuantity,
        revenue: product.totalRevenue,
      })
    })

    // Format currency column
    productsSheet.getColumn("revenue").numFmt = "₹#,##0.00"

    // Set response headers
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    res.setHeader("Content-Disposition", `attachment; filename=sales-report-${period}.xlsx`)

    // Write to response
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
