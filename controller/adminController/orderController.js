const Order = require("../../model/orderModel");
const User = require("../../model/userModel")
const Product = require("../../model/productModel");
const Address = require("../../model/addressModel")
const PDFDocument = require("pdfkit");
const statusCode = require("../../utils/httpStatusCodes")

const loadOrders = async (req, res) => {
  try {
    const page = Number.parseInt(req.query.page) || 1
    const limit = 10
    const skip = (page - 1) * limit

    const query = {}
    const searchQuery = req.query.search || ""
    const statusFilter = req.query.status || ""
    const paymentFilter = req.query.payment || ""
    const dateFilter = req.query.date || ""
    const sortBy = req.query.sort || "newest"

    if (searchQuery) {
      query.$or = [
        { orderID: { $regex: searchQuery, $options: "i" } },
        { "user.name": { $regex: searchQuery, $options: "i" } },
        { "user.email": { $regex: searchQuery, $options: "i" } },
      ]
    }

    if (statusFilter) {
      query.orderStatus = statusFilter
    }

    if (paymentFilter) {
      query.paymentMethod = paymentFilter
    }

    if (dateFilter) {
      const now = new Date()
      let startDate, endDate

      switch (dateFilter) {
        case "today":
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
          break
        case "week":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          endDate = now
          break
        case "month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
          break
        case "custom":
          if (req.query.fromDate) startDate = new Date(req.query.fromDate)
          if (req.query.toDate) endDate = new Date(req.query.toDate)
          break
      }

      if (startDate || endDate) {
        query.orderDate = {}
        if (startDate) query.orderDate.$gte = startDate
        if (endDate) query.orderDate.$lt = endDate
      }
    }

    let sortOptions = {}
    switch (sortBy) {
      case "oldest":
        sortOptions = { orderDate: 1 }
        break
      case "amount_high":
        sortOptions = { finalAmount: -1 }
        break
      case "amount_low":
        sortOptions = { finalAmount: 1 }
        break
      default: 
        sortOptions = { orderDate: -1 }
    }

    if (req.query.export === "true") {
      return await exportOrders(req, res, query, sortOptions)
    }

    const orders = await Order.find(query)
      .populate("user", "name email")
      .populate("address")
      .populate({
        path: "products.product",
        select: "name images",
      })
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean()

    const totalOrders = await Order.countDocuments(query)
    const totalPages = Math.ceil(totalOrders / limit)

   
    const buildQueryString = () => {
      const params = new URLSearchParams()
      if (searchQuery) params.append("search", searchQuery)
      if (statusFilter) params.append("status", statusFilter)
      if (paymentFilter) params.append("payment", paymentFilter)
      if (dateFilter) params.append("date", dateFilter)
      if (sortBy) params.append("sort", sortBy)
      if (req.query.fromDate) params.append("fromDate", req.query.fromDate)
      if (req.query.toDate) params.append("toDate", req.query.toDate)
      return params.toString() ? "&" + params.toString() : ""
    }

    res.render("admin/orders", {
      orders,
      currentPage: page,
      totalPages,
      totalOrders,
      searchQuery,
      statusFilter,
      paymentFilter,
      dateFilter,
      sortBy,
      fromDate: req.query.fromDate || "",
      toDate: req.query.toDate || "",
      limit,
      buildQueryString,
    })
  } catch (error) {
    console.log("Error loading admin orders:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).render("admin/error", {
      error: "Failed to load orders",
    })
  }
}


const getOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId

    const order = await Order.findById(orderId)
      .populate("user", "name email")
      .populate("address")
      .populate({
        path: "products.product",
        select: "name images",
      })
      .lean()

    if (!order) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      })
    }

    res.status(statusCode.OK).json({
      success: true,
      order,
    })
  } catch (error) {
    console.log("Error getting order details:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get order details",
    })
  }
}

const updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.orderId
    const { status } = req.body

    const validStatuses = ["pending", "confirmed", "shipped", "delivered", "cancelled", "returned"]
    if (!validStatuses.includes(status)) {
      return res.status(statusCode.BAD_REQUEST).json({
        success: false,
        message: "Invalid status",
      })
    }

    const order = await Order.findById(orderId)
    if (!order) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      })
    }

    order.orderStatus = status

    if (status === "cancelled" || status === "returned") {
      order.products.forEach((item) => {
        if (item.status === "pending" || item.status === "confirmed") {
          item.status = status
        }
      })

      await restoreInventory(order)
    } else {
      order.products.forEach((item) => {
        if (item.status === "pending") {
          item.status = status
        }
      })
    }

    await order.save()

    res.status(statusCode.OK).json({
      success: true,
      message: `Order status updated to ${status}`,
    })
  } catch (error) {
    console.log("Error updating order status:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to update order status",
    })
  }
}

const restoreInventory = async (order) => {
  try {
    for (const item of order.products) {
      if (item.status === "cancelled" || item.status === "returned") {
        const product = await Product.findById(item.product)
        if (product) {
          const variantIndex = product.variants.findIndex((v) => v.size === item.variant.size)
          if (variantIndex !== -1) {
            product.variants[variantIndex].varientquantity += item.quantity
            await product.save()
          }
        }
      }
    }
  } catch (error) {
    console.log("Error restoring inventory:", error)
  }
}

const sendNotification = async (req, res) => {
  try {
    const orderId = req.params.orderId

    const order = await Order.findById(orderId).populate("user", "email name")
    if (!order) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      })
    }

    // email

    console.log(`Sending notification to ${order.user.email} for order ${order.orderID}`)

    res.status(statusCode.OK).json({
      success: true,
      message: "Notification sent successfully",
    })
  } catch (error) {
    console.log("Error sending notification:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to send notification",
    })
  }
}

const cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId

    const order = await Order.findById(orderId)
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
    order.cancelReason = "Cancelled by admin"
    order.products.forEach((item) => {
      if (item.status === "pending" || item.status === "confirmed") {
        item.status = "cancelled"
        item.cancelReason = "Cancelled by admin"
      }
    })

    await order.save()
    await restoreInventory(order)

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

const deleteOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId

    const order = await Order.findById(orderId)
    if (!order) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      })
    }

    await Order.findByIdAndDelete(orderId)

    res.status(statusCode.OK).json({
      success: true,
      message: "Order deleted successfully",
    })
  } catch (error) {
    console.log("Error deleting order:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to delete order",
    })
  }
}

const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.orderId

    const order = await Order.findById(orderId)
      .populate("user", "name email")
      .populate("address")
      .populate({
        path: "products.product",
        select: "name",
      })
      .lean()

    if (!order) {
      return res.status(statusCode.NOT_FOUND).json({
        success: false,
        message: "Order not found",
      })
    }

    const doc = new PDFDocument({ margin: 50 })

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${order.orderID}.pdf"`)

    doc.pipe(res)

    doc.fontSize(20).text("StepOut - Admin", 50, 50)
    doc.fontSize(10).text("Premium Footwear Store", 50, 75)
    doc.text("Email: admin@stepout.com", 50, 90)
    doc.text("Phone: +91 9876543210", 50, 105)

    doc.fontSize(18).text("INVOICE", 400, 50)
    doc.fontSize(12).text(`Invoice #: ${order.orderID}`, 400, 75)
    doc.text(`Date: ${new Date(order.orderDate).toLocaleDateString("en-IN")}`, 400, 90)
    doc.text(`Status: ${order.orderStatus.toUpperCase()}`, 400, 105)

    doc.moveTo(50, 130).lineTo(550, 130).stroke()

    doc.fontSize(14).text("Bill To:", 50, 150)
    doc.fontSize(12).text(order.address.name, 50, 170)
    doc.text(order.address.address, 50, 185)
    doc.text(`${order.address.city}, ${order.address.state}`, 50, 200)
    doc.text(`PIN: ${order.address.pincode}`, 50, 215)
    doc.text(`Phone: ${order.address.mobile}`, 50, 230)

    doc.fontSize(14).text("Payment Information:", 300, 150)
    doc.fontSize(12).text(`Method: ${order.paymentMethod === "COD" ? "Cash on Delivery" : "Online Payment"}`, 300, 170)
    doc.text(`Payment Status: ${order.paymentMethod === "COD" ? "Pending" : "Completed"}`, 300, 185)

    let yPosition = 270
    doc.fontSize(12).text("Item", 50, yPosition)
    doc.text("Size", 250, yPosition)
    doc.text("Qty", 300, yPosition)
    doc.text("Price", 350, yPosition)
    doc.text("Total", 450, yPosition)

    yPosition += 15
    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke()

    yPosition += 20
    order.products.forEach((item) => {
      doc.text(item.product.name, 50, yPosition, { width: 180 })
      doc.text(item.variant.size, 250, yPosition)
      doc.text(item.quantity.toString(), 300, yPosition)
      doc.text(`₹${item.variant.salePrice}`, 350, yPosition)
      doc.text(`₹${item.variant.salePrice * item.quantity}`, 450, yPosition)
      yPosition += 25
    })

    yPosition += 20
    doc.moveTo(300, yPosition).lineTo(550, yPosition).stroke()
    yPosition += 15

    doc.text("Subtotal:", 350, yPosition)
    doc.text(`₹${order.totalAmount}`, 450, yPosition)
    yPosition += 20

    if (order.discount > 0) {
      doc.text("Discount:", 350, yPosition)
      doc.text(`-₹${order.discount}`, 450, yPosition)
      yPosition += 20
    }

    doc.text("Tax (18% GST):", 350, yPosition)
    doc.text(`₹${Math.round(order.totalAmount * 0.18)}`, 450, yPosition)
    yPosition += 20

    doc.text("Shipping:", 350, yPosition)
    doc.text("FREE", 450, yPosition)
    yPosition += 20

    doc.moveTo(300, yPosition).lineTo(550, yPosition).stroke()
    yPosition += 15

    doc.fontSize(14).text("Total Amount:", 350, yPosition)
    doc.text(`₹${order.finalAmount}`, 450, yPosition)

    yPosition += 60
    doc.fontSize(10).text("Thank you for choosing StepOut!", 50, yPosition)
    doc.text("For any queries, contact us at admin@stepout.com", 50, yPosition + 15)

    doc.end()
  } catch (error) {
    console.log("Error generating invoice:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to generate invoice",
    })
  }
}
//excel thing
const exportOrders = async (req, res, query, sortOptions) => {
  try {
    const orders = await Order.find(query)
      .populate("user", "name email")
      .populate("address")
      .populate({
        path: "products.product",
        select: "name",
      })
      .sort(sortOptions)
      .lean()

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Orders")

    worksheet.columns = [
      { header: "Order ID", key: "orderID", width: 15 },
      { header: "Customer Name", key: "customerName", width: 20 },
      { header: "Customer Email", key: "customerEmail", width: 25 },
      { header: "Phone", key: "phone", width: 15 },
      { header: "Items", key: "items", width: 30 },
      { header: "Total Amount", key: "totalAmount", width: 15 },
      { header: "Final Amount", key: "finalAmount", width: 15 },
      { header: "Payment Method", key: "paymentMethod", width: 15 },
      { header: "Status", key: "status", width: 12 },
      { header: "Order Date", key: "orderDate", width: 20 },
      { header: "Address", key: "address", width: 40 },
    ]

    orders.forEach((order) => {
      const itemsText = order.products
        .map((item) => `${item.product.name} (${item.variant.size}) x${item.quantity}`)
        .join(", ")

      const addressText = `${order.address.address}, ${order.address.city}, ${order.address.state} - ${order.address.pincode}`

      worksheet.addRow({
        orderID: order.orderID,
        customerName: order.user.name,
        customerEmail: order.user.email,
        phone: order.address.mobile,
        items: itemsText,
        totalAmount: order.totalAmount,
        finalAmount: order.finalAmount,
        paymentMethod: order.paymentMethod,
        status: order.orderStatus,
        orderDate: new Date(order.orderDate).toLocaleString(),
        address: addressText,
      })
    })

    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="orders-export-${new Date().toISOString().split("T")[0]}.xlsx"`,
    )

    await workbook.xlsx.write(res)
    res.end()
  } catch (error) {
    console.log("Error exporting orders:", error)
    res.status(statusCode.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to export orders",
    })
  }
}

module.exports = {
  loadOrders,
  getOrderDetails,
  updateOrderStatus,
  sendNotification,
  cancelOrder,
  deleteOrder,
  downloadInvoice,
}
