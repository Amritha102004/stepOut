document.addEventListener("DOMContentLoaded", () => {
  // Initialize wallet management functionality
  initializeFilters()
  initializeWalletActions()
  initializeModals()

  // Toast notification system
  const toastContainer = document.getElementById("toastContainer")
  const bootstrap = window.bootstrap

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
    const transactionTypeFilter = document.getElementById("transactionTypeFilter")
    const clearFiltersBtn = document.getElementById("clearFilters")
    const refreshBtn = document.getElementById("refreshBtn")

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
    if (transactionTypeFilter) {
      transactionTypeFilter.addEventListener("change", applyFilters)
    }

    // Clear filters
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = ""
        if (transactionTypeFilter) transactionTypeFilter.value = "all"
        applyFilters()
      })
    }

    // Refresh button
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        window.location.reload()
      })
    }

    function applyFilters() {
      const params = new URLSearchParams()

      if (searchInput && searchInput.value) {
        params.append("search", searchInput.value)
      }
      if (transactionTypeFilter && transactionTypeFilter.value) {
        params.append("type", transactionTypeFilter.value)
      }

      // Redirect with new parameters
      window.location.href = "/admin/wallet?" + params.toString()
    }
  }

  // Initialize wallet actions
  function initializeWalletActions() {
    const viewTransactionsBtn = document.getElementById("viewTransactions")

    if (viewTransactionsBtn) {
      viewTransactionsBtn.addEventListener("click", () => {
        loadAllTransactions()
      })
    }
  }

  // Initialize modals
  function initializeModals() {
    const walletAnalyticsModal = document.getElementById("walletAnalyticsModal")

    if (walletAnalyticsModal) {
      walletAnalyticsModal.addEventListener("show.bs.modal", () => {
        loadWalletAnalytics()
      })
    }
  }

  // Global functions
  window.viewWalletDetails = (userId) => {
    const modal = new bootstrap.Modal(document.getElementById("walletDetailsModal"))
    const modalContent = document.getElementById("walletDetailsContent")

    // Show loading state
    modalContent.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3">Loading wallet details...</p>
            </div>
        `

    modal.show()

    fetch(`/admin/wallet/user/${userId}/details`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          renderWalletDetails(data.wallet, data.stats)
        } else {
          modalContent.innerHTML = `
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            Failed to load wallet details: ${data.message}
                        </div>
                    `
        }
      })
      .catch((error) => {
        console.error("Error:", error)
        modalContent.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        An error occurred while loading wallet details.
                    </div>
                `
      })
  }

  window.addMoney = (userId) => {
    const modal = new bootstrap.Modal(document.getElementById("addMoneyModal"))
    const userSelect = document.getElementById("userSelect")

    if (userId && userSelect) {
      userSelect.value = userId
    }

    modal.show()
  }

  window.deductMoney = (userId) => {
    // First get wallet details to show current balance
    fetch(`/admin/wallet/user/${userId}/details`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          const modal = new bootstrap.Modal(document.getElementById("deductMoneyModal"))
          document.getElementById("deductUserId").value = userId
          document.getElementById("availableBalance").textContent =
            `Available Balance: ₹${data.wallet.balance.toLocaleString("en-IN")}`
          document.getElementById("deductAmount").max = data.wallet.balance
          modal.show()
        } else {
          showToast("Failed to load wallet details", "error")
        }
      })
      .catch((error) => {
        console.error("Error:", error)
        showToast("An error occurred while loading wallet details", "error")
      })
  }

  window.submitAddMoney = () => {
    const userSelect = document.getElementById("userSelect")
    const amountInput = document.getElementById("addAmount")
    const reasonInput = document.getElementById("addReason")

    const userId = userSelect.value
    const amount = Number.parseFloat(amountInput.value)
    const reason = reasonInput.value

    if (!userId) {
      showToast("Please select a user", "error")
      return
    }

    if (!amount || amount <= 0 || amount > 100000) {
      showToast("Please enter a valid amount between ₹1 and ₹100,000", "error")
      return
    }

    // Show loading state
    const submitBtn = document.querySelector("#addMoneyModal .btn-success")
    const originalText = submitBtn.textContent
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing...'
    submitBtn.disabled = true

    fetch(`/admin/wallet/user/${userId}/add-money`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amount,
        reason: reason || "Money added by admin",
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          showToast(data.message)
          // Close modal and refresh page
          const modal = bootstrap.Modal.getInstance(document.getElementById("addMoneyModal"))
          modal.hide()
          setTimeout(() => {
            window.location.reload()
          }, 1000)
        } else {
          showToast(data.message || "Failed to add money", "error")
        }
      })
      .catch((error) => {
        console.error("Error:", error)
        showToast("An error occurred while adding money", "error")
      })
      .finally(() => {
        // Reset button state
        submitBtn.textContent = originalText
        submitBtn.disabled = false
      })
  }

  window.submitDeductMoney = () => {
    const userIdInput = document.getElementById("deductUserId")
    const amountInput = document.getElementById("deductAmount")
    const reasonInput = document.getElementById("deductReason")

    const userId = userIdInput.value
    const amount = Number.parseFloat(amountInput.value)
    const reason = reasonInput.value

    if (!amount || amount <= 0) {
      showToast("Please enter a valid amount", "error")
      return
    }

    if (!reason) {
      showToast("Please provide a reason for deduction", "error")
      return
    }

    // Show loading state
    const submitBtn = document.querySelector("#deductMoneyModal .btn-warning")
    const originalText = submitBtn.textContent
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing...'
    submitBtn.disabled = true

    fetch(`/admin/wallet/user/${userId}/deduct-money`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amount,
        reason: reason,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          showToast(data.message)
          // Close modal and refresh page
          const modal = bootstrap.Modal.getInstance(document.getElementById("deductMoneyModal"))
          modal.hide()
          setTimeout(() => {
            window.location.reload()
          }, 1000)
        } else {
          showToast(data.message || "Failed to deduct money", "error")
        }
      })
      .catch((error) => {
        console.error("Error:", error)
        showToast("An error occurred while deducting money", "error")
      })
      .finally(() => {
        // Reset button state
        submitBtn.textContent = originalText
        submitBtn.disabled = false
      })
  }

  function renderWalletDetails(wallet, stats) {
    const modalContent = document.getElementById("walletDetailsContent")

    modalContent.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <!-- User Information -->
                    <div class="wallet-detail-section">
                        <h6><i class="fas fa-user me-2"></i>User Information</h6>
                        <div class="detail-row">
                            <span class="detail-label">Name:</span>
                            <span class="detail-value">${wallet.userId.fullName}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Email:</span>
                            <span class="detail-value">${wallet.userId.email}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Phone:</span>
                            <span class="detail-value">${wallet.userId.phoneNumber || "Not provided"}</span>
                        </div>
                    </div>
                    
                    <!-- Wallet Summary -->
                    <div class="wallet-detail-section">
                        <h6><i class="fas fa-wallet me-2"></i>Wallet Summary</h6>
                        <div class="detail-row">
                            <span class="detail-label">Current Balance:</span>
                            <span class="detail-value"><strong>₹${wallet.balance.toLocaleString("en-IN")}</strong></span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Total Credits:</span>
                            <span class="detail-value text-success">₹${stats.totalCredits.toLocaleString("en-IN")}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Total Debits:</span>
                            <span class="detail-value text-danger">₹${stats.totalDebits.toLocaleString("en-IN")}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Money Added:</span>
                            <span class="detail-value text-info">₹${stats.totalAdded.toLocaleString("en-IN")}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Total Transactions:</span>
                            <span class="detail-value">${stats.totalTransactions}</span>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-6">
                    <!-- Recent Transactions -->
                    <div class="wallet-detail-section">
                        <h6><i class="fas fa-history me-2"></i>Recent Transactions</h6>
                        ${
                          wallet.transactions.length > 0
                            ? wallet.transactions
                                .sort((a, b) => new Date(b.date) - new Date(a.date))
                                .slice(0, 5)
                                .map(
                                  (transaction) => `
                                <div class="transaction-item">
                                    <div class="transaction-icon ${transaction.type}">
                                        <i class="fas fa-${
                                          transaction.type === "credit"
                                            ? "arrow-down"
                                            : transaction.type === "debit"
                                              ? "arrow-up"
                                              : "plus"
                                        }"></i>
                                    </div>
                                    <div class="transaction-details">
                                        <div class="transaction-reason">${transaction.reason}</div>
                                        <div class="transaction-meta">
                                            <span>${new Date(transaction.date).toLocaleDateString("en-IN")}</span>
                                            ${
                                              transaction.orderId
                                                ? `<span>Order: ${transaction.orderId.orderID}</span>`
                                                : ""
                                            }
                                        </div>
                                    </div>
                                    <div class="transaction-amount">
                                        <span class="amount ${transaction.type}">
                                            ${transaction.type === "debit" ? "-" : "+"}₹${transaction.amount.toLocaleString("en-IN")}
                                        </span>
                                    </div>
                                </div>
                            `,
                                )
                                .join("")
                            : '<p class="text-muted text-center">No transactions found</p>'
                        }
                    </div>
                    
                    <!-- Quick Actions -->
                    <div class="wallet-detail-section">
                        <h6><i class="fas fa-cog me-2"></i>Quick Actions</h6>
                        <div class="d-grid gap-2">
                            <button class="btn btn-success btn-sm" onclick="addMoney('${wallet.userId._id}')">
                                <i class="fas fa-plus me-2"></i>Add Money
                            </button>
                            <button class="btn btn-warning btn-sm" onclick="deductMoney('${wallet.userId._id}')">
                                <i class="fas fa-minus me-2"></i>Deduct Money
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `
  }

  function loadAllTransactions() {
    const modal = new bootstrap.Modal(document.getElementById("transactionsModal"))
    const modalContent = document.getElementById("transactionsContent")

    // Show loading state
    modalContent.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3">Loading transactions...</p>
            </div>
        `

    modal.show()

    const searchQuery = document.getElementById("searchInput")?.value || ""
    const transactionType = document.getElementById("transactionTypeFilter")?.value || "all"

    fetch(`/admin/wallet/transactions?search=${searchQuery}&type=${transactionType}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          renderAllTransactions(data.transactions)
        } else {
          modalContent.innerHTML = `
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            Failed to load transactions: ${data.message}
                        </div>
                    `
        }
      })
      .catch((error) => {
        console.error("Error:", error)
        modalContent.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        An error occurred while loading transactions.
                    </div>
                `
      })
  }

  function renderAllTransactions(transactions) {
    const modalContent = document.getElementById("transactionsContent")

    if (transactions.length === 0) {
      modalContent.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-receipt fa-4x text-muted mb-3"></i>
                    <h5>No Transactions Found</h5>
                    <p class="text-muted">No transactions match your current filters.</p>
                </div>
            `
      return
    }

    modalContent.innerHTML = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead class="table-light">
                        <tr>
                            <th>User</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Reason</th>
                            <th>Order</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transactions
                          .map(
                            (transaction) => `
                            <tr>
                                <td>
                                    <div class="user-info">
                                        <strong>${transaction.user.fullName}</strong>
                                        <div><small class="text-muted">${transaction.user.email}</small></div>
                                    </div>
                                </td>
                                <td>
                                    <span class="badge bg-${
                                      transaction.type === "credit"
                                        ? "success"
                                        : transaction.type === "debit"
                                          ? "danger"
                                          : "info"
                                    }">
                                        ${transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                                    </span>
                                </td>
                                <td>
                                    <span class="amount ${transaction.type}">
                                        ${transaction.type === "debit" ? "-" : "+"}₹${transaction.amount.toLocaleString("en-IN")}
                                    </span>
                                </td>
                                <td>${transaction.reason}</td>
                                <td>
                                    ${
                                      transaction.orderId
                                        ? `<a href="/admin/orders/${transaction.orderObjectId}" target="_blank">${transaction.orderId}</a>`
                                        : "-"
                                    }
                                </td>
                                <td>${new Date(transaction.date).toLocaleString("en-IN")}</td>
                            </tr>
                        `,
                          )
                          .join("")}
                    </tbody>
                </table>
            </div>
        `
  }

  function loadWalletAnalytics() {
    const modalContent = document.getElementById("analyticsContent")

    // Show loading state
    modalContent.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-3">Loading analytics...</p>
            </div>
        `

    fetch("/admin/wallet/analytics")
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          renderWalletAnalytics(data.analytics, data.overallStats)
        } else {
          modalContent.innerHTML = `
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            Failed to load analytics: ${data.message}
                        </div>
                    `
        }
      })
      .catch((error) => {
        console.error("Error:", error)
        modalContent.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        An error occurred while loading analytics.
                    </div>
                `
      })
  }

  function renderWalletAnalytics(analytics, overallStats) {
    const modalContent = document.getElementById("analyticsContent")

    const creditData = analytics.find((a) => a._id === "credit") || { totalAmount: 0, count: 0 }
    const debitData = analytics.find((a) => a._id === "debit") || { totalAmount: 0, count: 0 }
    const addData = analytics.find((a) => a._id === "add") || { totalAmount: 0, count: 0 }

    modalContent.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <div class="wallet-detail-section">
                        <h6><i class="fas fa-chart-bar me-2"></i>Transaction Analytics (This Month)</h6>
                        <div class="detail-row">
                            <span class="detail-label">Total Credits (Refunds):</span>
                            <span class="detail-value text-success">₹${creditData.totalAmount.toLocaleString("en-IN")} (${creditData.count} transactions)</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Total Debits (Payments):</span>
                            <span class="detail-value text-danger">₹${debitData.totalAmount.toLocaleString("en-IN")} (${debitData.count} transactions)</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Money Added by Admin:</span>
                            <span class="detail-value text-info">₹${addData.totalAmount.toLocaleString("en-IN")} (${addData.count} transactions)</span>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-6">
                    <div class="wallet-detail-section">
                        <h6><i class="fas fa-chart-pie me-2"></i>Overall Statistics</h6>
                        <div class="detail-row">
                            <span class="detail-label">Total Active Wallets:</span>
                            <span class="detail-value">${overallStats.totalWallets || 0}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Total Balance Across All Wallets:</span>
                            <span class="detail-value">₹${(overallStats.totalBalance || 0).toLocaleString("en-IN")}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Average Wallet Balance:</span>
                            <span class="detail-value">₹${(overallStats.averageBalance || 0).toFixed(2)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Total Transactions:</span>
                            <span class="detail-value">${overallStats.totalTransactions || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        `
  }
})
