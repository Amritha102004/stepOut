document.addEventListener("DOMContentLoaded", () => {
  // Initialize order management functionality
  initializeFilters()
  initializeTableActions()
  initializeBulkActions()
  initializeStatusUpdates()
  initializeOrderDetails()

  // Toast notification system
  const toastContainer = document.getElementById("toastContainer")
  const bootstrap = window.bootstrap // Declare the bootstrap variable

  function showToast(message, type = "success") {
    const toastId = "toast-" + Date.now()
    const toastHTML = `
            <div class="toast" id="${toastId}" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header">
                    <i class="fas fa-${type === "success" ? "check-circle text-success" : "exclamation-triangle text-danger"} me-2"></i>
                    <strong class="me-auto">${type === "success" ? "Success" : "Error"}</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `

    toastContainer.insertAdjacentHTML("beforeend", toastHTML)
    const toast = new bootstrap.Toast(document.getElementById(toastId))
    toast.show()

    // Auto remove after 5 seconds
    setTimeout(() => {
      const toastElement = document.getElementById(toastId)
      if (toastElement) {
        toastElement.remove()
      }
    }, 5000)
  }

  // Initialize filters
  function initializeFilters() {
    const searchInput = document.getElementById("searchInput")
    const statusFilter = document.getElementById("statusFilter")
    const paymentFilter = document.getElementById("paymentFilter")
    const dateFilter = document.getElementById("dateFilter")
    const sortFilter = document.getElementById("sortFilter")
    const clearFiltersBtn = document.getElementById("clearFilters")
    const clearFiltersBtn2 = document.getElementById("clearFiltersBtn")
    const customDateRange = document.getElementById("customDateRange")
    const applyDateFilter = document.getElementById("applyDateFilter")

    // Search functionality
    let searchTimeout
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        clearTimeout(searchTimeout)
        searchTimeout = setTimeout(() => {
          applyFilters()
        }, 500)
      })
    }
    // Filter change handlers
    ;[statusFilter, paymentFilter, sortFilter].forEach((filter) => {
      if (filter) {
        filter.addEventListener("change", applyFilters)
      }
    })

    // Date filter handler
    if (dateFilter) {
      dateFilter.addEventListener("change", function () {
        if (this.value === "custom") {
          customDateRange.style.display = "flex"
        } else {
          customDateRange.style.display = "none"
          applyFilters()
        }
      })
    }

    // Apply custom date filter
    if (applyDateFilter) {
      applyDateFilter.addEventListener("click", applyFilters)
    }
    // Clear filters
    ;[clearFiltersBtn, clearFiltersBtn2].forEach((btn) => {
      if (btn) {
        btn.addEventListener("click", () => {
          // Reset all filters
          if (searchInput) searchInput.value = ""
          if (statusFilter) statusFilter.value = ""
          if (paymentFilter) paymentFilter.value = ""
          if (dateFilter) dateFilter.value = ""
          if (sortFilter) sortFilter.value = "newest"
          if (customDateRange) customDateRange.style.display = "none"

          // Apply filters (which will be empty, showing all orders)
          applyFilters()
        })
      }
    })

    function applyFilters() {
      const params = new URLSearchParams()

      if (searchInput && searchInput.value) {
        params.append("search", searchInput.value)
      }
      if (statusFilter && statusFilter.value) {
        params.append("status", statusFilter.value)
      }
      if (paymentFilter && paymentFilter.value) {
        params.append("payment", paymentFilter.value)
      }
      if (dateFilter && dateFilter.value) {
        params.append("date", dateFilter.value)

        if (dateFilter.value === "custom") {
          const fromDate = document.getElementById("fromDate")
          const toDate = document.getElementById("toDate")
          if (fromDate && fromDate.value) {
            params.append("fromDate", fromDate.value)
          }
          if (toDate && toDate.value) {
            params.append("toDate", toDate.value)
          }
        }
      }
      if (sortFilter && sortFilter.value) {
        params.append("sort", sortFilter.value)
      }

      // Redirect with new parameters
      window.location.href = "/admin/orders?" + params.toString()
    }
  }

  // Initialize table actions
  function initializeTableActions() {
    const selectAllCheckbox = document.getElementById("selectAllCheckbox")
    const orderCheckboxes = document.querySelectorAll(".order-checkbox")
    const selectAllBtn = document.getElementById("selectAllBtn")
    const refreshBtn = document.getElementById("refreshBtn")

    // Select all functionality
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener("change", function () {
        orderCheckboxes.forEach((checkbox) => {
          checkbox.checked = this.checked
        })
        updateSelectedCount()
      })
    }

    if (selectAllBtn) {
      selectAllBtn.addEventListener("click", () => {
        const allChecked = Array.from(orderCheckboxes).every((cb) => cb.checked)
        orderCheckboxes.forEach((checkbox) => {
          checkbox.checked = !allChecked
        })
        if (selectAllCheckbox) {
          selectAllCheckbox.checked = !allChecked
        }
        updateSelectedCount()
      })
    }

    // Individual checkbox handlers
    orderCheckboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        updateSelectedCount()

        // Update select all checkbox state
        if (selectAllCheckbox) {
          const checkedCount = document.querySelectorAll(".order-checkbox:checked").length
          selectAllCheckbox.checked = checkedCount === orderCheckboxes.length
          selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < orderCheckboxes.length
        }
      })
    })

    // Refresh button
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        window.location.reload()
      })
    }

    function updateSelectedCount() {
      const selectedCount = document.querySelectorAll(".order-checkbox:checked").length
      const selectedCountElement = document.getElementById("selectedCount")
      if (selectedCountElement) {
        selectedCountElement.textContent = selectedCount
      }
    }
  }

  // Initialize bulk actions
  function initializeBulkActions() {
    const executeBulkActionBtn = document.getElementById("executeBulkAction")
    const bulkActionSelect = document.getElementById("bulkActionSelect")

    if (executeBulkActionBtn) {
      executeBulkActionBtn.addEventListener("click", () => {
        const selectedOrders = Array.from(document.querySelectorAll(".order-checkbox:checked")).map((cb) => cb.value)
        const action = bulkActionSelect.value

        if (!action) {
          showToast("Please select an action", "error")
          return
        }

        if (selectedOrders.length === 0) {
          showToast("Please select at least one order", "error")
          return
        }

        executeBulkAction(action, selectedOrders)
      })
    }

    function executeBulkAction(action, orderIds) {
      // Show loading state
      const originalText = executeBulkActionBtn.textContent
      executeBulkActionBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing...'
      executeBulkActionBtn.disabled = true

      fetch("/admin/orders/bulk-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: action,
          orderIds: orderIds,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            showToast(data.message)

            // Close modal and refresh page
            const modal = bootstrap.Modal.getInstance(document.getElementById("bulkActionModal"))
            modal.hide()

            setTimeout(() => {
              window.location.reload()
            }, 1000)
          } else {
            showToast(data.message || "Failed to execute bulk action", "error")
          }
        })
        .catch((error) => {
          console.error("Error:", error)
          showToast("An error occurred while processing the request", "error")
        })
        .finally(() => {
          // Reset button state
          executeBulkActionBtn.textContent = originalText
          executeBulkActionBtn.disabled = false
        })
    }
  }

  // Initialize status updates
  function initializeStatusUpdates() {
    const statusSelects = document.querySelectorAll(".status-select")

    statusSelects.forEach((select) => {
      select.addEventListener("change", function () {
        const orderId = this.dataset.orderId
        const newStatus = this.value
        const currentStatus = this.dataset.currentStatus

        if (newStatus === currentStatus) {
          return // No change
        }

        updateOrderStatus(orderId, newStatus, this)
      })
    })

    function updateOrderStatus(orderId, newStatus, selectElement) {
      // Show loading state
      selectElement.disabled = true

      fetch(`/admin/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            showToast(`Order status updated to ${newStatus}`)
            selectElement.dataset.currentStatus = newStatus
          } else {
            showToast(data.message || "Failed to update order status", "error")
            // Revert to previous status
            selectElement.value = selectElement.dataset.currentStatus
          }
        })
        .catch((error) => {
          console.error("Error:", error)
          showToast("An error occurred while updating order status", "error")
          // Revert to previous status
          selectElement.value = selectElement.dataset.currentStatus
        })
        .finally(() => {
          selectElement.disabled = false
        })
    }
  }

  // Initialize order details modal
  function initializeOrderDetails() {
    const orderDetailModal = document.getElementById("orderDetailModal")

    if (orderDetailModal) {
      orderDetailModal.addEventListener("show.bs.modal", (event) => {
        const button = event.relatedTarget
        const orderId = button.dataset.orderId

        if (orderId) {
          loadOrderDetails(orderId)
        }
      })
    }

    function loadOrderDetails(orderId) {
      const modalContent = document.getElementById("orderDetailContent")

      // Show loading state
      modalContent.innerHTML = `
                <div class="text-center py-5">
                    <div class="spinner-border" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <p class="mt-3">Loading order details...</p>
                </div>
            `

      fetch(`/admin/orders/${orderId}/details`)
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            renderOrderDetails(data.order)
          } else {
            modalContent.innerHTML = `
                            <div class="alert alert-danger">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                Failed to load order details: ${data.message}
                            </div>
                        `
          }
        })
        .catch((error) => {
          console.error("Error:", error)
          modalContent.innerHTML = `
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            An error occurred while loading order details.
                        </div>
                    `
        })
    }

    function renderOrderDetails(order) {
      const modalContent = document.getElementById("orderDetailContent")

      modalContent.innerHTML = `
                <div class="row">
                    <div class="col-md-8">
                        <!-- Order Information -->
                        <div class="order-detail-section">
                            <h6><i class="fas fa-info-circle me-2"></i>Order Information</h6>
                            <div class="detail-row">
                                <span class="detail-label">Order ID:</span>
                                <span class="detail-value">#${order.orderID}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Order Date:</span>
                                <span class="detail-value">${new Date(order.orderDate).toLocaleString()}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Status:</span>
                                <span class="detail-value">
                                    <span class="badge bg-${getStatusColor(order.orderStatus)}">${order.orderStatus.toUpperCase()}</span>
                                </span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Payment Method:</span>
                                <span class="detail-value">${order.paymentMethod === "COD" ? "Cash on Delivery" : "Online Payment"}</span>
                            </div>
                        </div>
                        
                        <!-- Customer Information -->
                        <div class="order-detail-section">
                            <h6><i class="fas fa-user me-2"></i>Customer Information</h6>
                            <div class="detail-row">
                                <span class="detail-label">Name:</span>
                                <span class="detail-value">${order.user.name}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Email:</span>
                                <span class="detail-value">${order.user.email}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Phone:</span>
                                <span class="detail-value">${order.address.mobile}</span>
                            </div>
                        </div>
                        
                        <!-- Delivery Address -->
                        <div class="order-detail-section">
                            <h6><i class="fas fa-map-marker-alt me-2"></i>Delivery Address</h6>
                            <div class="detail-row">
                                <span class="detail-label">Name:</span>
                                <span class="detail-value">${order.address.name}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Address:</span>
                                <span class="detail-value">${order.address.address}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">City:</span>
                                <span class="detail-value">${order.address.city}, ${order.address.state}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Pincode:</span>
                                <span class="detail-value">${order.address.pincode}</span>
                            </div>
                        </div>
                        
                        <!-- Order Items -->
                        <div class="order-detail-section">
                            <h6><i class="fas fa-shopping-bag me-2"></i>Order Items</h6>
                            ${order.products
                              .map(
                                (item) => `
                                <div class="product-item">
                                    <img src="${
                                      item.product.images && item.product.images.length > 0
                                        ? (item.product.images.find((img) => img.isMain) || item.product.images[0]).url
                                        : "/placeholder.svg?height=60&width=60&query=shoe"
                                    }" 
                                         alt="${item.product.name}" class="product-image">
                                    <div class="product-details">
                                        <div class="product-name">${item.product.name}</div>
                                        <div class="product-specs">Size: ${item.variant.size} | Quantity: ${item.quantity}</div>
                                        <div class="product-price">₹${item.variant.salePrice} × ${item.quantity} = ₹${item.variant.salePrice * item.quantity}</div>
                                        ${item.status !== "pending" ? `<div class="mt-1"><span class="badge bg-${getStatusColor(item.status)}">${item.status.toUpperCase()}</span></div>` : ""}
                                        ${item.cancelReason ? `<div class="mt-1"><small class="text-muted">Cancel Reason: ${item.cancelReason}</small></div>` : ""}
                                        ${item.returnReason ? `<div class="mt-1"><small class="text-muted">Return Reason: ${item.returnReason}</small></div>` : ""}
                                    </div>
                                </div>
                            `,
                              )
                              .join("")}
                        </div>
                    </div>
                    
                    <div class="col-md-4">
                        <!-- Order Summary -->
                        <div class="order-detail-section">
                            <h6><i class="fas fa-receipt me-2"></i>Order Summary</h6>
                            <div class="detail-row">
                                <span class="detail-label">Subtotal:</span>
                                <span class="detail-value">₹${order.totalAmount}</span>
                            </div>
                            ${
                              order.discount > 0
                                ? `
                                <div class="detail-row">
                                    <span class="detail-label">Discount:</span>
                                    <span class="detail-value text-success">-₹${order.discount}</span>
                                </div>
                            `
                                : ""
                            }
                            <div class="detail-row">
                                <span class="detail-label">Tax (18% GST):</span>
                                <span class="detail-value">₹${Math.round(order.totalAmount * 0.18)}</span>
                            </div>
                            <div class="detail-row">
                                <span class="detail-label">Shipping:</span>
                                <span class="detail-value text-success">FREE</span>
                            </div>
                            <hr>
                            <div class="detail-row">
                                <span class="detail-label"><strong>Total Amount:</strong></span>
                                <span class="detail-value"><strong>₹${order.finalAmount}</strong></span>
                            </div>
                        </div>
                        
                        <!-- Order Timeline -->
                        <div class="order-detail-section">
                            <h6><i class="fas fa-clock me-2"></i>Order Timeline</h6>
                            <div class="timeline">
                                <div class="timeline-item active">
                                    <div class="timeline-content">
                                        <h6>Order Placed</h6>
                                        <p>${new Date(order.orderDate).toLocaleString()}</p>
                                    </div>
                                </div>
                                ${
                                  order.orderStatus !== "cancelled" && order.orderStatus !== "returned"
                                    ? `
                                    <div class="timeline-item ${["confirmed", "shipped", "delivered"].includes(order.orderStatus) ? "active" : ""}">
                                        <div class="timeline-content">
                                            <h6>Order Confirmed</h6>
                                            <p>${["confirmed", "shipped", "delivered"].includes(order.orderStatus) ? "Order confirmed by admin" : "Pending confirmation"}</p>
                                        </div>
                                    </div>
                                    <div class="timeline-item ${["shipped", "delivered"].includes(order.orderStatus) ? "active" : ""}">
                                        <div class="timeline-content">
                                            <h6>Order Shipped</h6>
                                            <p>${["shipped", "delivered"].includes(order.orderStatus) ? "Order shipped to customer" : "Will be shipped soon"}</p>
                                        </div>
                                    </div>
                                    <div class="timeline-item ${order.orderStatus === "delivered" ? "active" : ""}">
                                        <div class="timeline-content">
                                            <h6>Order Delivered</h6>
                                            <p>${order.orderStatus === "delivered" ? "Order delivered successfully" : "Estimated delivery in 5-7 days"}</p>
                                        </div>
                                    </div>
                                `
                                    : `
                                    <div class="timeline-item active">
                                        <div class="timeline-content">
                                            <h6>Order ${order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)}</h6>
                                            <p>${order.cancelReason || order.returnReason || `Order has been ${order.orderStatus}`}</p>
                                        </div>
                                    </div>
                                `
                                }
                            </div>
                        </div>
                        
                        <!-- Quick Actions -->
                        <div class="order-detail-section">
                            <h6><i class="fas fa-cog me-2"></i>Quick Actions</h6>
                            <div class="d-grid gap-2">
                                <a href="/admin/orders/${order._id}/invoice" class="btn btn-outline-primary btn-sm" target="_blank">
                                    <i class="fas fa-file-pdf me-2"></i>Download Invoice
                                </a>
                                <button class="btn btn-outline-info btn-sm" onclick="sendNotification('${order._id}')">
                                    <i class="fas fa-bell me-2"></i>Send Notification
                                </button>
                                ${
                                  order.orderStatus === "pending" || order.orderStatus === "confirmed"
                                    ? `
                                    <button class="btn btn-outline-danger btn-sm" onclick="cancelOrder('${order._id}')">
                                        <i class="fas fa-times me-2"></i>Cancel Order
                                    </button>
                                `
                                    : ""
                                }
                            </div>
                        </div>
                    </div>
                </div>
            `
    }

    function getStatusColor(status) {
      const colors = {
        pending: "warning",
        confirmed: "info",
        shipped: "primary",
        delivered: "success",
        cancelled: "danger",
        returned: "secondary",
      }
      return colors[status] || "secondary"
    }
  }

  // Export orders functionality
  const exportOrdersBtn = document.getElementById("exportOrdersBtn")
  if (exportOrdersBtn) {
    exportOrdersBtn.addEventListener("click", () => {
      const currentUrl = new URL(window.location.href)
      const params = currentUrl.searchParams

      // Add export parameter
      params.set("export", "true")

      // Create download link
      const downloadUrl = "/admin/orders?" + params.toString()
      window.open(downloadUrl, "_blank")
    })
  }
})

// Global functions for inline actions
function sendNotification(orderId) {
  fetch(`/admin/orders/${orderId}/notify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        showToast("Notification sent successfully")
      } else {
        showToast(data.message || "Failed to send notification", "error")
      }
    })
    .catch((error) => {
      console.error("Error:", error)
      showToast("An error occurred while sending notification", "error")
    })
}

function cancelOrder(orderId) {
  if (confirm("Are you sure you want to cancel this order?")) {
    fetch(`/admin/orders/${orderId}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          showToast("Order cancelled successfully")
          setTimeout(() => {
            window.location.reload()
          }, 1000)
        } else {
          showToast(data.message || "Failed to cancel order", "error")
        }
      })
      .catch((error) => {
        console.error("Error:", error)
        showToast("An error occurred while cancelling order", "error")
      })
  }
}

function deleteOrder(orderId) {
  if (confirm("Are you sure you want to delete this order? This action cannot be undone.")) {
    fetch(`/admin/orders/${orderId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          showToast("Order deleted successfully")
          setTimeout(() => {
            window.location.reload()
          }, 1000)
        } else {
          showToast(data.message || "Failed to delete order", "error")
        }
      })
      .catch((error) => {
        console.error("Error:", error)
        showToast("An error occurred while deleting order", "error")
      })
  }
}

// Helper function to show toast notifications
function showToast(message, type = "success") {
  const toastContainer = document.getElementById("toastContainer")
  const bootstrap = window.bootstrap // Declare the bootstrap variable
  const toastId = "toast-" + Date.now()
  const toastHTML = `
        <div class="toast" id="${toastId}" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header">
                <i class="fas fa-${type === "success" ? "check-circle text-success" : "exclamation-triangle text-danger"} me-2"></i>
                <strong class="me-auto">${type === "success" ? "Success" : "Error"}</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `

  toastContainer.insertAdjacentHTML("beforeend", toastHTML)
  const toast = new bootstrap.Toast(document.getElementById(toastId))
  toast.show()

  // Auto remove after 5 seconds
  setTimeout(() => {
    const toastElement = document.getElementById(toastId)
    if (toastElement) {
      toastElement.remove()
    }
  }, 5000)
}
