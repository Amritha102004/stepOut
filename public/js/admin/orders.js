document.addEventListener("DOMContentLoaded", () => {
  // Initialize order management functionality
  initializeFilters()
  initializeModals()
  initializeActions()
})

// Initialize filter functionality
function initializeFilters() {
  const dateFilter = document.getElementById("dateFilter")
  const customDateRange = document.getElementById("customDateRange")

  if (dateFilter) {
    dateFilter.addEventListener("change", function () {
      if (this.value === "custom") {
        customDateRange.style.display = "block"
      } else {
        customDateRange.style.display = "none"
      }
    })
  }
}

// Apply filters
function applyFilters() {
  const searchQuery = document.getElementById("searchInput").value
  const statusFilter = document.getElementById("statusFilter").value
  const paymentFilter = document.getElementById("paymentFilter").value
  const dateFilter = document.getElementById("dateFilter").value
  const sortFilter = document.getElementById("sortFilter").value
  const fromDate = document.getElementById("fromDate").value
  const toDate = document.getElementById("toDate").value

  const params = new URLSearchParams()
  if (searchQuery) params.append("search", searchQuery)
  if (statusFilter) params.append("status", statusFilter)
  if (paymentFilter) params.append("payment", paymentFilter)
  if (dateFilter) params.append("date", dateFilter)
  if (sortFilter) params.append("sort", sortFilter)
  if (fromDate) params.append("fromDate", fromDate)
  if (toDate) params.append("toDate", toDate)

  window.location.href = `/admin/orders?${params.toString()}`
}

// Export orders
function exportOrders() {
  const currentUrl = new URL(window.location.href)
  currentUrl.searchParams.set("export", "true")
  window.open(currentUrl.toString(), "_blank")
}

// Initialize modals
function initializeModals() {
  // Return approval modal
  const returnApprovalModal = document.getElementById("returnApprovalModal")
  const confirmApprovalBtn = document.getElementById("confirmApprovalBtn")

  if (confirmApprovalBtn) {
    confirmApprovalBtn.addEventListener("click", () => {
      const orderId = document.getElementById("returnOrderId").value
      const itemId = document.getElementById("returnItemId").value
      const reason = document.getElementById("approvalReason").value

      confirmReturnApproval(orderId, reason, itemId)
    })
  }

  // Return rejection modal
  const returnRejectionModal = document.getElementById("returnRejectionModal")
  const confirmRejectionBtn = document.getElementById("confirmRejectionBtn")

  if (confirmRejectionBtn) {
    confirmRejectionBtn.addEventListener("click", () => {
      const orderId = document.getElementById("rejectOrderId").value
      const itemId = document.getElementById("rejectItemId").value
      const reason = document.getElementById("rejectionReason").value

      if (!reason.trim()) {
        document.getElementById("rejectionReason").classList.add("is-invalid")
        return
      }

      confirmReturnRejection(orderId, reason, itemId)
    })
  }

  // Refund modal
  const refundModal = document.getElementById("refundModal")
  const confirmRefundBtn = document.getElementById("confirmRefundBtn")

  if (confirmRefundBtn) {
    confirmRefundBtn.addEventListener("click", () => {
      const orderId = document.getElementById("refundOrderId").value
      const amount = document.getElementById("refundAmount").value
      const reason = document.getElementById("refundReason").value

      if (!amount || amount <= 0) {
        document.getElementById("refundAmount").classList.add("is-invalid")
        return
      }

      confirmRefundProcessing(orderId, amount, reason)
    })
  }
}

// Initialize action handlers
function initializeActions() {
  // Add event listeners for dynamic content
}

// View order details
async function viewOrderDetails(orderId) {
  try {
    showLoading("Loading order details...")

    const response = await fetch(`/admin/orders/${orderId}/details`)
    const data = await response.json()

    hideLoading()

    if (data.success) {
      displayOrderDetails(data.order)
      const modal = window.bootstrap.Modal.getOrCreateInstance(document.getElementById("orderDetailsModal"))
      modal.show()
    } else {
      showToast(data.message || "Failed to load order details", "error")
    }
  } catch (error) {
    hideLoading()
    console.error("Error loading order details:", error)
    showToast("Failed to load order details", "error")
  }
}

// Display order details in modal
function displayOrderDetails(order) {
  const content = document.getElementById("orderDetailsContent")

  const html = `
        <div class="row">
            <div class="col-md-6">
                <div class="order-info-section">
                    <h6 class="section-title">Order Information</h6>
                    <div class="info-grid">
                        <div class="info-item">
                            <label>Order ID:</label>
                            <span>${order.orderID}</span>
                        </div>
                        <div class="info-item">
                            <label>Status:</label>
                            <span class="status-badge status-${order.orderStatus.replace("_", "-")}">${order.orderStatus.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}</span>
                        </div>
                        <div class="info-item">
                            <label>Order Date:</label>
                            <span>${new Date(order.orderDate).toLocaleString("en-IN")}</span>
                        </div>
                        <div class="info-item">
                            <label>Payment Method:</label>
                            <span>${getPaymentMethodDisplay(order.paymentMethod)}</span>
                        </div>
                        <div class="info-item">
                            <label>Payment Status:</label>
                            <span class="badge bg-${order.paymentStatus === "completed" ? "success" : order.paymentStatus === "failed" ? "danger" : "warning"}">${order.paymentStatus}</span>
                        </div>
                        ${
                          order.walletAmountUsed > 0
                            ? `
                        <div class="info-item">
                            <label>Wallet Used:</label>
                            <span class="text-info">₹${order.walletAmountUsed}</span>
                        </div>
                        `
                            : ""
                        }
                        ${
                          order.remainingAmount > 0
                            ? `
                        <div class="info-item">
                            <label>Remaining Amount:</label>
                            <span class="text-warning">₹${order.remainingAmount}</span>
                        </div>
                        `
                            : ""
                        }
                    </div>
                </div>
                
                <div class="customer-info-section mt-4">
                    <h6 class="section-title">Customer Information</h6>
                    <div class="info-grid">
                        <div class="info-item">
                            <label>Name:</label>
                            <span>${order.user.fullName}</span>
                        </div>
                        <div class="info-item">
                            <label>Email:</label>
                            <span>${order.user.email}</span>
                        </div>
                        <div class="info-item">
                            <label>Wallet Balance:</label>
                            <span class="text-success">₹${order.userWalletBalance || 0}</span>
                        </div>
                    </div>
                </div>
                
                <div class="address-info-section mt-4">
                    <h6 class="section-title">Delivery Address</h6>
                    <div class="address-card">
                        <strong>${order.address.name}</strong><br>
                        ${order.address.address}<br>
                        ${order.address.city}, ${order.address.state} - ${order.address.pincode}<br>
                        <i class="fas fa-phone"></i> ${order.address.mobile}
                    </div>
                </div>
            </div>
            
            <div class="col-md-6">
                <div class="order-items-section">
                    <h6 class="section-title">Order Items</h6>
                    <div class="items-list">
                        ${order.products
                          .map(
                            (item) => `
                            <div class="item-card">
                                <div class="item-info">
                                    <h6>${item.product.name}</h6>
                                    <p>Size: ${item.variant.size} | Quantity: ${item.quantity}</p>
                                    <p>Price: ₹${item.variant.salePrice} × ${item.quantity} = ₹${item.variant.salePrice * item.quantity}</p>
                                    <div class="item-status">
                                        <span class="status-badge status-${item.status.replace("_", "-")}">${item.status.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}</span>
                                    </div>
                                    ${item.cancellationReason ? `<small class="text-muted">Cancelled: ${item.cancellationReason}</small>` : ""}
                                    ${item.returnReason ? `<small class="text-muted">Return Reason: ${item.returnReason}</small>` : ""}
                                </div>
                                <div class="item-actions">
                                    ${getItemActionButtons(order._id, item)}
                                </div>
                            </div>
                        `,
                          )
                          .join("")}
                    </div>
                </div>
                
                <div class="order-summary-section mt-4">
                    <h6 class="section-title">Order Summary</h6>
                    <div class="summary-grid">
                        <div class="summary-row">
                            <span>Subtotal:</span>
                            <span>₹${order.totalAmount}</span>
                        </div>
                        ${
                          order.discount > 0
                            ? `
                        <div class="summary-row">
                            <span>Discount:</span>
                            <span class="text-success">-₹${order.discount}</span>
                        </div>
                        `
                            : ""
                        }
                        ${
                          order.walletAmountUsed > 0
                            ? `
                        <div class="summary-row">
                            <span>Wallet Used:</span>
                            <span class="text-info">-₹${order.walletAmountUsed}</span>
                        </div>
                        `
                            : ""
                        }
                        <div class="summary-row">
                            <span>Tax (18%):</span>
                            <span>₹${Math.round(order.totalAmount * 0.18)}</span>
                        </div>
                        <div class="summary-row total">
                            <span><strong>Final Amount:</strong></span>
                            <span><strong>₹${order.finalAmount}</strong></span>
                        </div>
                        ${
                          order.refundAmount > 0
                            ? `
                        <div class="summary-row">
                            <span>Refunded:</span>
                            <span class="text-success">₹${order.refundAmount}</span>
                        </div>
                        `
                            : ""
                        }
                    </div>
                </div>
            </div>
        </div>
        
        <div class="row mt-4">
            <div class="col-12">
                <div class="order-actions-section">
                    <h6 class="section-title">Quick Actions</h6>
                    <div class="action-buttons">
                        ${getOrderActionButtons(order)}
                    </div>
                </div>
            </div>
        </div>
    `

  content.innerHTML = html
}

// Get payment method display text
function getPaymentMethodDisplay(method) {
  switch (method) {
    case "COD":
      return "Cash on Delivery"
    case "wallet":
      return "Wallet Payment"
    case "partial-wallet":
      return "Partial Wallet + Online"
    case "online":
      return "Online Payment"
    default:
      return method
  }
}

// Get item action buttons
function getItemActionButtons(orderId, item) {
  let buttons = ""

  if (item.status === "return_requested") {
    buttons += `
            <button class="btn btn-sm btn-success me-1" onclick="approveItemReturn('${orderId}', '${item._id}')" title="Approve Return">
                <i class="fas fa-check"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="rejectItemReturn('${orderId}', '${item._id}')" title="Reject Return">
                <i class="fas fa-times"></i>
            </button>
        `
  }

  if (["pending", "confirmed"].includes(item.status)) {
    buttons += `
            <div class="dropdown d-inline">
                <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                    Status
                </button>
                <ul class="dropdown-menu">
                    <li><a class="dropdown-item" href="#" onclick="updateItemStatus('${orderId}', '${item.product._id}', '${item.variant.size}', 'confirmed')">Confirm</a></li>
                    <li><a class="dropdown-item" href="#" onclick="updateItemStatus('${orderId}', '${item.product._id}', '${item.variant.size}', 'shipped')">Ship</a></li>
                    <li><a class="dropdown-item" href="#" onclick="updateItemStatus('${orderId}', '${item.product._id}', '${item.variant.size}', 'delivered')">Deliver</a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item text-danger" href="#" onclick="updateItemStatus('${orderId}', '${item.product._id}', '${item.variant.size}', 'cancelled')">Cancel</a></li>
                </ul>
            </div>
        `
  }

  return buttons
}

// Get order action buttons
function getOrderActionButtons(order) {
  let buttons = ""

  if (["pending", "confirmed", "shipped"].includes(order.orderStatus)) {
    buttons += `
            <div class="dropdown d-inline me-2">
                <button class="btn btn-primary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                    Update Status
                </button>
                <ul class="dropdown-menu">
                    <li><a class="dropdown-item" href="#" onclick="updateOrderStatus('${order._id}', 'confirmed')">Confirm Order</a></li>
                    <li><a class="dropdown-item" href="#" onclick="updateOrderStatus('${order._id}', 'shipped')">Mark as Shipped</a></li>
                    <li><a class="dropdown-item" href="#" onclick="updateOrderStatus('${order._id}', 'delivered')">Mark as Delivered</a></li>
                </ul>
            </div>
        `
  }

  if (order.orderStatus === "return_requested") {
    buttons += `
            <button class="btn btn-success me-2" onclick="approveReturn('${order._id}')">
                <i class="fas fa-check me-1"></i>Approve Return
            </button>
            <button class="btn btn-danger me-2" onclick="rejectReturn('${order._id}')">
                <i class="fas fa-times me-1"></i>Reject Return
            </button>
        `
  }

  if (["pending", "confirmed"].includes(order.orderStatus)) {
    buttons += `
            <button class="btn btn-outline-danger me-2" onclick="cancelOrder('${order._id}')">
                <i class="fas fa-ban me-1"></i>Cancel Order
            </button>
        `
  }

  buttons += `
        <button class="btn btn-outline-info me-2" onclick="processRefund('${order._id}')">
            <i class="fas fa-money-bill-wave me-1"></i>Process Refund
        </button>
        <button class="btn btn-outline-secondary" onclick="sendNotification('${order._id}')">
            <i class="fas fa-bell me-1"></i>Send Notification
        </button>
    `

  return buttons
}

// Update order status
async function updateOrderStatus(orderId, status) {
  try {
    showLoading("Updating order status...")

    const response = await fetch(`/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    })

    const data = await response.json()
    hideLoading()

    if (data.success) {
      showToast(data.message, "success")
      setTimeout(() => window.location.reload(), 1500)
    } else {
      showToast(data.message || "Failed to update order status", "error")
    }
  } catch (error) {
    hideLoading()
    console.error("Error updating order status:", error)
    showToast("Failed to update order status", "error")
  }
}

// Update item status
async function updateItemStatus(orderId, productId, size, status) {
  try {
    showLoading("Updating item status...")

    const response = await fetch(`/admin/orders/${orderId}/item-status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productId, size, status }),
    })

    const data = await response.json()
    hideLoading()

    if (data.success) {
      showToast(data.message, "success")
      // Refresh order details
      viewOrderDetails(orderId)
    } else {
      showToast(data.message || "Failed to update item status", "error")
    }
  } catch (error) {
    hideLoading()
    console.error("Error updating item status:", error)
    showToast("Failed to update item status", "error")
  }
}

// Approve return
function approveReturn(orderId, itemId = null) {
  document.getElementById("returnOrderId").value = orderId
  document.getElementById("returnItemId").value = itemId || ""
  document.getElementById("approvalReason").value = ""

  const modal = window.bootstrap.Modal.getOrCreateInstance(document.getElementById("returnApprovalModal"))
  modal.show()
}

// Approve item return
function approveItemReturn(orderId, itemId) {
  approveReturn(orderId, itemId)
}

// Confirm return approval
async function confirmReturnApproval(orderId, reason, itemId = null) {
  try {
    showLoading("Processing return approval...")

    const body = { reason }
    if (itemId) body.itemId = itemId

    const response = await fetch(`/admin/orders/${orderId}/approve-return`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    hideLoading()

    if (data.success) {
      showToast(data.message, "success")
      const modal = window.bootstrap.Modal.getOrCreateInstance(document.getElementById("returnApprovalModal"))
      modal.hide()
      setTimeout(() => window.location.reload(), 1500)
    } else {
      showToast(data.message || "Failed to approve return", "error")
    }
  } catch (error) {
    hideLoading()
    console.error("Error approving return:", error)
    showToast("Failed to approve return", "error")
  }
}

// Reject return
function rejectReturn(orderId, itemId = null) {
  document.getElementById("rejectOrderId").value = orderId
  document.getElementById("rejectItemId").value = itemId || ""
  document.getElementById("rejectionReason").value = ""
  document.getElementById("rejectionReason").classList.remove("is-invalid")

  const modal = window.bootstrap.Modal.getOrCreateInstance(document.getElementById("returnRejectionModal"))
  modal.show()
}

// Reject item return
function rejectItemReturn(orderId, itemId) {
  rejectReturn(orderId, itemId)
}

// Confirm return rejection
async function confirmReturnRejection(orderId, reason, itemId = null) {
  try {
    showLoading("Processing return rejection...")

    const body = { reason }
    if (itemId) body.itemId = itemId

    const response = await fetch(`/admin/orders/${orderId}/reject-return`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    hideLoading()

    if (data.success) {
      showToast(data.message, "success")
      const modal = window.bootstrap.Modal.getOrCreateInstance(document.getElementById("returnRejectionModal"))
      modal.hide()
      setTimeout(() => window.location.reload(), 1500)
    } else {
      showToast(data.message || "Failed to reject return", "error")
    }
  } catch (error) {
    hideLoading()
    console.error("Error rejecting return:", error)
    showToast("Failed to reject return", "error")
  }
}

// Process refund
function processRefund(orderId) {
  document.getElementById("refundOrderId").value = orderId
  document.getElementById("refundAmount").value = ""
  document.getElementById("refundReason").value = ""
  document.getElementById("refundAmount").classList.remove("is-invalid")

  const modal = window.bootstrap.Modal.getOrCreateInstance(document.getElementById("refundModal"))
  modal.show()
}

// Confirm refund processing
async function confirmRefundProcessing(orderId, amount, reason) {
  try {
    showLoading("Processing refund...")

    const response = await fetch(`/admin/orders/${orderId}/process-refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refundAmount: Number.parseFloat(amount),
        reason,
      }),
    })

    const data = await response.json()
    hideLoading()

    if (data.success) {
      showToast(data.message, "success")
      const modal = window.bootstrap.Modal.getOrCreateInstance(document.getElementById("refundModal"))
      modal.hide()
      setTimeout(() => window.location.reload(), 1500)
    } else {
      showToast(data.message || "Failed to process refund", "error")
    }
  } catch (error) {
    hideLoading()
    console.error("Error processing refund:", error)
    showToast("Failed to process refund", "error")
  }
}

// Cancel order
async function cancelOrder(orderId) {
  if (!confirm("Are you sure you want to cancel this order?")) {
    return
  }

  try {
    showLoading("Cancelling order...")

    const response = await fetch(`/admin/orders/${orderId}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })

    const data = await response.json()
    hideLoading()

    if (data.success) {
      showToast(data.message, "success")
      setTimeout(() => window.location.reload(), 1500)
    } else {
      showToast(data.message || "Failed to cancel order", "error")
    }
  } catch (error) {
    hideLoading()
    console.error("Error cancelling order:", error)
    showToast("Failed to cancel order", "error")
  }
}

// Delete order
async function deleteOrder(orderId) {
  if (!confirm("Are you sure you want to delete this order? This action cannot be undone.")) {
    return
  }

  try {
    showLoading("Deleting order...")

    const response = await fetch(`/admin/orders/${orderId}`, {
      method: "DELETE",
    })

    const data = await response.json()
    hideLoading()

    if (data.success) {
      showToast(data.message, "success")
      setTimeout(() => window.location.reload(), 1500)
    } else {
      showToast(data.message || "Failed to delete order", "error")
    }
  } catch (error) {
    hideLoading()
    console.error("Error deleting order:", error)
    showToast("Failed to delete order", "error")
  }
}

// Send notification
async function sendNotification(orderId) {
  try {
    showLoading("Sending notification...")

    const response = await fetch(`/admin/orders/${orderId}/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })

    const data = await response.json()
    hideLoading()

    if (data.success) {
      showToast(data.message, "success")
    } else {
      showToast(data.message || "Failed to send notification", "error")
    }
  } catch (error) {
    hideLoading()
    console.error("Error sending notification:", error)
    showToast("Failed to send notification", "error")
  }
}

// Download invoice
function downloadInvoice(orderId) {
  window.open(`/admin/orders/${orderId}/invoice`, "_blank")
}

// Utility functions
function showLoading(message = "Loading...") {
  // Implementation for loading indicator
  console.log(message)
}

function hideLoading() {
  // Implementation to hide loading indicator
}

function showToast(message, type = "info") {
  // Create toast element
  const toastHtml = `
        <div class="toast align-items-center text-white bg-${type === "success" ? "success" : type === "error" ? "danger" : "info"} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `

  // Add to toast container
  const toastContainer = document.getElementById("toast-container")
  toastContainer.insertAdjacentHTML("beforeend", toastHtml)

  // Show toast
  const toastElement = toastContainer.lastElementChild
  const toast = window.bootstrap.Toast.getOrCreateInstance(toastElement)
  toast.show()

  // Remove toast element after it's hidden
  toastElement.addEventListener("hidden.bs.toast", () => {
    toastElement.remove()
  })
}
