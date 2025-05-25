const PDFDocument = require("pdfkit")

const generateInvoicePDF = (order, res) => {
  const doc = new PDFDocument({ margin: 50 })

  // Set headers
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `attachment; filename="invoice-${order.orderID}.pdf"`)

  // Pipe to response
  doc.pipe(res)

  // Header
  doc.fontSize(20).text("StepOut", 50, 50)
  doc.fontSize(10).text("Premium Footwear Store", 50, 75)
  doc.text("Email: support@stepout.com", 50, 90)
  doc.text("Phone: +91 9876543210", 50, 105)

  // Invoice Info
  doc.fontSize(18).text("INVOICE", 400, 50)
  doc.fontSize(12).text(`Invoice #: ${order.orderID}`, 400, 75)
  doc.text(`Date: ${new Date(order.orderDate).toLocaleDateString("en-IN")}`, 400, 90)
  doc.text(`Status: ${order.orderStatus.toUpperCase()}`, 400, 105)

  doc.moveTo(50, 130).lineTo(550, 130).stroke()

  // Billing Info
  doc.fontSize(14).text("Bill To:", 50, 150)
  doc.fontSize(12).text(order.address.name, 50, 170)
  doc.text(order.address.address, 50, 185)
  doc.text(`${order.address.city}, ${order.address.state}`, 50, 200)
  doc.text(`PIN: ${order.address.pincode}`, 50, 215)
  doc.text(`Phone: ${order.address.mobile}`, 50, 230)

  // Payment Info
  doc.fontSize(14).text("Payment Information:", 300, 150)
  doc.fontSize(12).text(`Method: ${order.paymentMethod === "COD" ? "Cash on Delivery" : "Online Payment"}`, 300, 170)
  doc.text(`Payment Status: ${order.paymentMethod === "COD" ? "Pending" : "Completed"}`, 300, 185)

  // Table Headers
  let y = 270
  doc.fontSize(12).text("Item", 50, y)
  doc.text("Size", 250, y)
  doc.text("Qty", 300, y)
  doc.text("Price", 350, y)
  doc.text("Total", 450, y)
  y += 15
  doc.moveTo(50, y).lineTo(550, y).stroke()
  y += 20

  order.products.forEach(item => {
    doc.text(item.product.name, 50, y, { width: 180 })
    doc.text(item.variant.size, 250, y)
    doc.text(item.quantity.toString(), 300, y)
    doc.text(`₹${item.variant.salePrice}`, 350, y)
    doc.text(`₹${item.variant.salePrice * item.quantity}`, 450, y)
    y += 25
  })

  y += 20
  doc.moveTo(300, y).lineTo(550, y).stroke()
  y += 15

  doc.text("Subtotal:", 350, y)
  doc.text(`₹${order.totalAmount}`, 450, y)
  y += 20

  if (order.discount > 0) {
    doc.text("Discount:", 350, y)
    doc.text(`-₹${order.discount}`, 450, y)
    y += 20
  }

  doc.text("Tax (18% GST):", 350, y)
  doc.text(`₹${Math.round(order.totalAmount * 0.18)}`, 450, y)
  y += 20

  doc.text("Shipping:", 350, y)
  doc.text("FREE", 450, y)
  y += 20

  doc.moveTo(300, y).lineTo(550, y).stroke()
  y += 15

  doc.fontSize(14).text("Total Amount:", 350, y)
  doc.text(`₹${order.finalAmount}`, 450, y)

  y += 60
  doc.fontSize(10).text("Thank you for shopping with StepOut!", 50, y)
  doc.text("For any queries, contact us at support@stepout.com", 50, y + 15)

  doc.end()
}

module.exports = generateInvoicePDF
