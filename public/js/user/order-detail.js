document.addEventListener("DOMContentLoaded", () => {
  // Import Bootstrap
  const bootstrap = window.bootstrap

  // Initialize order detail functionality
  initializeCancelModals()
  initializeReturnModals()
  initializeItemActions()

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

  // Initialize cancel order modal (reuse from orders.js)
  function initializeCancelModals() {
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

  // Initialize return order modal (reuse from orders.js)
  function initializeReturnModals() {
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

  // Initialize individual item actions
  function initializeItemActions() {
    initializeCancelItemModal()
    initializeReturnItemModal()
  }

  // Initialize cancel item modal
  function initializeCancelItemModal() {
    const cancelItemModal = document.getElementById("cancelItemModal")
    const cancelItemReasonSelect = document.getElementById("cancelItemReason")
    const otherItemReasonContainer = document.getElementById("otherItemReasonContainer")
    const confirmCancelItemBtn = document.getElementById("confirmCancelItemBtn")

    if (cancelItemModal) {
      cancelItemModal.addEventListener("show.bs.modal", (event) => {
        const button = event.relatedTarget
        const orderId = button.getAttribute("data-order-id")
        const productId = button.getAttribute("data-product-id")
        const variantSize = button.getAttribute("data-variant-size")
        const productName = button.getAttribute("data-product-name")

        document.getElementById("cancelItemOrderId").value = orderId
        document.getElementById("cancelItemProductId").value = productId
        document.getElementById("cancelItemVariantSize").value = variantSize
        document.getElementById("cancelItemName").textContent = productName

        // Reset form
        cancelItemReasonSelect.value = ""
        otherItemReasonContainer.style.display = "none"
        document.getElementById("otherCancelItemReason").value = ""
      })

      // Show/hide other reason textarea
      if (cancelItemReasonSelect) {
        cancelItemReasonSelect.addEventListener("change", () => {
          if (cancelItemReasonSelect.value === "other") {
            otherItemReasonContainer.style.display = "block"
          } else {
            otherItemReasonContainer.style.display = "none"
            document.getElementById("otherCancelItemReason").value = ""
          }
        })
      }

      // Handle cancel item confirmation
      if (confirmCancelItemBtn) {
        confirmCancelItemBtn.addEventListener("click", () => {
          const orderId = document.getElementById("cancelItemOrderId").value
          const productId = document.getElementById("cancelItemProductId").value
          const variantSize = document.getElementById("cancelItemVariantSize").value
          const reason = cancelItemReasonSelect.value
          const otherReason = document.getElementById("otherCancelItemReason").value

          let cancelReason = reason
          if (reason === "other" && otherReason.trim()) {
            cancelReason = otherReason.trim()
          }

          // Show loading state
          const originalText = confirmCancelItemBtn.textContent
          confirmCancelItemBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Cancelling...'
          confirmCancelItemBtn.disabled = true

          // FIXED: Send cancel item request with correct parameter name 'size'
          fetch(`/account/orders/${orderId}/cancel-item`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              productId: productId,
              size: variantSize, // CHANGED: from 'variantSize' to 'size'
              reason: cancelReason,
            }),
          })
            .then((response) => response.json())
            .then((result) => {
              if (result.success) {
                showToast(result.message, true)
                const modal = bootstrap.Modal.getInstance(cancelItemModal)
                modal.hide()

                // Reload page after delay
                setTimeout(() => {
                  window.location.reload()
                }, 1500)
              } else {
                showToast(result.message || "Failed to cancel item", false)
                // Reset button
                confirmCancelItemBtn.textContent = originalText
                confirmCancelItemBtn.disabled = false
              }
            })
            .catch((error) => {
              console.error("Error cancelling item:", error)
              showToast("An error occurred while cancelling the item", false)
              // Reset button
              confirmCancelItemBtn.textContent = originalText
              confirmCancelItemBtn.disabled = false
            })
        })
      }
    }
  }

  // Initialize return item modal
  function initializeReturnItemModal() {
    const returnItemModal = document.getElementById("returnItemModal")
    const returnItemReasonSelect = document.getElementById("returnItemReason")
    const otherReturnItemReasonContainer = document.getElementById("otherReturnItemReasonContainer")
    const otherReturnItemReason = document.getElementById("otherReturnItemReason")
    const confirmReturnItemBtn = document.getElementById("confirmReturnItemBtn")

    if (returnItemModal) {
      returnItemModal.addEventListener("show.bs.modal", (event) => {
        const button = event.relatedTarget
        const orderId = button.getAttribute("data-order-id")
        const productId = button.getAttribute("data-product-id")
        const variantSize = button.getAttribute("data-variant-size")
        const productName = button.getAttribute("data-product-name")

        document.getElementById("returnItemOrderId").value = orderId
        document.getElementById("returnItemProductId").value = productId
        document.getElementById("returnItemVariantSize").value = variantSize
        document.getElementById("returnItemName").textContent = productName

        // Reset form
        returnItemReasonSelect.value = ""
        returnItemReasonSelect.classList.remove("is-invalid")
        otherReturnItemReasonContainer.style.display = "none"
        otherReturnItemReason.value = ""
        otherReturnItemReason.classList.remove("is-invalid")
      })

      // Show/hide other reason textarea
      if (returnItemReasonSelect) {
        returnItemReasonSelect.addEventListener("change", () => {
          returnItemReasonSelect.classList.remove("is-invalid")

          if (returnItemReasonSelect.value === "other") {
            otherReturnItemReasonContainer.style.display = "block"
          } else {
            otherReturnItemReasonContainer.style.display = "none"
            otherReturnItemReason.value = ""
            otherReturnItemReason.classList.remove("is-invalid")
          }
        })
      }

      // Handle return item confirmation
      if (confirmReturnItemBtn) {
        confirmReturnItemBtn.addEventListener("click", () => {
          const orderId = document.getElementById("returnItemOrderId").value
          const productId = document.getElementById("returnItemProductId").value
          const variantSize = document.getElementById("returnItemVariantSize").value
          const reason = returnItemReasonSelect.value
          const otherReasonText = otherReturnItemReason.value.trim()

          // Validation
          let isValid = true

          if (!reason) {
            returnItemReasonSelect.classList.add("is-invalid")
            isValid = false
          }

          if (reason === "other" && !otherReasonText) {
            otherReturnItemReason.classList.add("is-invalid")
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
          const originalText = confirmReturnItemBtn.textContent
          confirmReturnItemBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Processing...'
          confirmReturnItemBtn.disabled = true

          // FIXED: Send return item request with correct parameter name 'size'
          fetch(`/account/orders/${orderId}/return-item`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              productId: productId,
              size: variantSize, // CHANGED: from 'variantSize' to 'size'
              reason: returnReason,
            }),
          })
            .then((response) => response.json())
            .then((result) => {
              if (result.success) {
                showToast(result.message, true)
                const modal = bootstrap.Modal.getInstance(returnItemModal)
                modal.hide()

                // Reload page after delay
                setTimeout(() => {
                  window.location.reload()
                }, 1500)
              } else {
                showToast(result.message || "Failed to process return request", false)
                // Reset button
                confirmReturnItemBtn.textContent = originalText
                confirmReturnItemBtn.disabled = false
              }
            })
            .catch((error) => {
              console.error("Error processing return:", error)
              showToast("An error occurred while processing the return", false)
              // Reset button
              confirmReturnItemBtn.textContent = originalText
              confirmReturnItemBtn.disabled = false
            })
        })
      }
    }
  }
})
