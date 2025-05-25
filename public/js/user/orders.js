document.addEventListener("DOMContentLoaded", () => {
  // Import Bootstrap
  const bootstrap = window.bootstrap

  // Initialize order management functionality
  initializeSearch()
  initializeStatusFilters()
  initializeCancelModal()
  initializeReturnModal()

  // Toast container
  const toastContainer = document.getElementById("toast-container")

  // Function to show toast message
  function showToast(message, isSuccess) {
    const toast = document.createElement("div")
    toast.className = `toast align-items-center text-white ${isSuccess ? "bg-success" : "bg-danger"} border-0`
    toast.setAttribute("role", "alert")
    toast.setAttribute("aria-live", "assertive")
    toast.setAttribute("aria-atomic", "true")

    const toastContent = `
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `

    toast.innerHTML = toastContent
    toastContainer.appendChild(toast)

    const bsToast = new bootstrap.Toast(toast)
    bsToast.show()

    setTimeout(() => {
      bsToast.hide()
      setTimeout(() => {
        toast.remove()
      }, 500)
    }, 5000)
  }

  // Initialize search functionality
  function initializeSearch() {
    const searchInput = document.getElementById("orderSearch")
    const searchBtn = document.getElementById("searchBtn")
    const clearSearchBtn = document.getElementById("clearSearchBtn")
    const clearSearchBtn2 = document.getElementById("clearSearchBtn2")

    if (searchBtn && searchInput) {
      searchBtn.addEventListener("click", () => {
        performSearch()
      })

      searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          performSearch()
        }
      })
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener("click", () => {
        clearSearch()
      })
    }

    if (clearSearchBtn2) {
      clearSearchBtn2.addEventListener("click", () => {
        clearSearch()
      })
    }

    function performSearch() {
      const searchQuery = searchInput.value.trim()
      const currentUrl = new URL(window.location.href)

      if (searchQuery) {
        currentUrl.searchParams.set("search", searchQuery)
      } else {
        currentUrl.searchParams.delete("search")
      }

      currentUrl.searchParams.delete("page") // Reset to first page
      window.location.href = currentUrl.toString()
    }

    function clearSearch() {
      const currentUrl = new URL(window.location.href)
      currentUrl.searchParams.delete("search")
      currentUrl.searchParams.delete("page")
      window.location.href = currentUrl.toString()
    }
  }

  // Initialize status filter tabs
  function initializeStatusFilters() {
    const statusTabs = document.querySelectorAll("#orderTabs button[data-status]")

    statusTabs.forEach((tab) => {
      tab.addEventListener("click", (e) => {
        e.preventDefault()
        const status = tab.getAttribute("data-status")
        const currentUrl = new URL(window.location.href)

        if (status === "all") {
          currentUrl.searchParams.delete("status")
        } else {
          currentUrl.searchParams.set("status", status)
        }

        currentUrl.searchParams.delete("page") // Reset to first page
        window.location.href = currentUrl.toString()
      })
    })
  }

  // Initialize cancel order modal
  function initializeCancelModal() {
    const cancelModal = document.getElementById("cancelOrderModal")
    const cancelReasonSelect = document.getElementById("cancelReason")
    const otherReasonContainer = document.getElementById("otherReasonContainer")
    const confirmCancelBtn = document.getElementById("confirmCancelBtn")

    if (cancelModal) {
      cancelModal.addEventListener("show.bs.modal", (event) => {
        const button = event.relatedTarget
        const orderId = button.getAttribute("data-order-id")
        const orderNumber = button.getAttribute("data-order-number")

        document.getElementById("cancelOrderId").value = orderId
        document.getElementById("cancelOrderNumber").textContent = orderNumber

        // Reset form
        cancelReasonSelect.value = ""
        otherReasonContainer.style.display = "none"
        document.getElementById("otherCancelReason").value = ""
      })

      // Show/hide other reason textarea
      if (cancelReasonSelect) {
        cancelReasonSelect.addEventListener("change", () => {
          if (cancelReasonSelect.value === "other") {
            otherReasonContainer.style.display = "block"
          } else {
            otherReasonContainer.style.display = "none"
            document.getElementById("otherCancelReason").value = ""
          }
        })
      }

      // Handle cancel confirmation
      if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener("click", () => {
          const orderId = document.getElementById("cancelOrderId").value
          const reason = cancelReasonSelect.value
          const otherReason = document.getElementById("otherCancelReason").value

          let cancelReason = reason
          if (reason === "other" && otherReason.trim()) {
            cancelReason = otherReason.trim()
          }

          // Show loading state
          const originalText = confirmCancelBtn.textContent
          confirmCancelBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Cancelling...'
          confirmCancelBtn.disabled = true

          // Send cancel request
          fetch(`/account/orders/${orderId}/cancel`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ reason: cancelReason }),
          })
            .then((response) => response.json())
            .then((result) => {
              if (result.success) {
                showToast(result.message, true)
                const modal = bootstrap.Modal.getInstance(cancelModal)
                modal.hide()

                // Reload page after delay
                setTimeout(() => {
                  window.location.reload()
                }, 1500)
              } else {
                showToast(result.message || "Failed to cancel order", false)
                // Reset button
                confirmCancelBtn.textContent = originalText
                confirmCancelBtn.disabled = false
              }
            })
            .catch((error) => {
              console.error("Error cancelling order:", error)
              showToast("An error occurred while cancelling the order", false)
              // Reset button
              confirmCancelBtn.textContent = originalText
              confirmCancelBtn.disabled = false
            })
        })
      }
    }
  }

  // Initialize return order modal
  function initializeReturnModal() {
    const returnModal = document.getElementById("returnOrderModal")
    const returnReasonSelect = document.getElementById("returnReason")
    const otherReturnReasonContainer = document.getElementById("otherReturnReasonContainer")
    const otherReturnReason = document.getElementById("otherReturnReason")
    const confirmReturnBtn = document.getElementById("confirmReturnBtn")

    if (returnModal) {
      returnModal.addEventListener("show.bs.modal", (event) => {
        const button = event.relatedTarget
        const orderId = button.getAttribute("data-order-id")
        const orderNumber = button.getAttribute("data-order-number")

        document.getElementById("returnOrderId").value = orderId
        document.getElementById("returnOrderNumber").textContent = orderNumber

        // Reset form
        returnReasonSelect.value = ""
        returnReasonSelect.classList.remove("is-invalid")
        otherReturnReasonContainer.style.display = "none"
        otherReturnReason.value = ""
        otherReturnReason.classList.remove("is-invalid")
      })

      // Show/hide other reason textarea
      if (returnReasonSelect) {
        returnReasonSelect.addEventListener("change", () => {
          returnReasonSelect.classList.remove("is-invalid")

          if (returnReasonSelect.value === "other") {
            otherReturnReasonContainer.style.display = "block"
          } else {
            otherReturnReasonContainer.style.display = "none"
            otherReturnReason.value = ""
            otherReturnReason.classList.remove("is-invalid")
          }
        })
      }

      // Handle return confirmation
      if (confirmReturnBtn) {
        confirmReturnBtn.addEventListener("click", () => {
          const orderId = document.getElementById("returnOrderId").value
          const reason = returnReasonSelect.value
          const otherReasonText = otherReturnReason.value.trim()

          // Validation
          let isValid = true

          if (!reason) {
            returnReasonSelect.classList.add("is-invalid")
            isValid = false
          }

          if (reason === "other" && !otherReasonText) {
            otherReturnReason.classList.add("is-invalid")
            isValid = false
          }

          if (!isValid) {
            return
          }

          let returnReason = reason
          if (reason === "other") {
            returnReason = otherReasonText
          }

          // Show loading state
          const originalText = confirmReturnBtn.textContent
          confirmReturnBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Processing...'
          confirmReturnBtn.disabled = true

          // Send return request
          fetch(`/account/orders/${orderId}/return`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ reason: returnReason }),
          })
            .then((response) => response.json())
            .then((result) => {
              if (result.success) {
                showToast(result.message, true)
                const modal = bootstrap.Modal.getInstance(returnModal)
                modal.hide()

                // Reload page after delay
                setTimeout(() => {
                  window.location.reload()
                }, 1500)
              } else {
                showToast(result.message || "Failed to process return request", false)
                // Reset button
                confirmReturnBtn.textContent = originalText
                confirmReturnBtn.disabled = false
              }
            })
            .catch((error) => {
              console.error("Error processing return:", error)
              showToast("An error occurred while processing the return", false)
              // Reset button
              confirmReturnBtn.textContent = originalText
              confirmReturnBtn.disabled = false
            })
        })
      }
    }
  }
})
