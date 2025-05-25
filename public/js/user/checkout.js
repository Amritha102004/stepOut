document.addEventListener("DOMContentLoaded", () => {
  // Import Bootstrap
  const bootstrap = window.bootstrap

  // Initialize checkout functionality
  initializeAddressSelection()
  initializePaymentSelection()
  initializeCouponSection()
  initializePlaceOrderButton()
  initializeAddressModals()

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

  // Initialize address selection
  function initializeAddressSelection() {
    const addressRadios = document.querySelectorAll(".address-radio")
    const placeOrderBtn = document.getElementById("placeOrderBtn")

    addressRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (radio.checked) {
          // Enable place order button if address is selected
          if (placeOrderBtn) {
            placeOrderBtn.disabled = false
          }
        }
      })
    })
  }

  // Initialize payment selection
  function initializePaymentSelection() {
    const paymentRadios = document.querySelectorAll(".payment-radio")

    paymentRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        console.log("Payment method selected:", radio.value)
      })
    })
  }

  // Initialize coupon section
  function initializeCouponSection() {
    const applyCouponBtn = document.getElementById("applyCoupon")
    const couponInput = document.getElementById("couponCode")

    if (applyCouponBtn && couponInput) {
      applyCouponBtn.addEventListener("click", () => {
        const couponCode = couponInput.value.trim()

        if (!couponCode) {
          showToast("Please enter a coupon code", false)
          return
        }

        // Show loading state
        const originalText = applyCouponBtn.textContent
        applyCouponBtn.textContent = "Applying..."
        applyCouponBtn.disabled = true

        // Apply coupon (implement your coupon logic here)
        setTimeout(() => {
          // Reset button
          applyCouponBtn.textContent = originalText
          applyCouponBtn.disabled = false

          // Simulate coupon validation
          if (couponCode.toUpperCase() === "SAVE10") {
            applyCoupon(10) // 10% discount
            showToast("Coupon applied successfully!", true)
          } else if (couponCode.toUpperCase() === "FLAT50") {
            applyCoupon(50, true) // ₹50 flat discount
            showToast("Coupon applied successfully!", true)
          } else {
            showToast("Invalid coupon code", false)
          }
        }, 1000)
      })

      // Allow Enter key to apply coupon
      couponInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          applyCouponBtn.click()
        }
      })
    }
  }

  // Apply coupon discount
  function applyCoupon(discount, isFlat = false) {
    const finalTotalElement = document.getElementById("finalTotal")
    const discountRow = document.getElementById("discountRow")
    const discountAmount = document.getElementById("discountAmount")

    if (!finalTotalElement) return

    const currentTotal = Number.parseFloat(finalTotalElement.textContent)
    let discountValue = 0

    if (isFlat) {
      discountValue = discount
    } else {
      // Calculate percentage discount on subtotal (excluding tax)
      const subtotalElement = document.querySelector(".price-row span:last-child")
      if (subtotalElement) {
        const subtotalText = subtotalElement.textContent.replace("₹", "")
        const subtotal = Number.parseFloat(subtotalText)
        discountValue = (subtotal * discount) / 100
      }
    }

    // Update discount display
    if (discountAmount && discountRow) {
      discountAmount.textContent = discountValue.toFixed(0)
      discountRow.style.display = "flex"
    }

    // Update final total
    const newTotal = currentTotal - discountValue
    finalTotalElement.textContent = newTotal.toFixed(0)
  }

  // Initialize place order button
  function initializePlaceOrderButton() {
    const placeOrderBtn = document.getElementById("placeOrderBtn")

    if (placeOrderBtn) {
      placeOrderBtn.addEventListener("click", () => {
        // Validate address selection
        const selectedAddress = document.querySelector('input[name="selectedAddress"]:checked')
        if (!selectedAddress) {
          showToast("Please select a delivery address", false)
          return
        }

        // Validate payment method
        const selectedPayment = document.querySelector('input[name="paymentMethod"]:checked')
        if (!selectedPayment) {
          showToast("Please select a payment method", false)
          return
        }

        // Show loading state
        const originalText = placeOrderBtn.innerHTML
        placeOrderBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing Order...'
        placeOrderBtn.disabled = true

        // Prepare order data
        const orderData = {
          addressId: selectedAddress.value,
          paymentMethod: selectedPayment.value,
          couponCode: document.getElementById("couponCode")?.value || null,
        }

        // Place order
        fetch("/checkout/place-order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(orderData),
        })
          .then((response) => response.json())
          .then((result) => {
            if (result.success) {
              // Redirect to order success page
              window.location.href = `/order-success?orderId=${result.orderId}`
            } else {
              showToast(result.message || "Failed to place order", false)
              // Reset button
              placeOrderBtn.innerHTML = originalText
              placeOrderBtn.disabled = false
            }
          })
          .catch((error) => {
            console.error("Error placing order:", error)
            showToast("An error occurred while placing the order", false)
            // Reset button
            placeOrderBtn.innerHTML = originalText
            placeOrderBtn.disabled = false
          })
      })
    }
  }

  // Initialize address modals (reuse from addresses page)
  function initializeAddressModals() {
    const addAddressForm = document.getElementById("addAddressForm")
    const editAddressForm = document.getElementById("editAddressForm")
    const saveAddressBtn = document.getElementById("saveAddressBtn")
    const updateAddressBtn = document.getElementById("updateAddressBtn")

    // Function to display form errors
    function displayErrors(form, errors) {
      // Clear previous errors
      const errorElements = form.querySelectorAll(".invalid-feedback")
      errorElements.forEach((el) => {
        el.textContent = ""
        el.style.display = "none"
      })

      const inputs = form.querySelectorAll(".form-control")
      inputs.forEach((input) => {
        input.classList.remove("is-invalid")
      })

      // Display new errors
      if (errors) {
        for (const field in errors) {
          const input = form.querySelector(`[name="${field}"]`)

          if (input) {
            input.classList.add("is-invalid")
            const feedbackEl = input.nextElementSibling
            if (feedbackEl && feedbackEl.classList.contains("invalid-feedback")) {
              feedbackEl.textContent = errors[field]
              feedbackEl.style.display = "block"
            }
          }
        }
      }
    }

    // Add Address Form Submission
    if (saveAddressBtn && addAddressForm) {
      saveAddressBtn.addEventListener("click", () => {
        const formData = new FormData(addAddressForm)
        const data = {}

        formData.forEach((value, key) => {
          data[key] = value
        })

        fetch("/account/addresses/add", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        })
          .then((response) => response.json())
          .then((result) => {
            if (result.success) {
              showToast(result.message, true)
              const modal = bootstrap.Modal.getInstance(document.getElementById("addAddressModal"))
              if (modal) modal.hide()

              // Reload page to show new address
              setTimeout(() => {
                window.location.reload()
              }, 1500)
            } else {
              if (result.errors) {
                displayErrors(addAddressForm, result.errors)
              } else {
                showToast(result.message || "Failed to add address", false)
              }
            }
          })
          .catch((error) => {
            console.error("Error:", error)
            showToast("An error occurred. Please try again.", false)
          })
      })
    }

    // Edit Address Form Submission
    if (updateAddressBtn && editAddressForm) {
      updateAddressBtn.addEventListener("click", () => {
        const formData = new FormData(editAddressForm)
        const data = {}

        formData.forEach((value, key) => {
          data[key] = value
        })

        fetch("/account/addresses/edit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        })
          .then((response) => response.json())
          .then((result) => {
            if (result.success) {
              showToast(result.message, true)
              const modal = bootstrap.Modal.getInstance(document.getElementById("editAddressModal"))
              if (modal) modal.hide()

              // Reload page to show updated address
              setTimeout(() => {
                window.location.reload()
              }, 1500)
            } else {
              if (result.errors) {
                displayErrors(editAddressForm, result.errors)
              } else {
                showToast(result.message || "Failed to update address", false)
              }
            }
          })
          .catch((error) => {
            console.error("Error:", error)
            showToast("An error occurred. Please try again.", false)
          })
      })
    }

    // Load address data for editing
    const editButtons = document.querySelectorAll('[data-bs-target="#editAddressModal"]')
    editButtons.forEach((button) => {
      button.addEventListener("click", function () {
        const addressId = this.getAttribute("data-address-id")
        document.getElementById("editAddressId").value = addressId

        // Fetch address data
        fetch(`/account/addresses/edit/${addressId}`)
          .then((response) => response.json())
          .then((data) => {
            // Populate form fields
            document.getElementById("editName").value = data.name || ""
            document.getElementById("editMobile").value = data.mobile || ""
            document.getElementById("editAddress").value = data.address || ""
            document.getElementById("editPincode").value = data.pincode || ""
            document.getElementById("editCity").value = data.city || ""
            document.getElementById("editState").value = data.state || ""
            document.getElementById("editIsDefault").checked = data.isDefault || false
          })
          .catch((error) => {
            console.error("Error fetching address data:", error)
            showToast("Failed to load address data", false)
          })
      })
    })
  }
})
