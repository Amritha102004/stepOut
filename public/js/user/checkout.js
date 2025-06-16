document.addEventListener("DOMContentLoaded", () => {
  // Import Bootstrap and Razorpay
  const bootstrap = window.bootstrap
  const Razorpay = window.Razorpay

  // Initialize checkout functionality
  initializeAddressSelection()
  initializePaymentSelection()
  initializeCouponSection()
  initializePlaceOrderButton()
  initializeAddressModals()
  initializeWalletFeatures()

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

  // FIXED: Enhanced wallet features with STRICT full payment validation
  function initializeWalletFeatures() {
    loadWalletBalance()
    initializeWalletPaymentOptions()
    // REMOVED: Partial wallet payment initialization
  }

  // Load wallet balance
  function loadWalletBalance() {
    fetch("/account/wallet/balance")
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          const balance = data.balance
          document.getElementById("walletBalance").textContent = balance.toFixed(2)
          document.getElementById("walletBalanceDisplay").textContent = balance.toFixed(2)

          // FIXED: STRICT wallet payment validation - only allow if sufficient for FULL payment
          const finalTotal = Number.parseFloat(document.getElementById("finalTotal").textContent)
          const walletRadio = document.getElementById("wallet")
          const partialWalletRadio = document.getElementById("partial-wallet")

          if (balance < finalTotal) {
            // Disable wallet payment completely if insufficient balance
            walletRadio.disabled = true
            walletRadio.parentElement.style.opacity = "0.5"
            walletRadio.parentElement.style.pointerEvents = "none"

            // Update wallet payment description to show insufficient balance
            const walletDetails = walletRadio.parentElement.querySelector(".payment-details p")
            if (walletDetails) {
              walletDetails.innerHTML = `Pay using your wallet balance: ₹${balance.toFixed(2)} <span class="text-danger"><strong>(Insufficient for full payment)</strong></span>`
            }
          } else {
            // Enable wallet payment if sufficient balance
            walletRadio.disabled = false
            walletRadio.parentElement.style.opacity = "1"
            walletRadio.parentElement.style.pointerEvents = "auto"

            const walletDetails = walletRadio.parentElement.querySelector(".payment-details p")
            if (walletDetails) {
              walletDetails.innerHTML = `Pay using your wallet balance: ₹${balance.toFixed(2)} <span class="text-success"><strong>(Sufficient for full payment)</strong></span>`
            }
          }

          // FIXED: Disable partial wallet payment completely
          if (partialWalletRadio) {
            partialWalletRadio.disabled = true
            partialWalletRadio.parentElement.style.opacity = "0.5"
            partialWalletRadio.parentElement.style.pointerEvents = "none"

            const partialWalletDetails = partialWalletRadio.parentElement.querySelector(".payment-details p")
            if (partialWalletDetails) {
              partialWalletDetails.innerHTML = `<span class="text-muted"><strike>Use wallet balance + online payment</strike></span><br><small class="text-danger">Partial payments not supported</small>`
            }
          }
        }
      })
      .catch((error) => {
        console.error("Error loading wallet balance:", error)
      })
  }

  // FIXED: Initialize wallet payment options with strict validation
  function initializeWalletPaymentOptions() {
    const walletRadio = document.getElementById("wallet")
    const partialWalletRadio = document.getElementById("partial-wallet")
    const walletSection = document.getElementById("walletAmountSection")

    if (walletRadio) {
      walletRadio.addEventListener("change", function () {
        if (this.checked) {
          walletSection.style.display = "none"

          // FIXED: STRICT validation - only allow if sufficient balance for FULL payment
          const finalTotal = Number.parseFloat(document.getElementById("finalTotal").textContent)
          const walletBalance = Number.parseFloat(document.getElementById("walletBalance").textContent)

          if (walletBalance < finalTotal) {
            showToast(
              `Insufficient wallet balance for full payment. Required: ₹${finalTotal}, Available: ₹${walletBalance}`,
              false,
            )
            // Force switch to available payment method
            if (window.IS_COD_ENABLED) {
              document.getElementById("cod").checked = true
            } else {
              document.getElementById("online").checked = true
            }
            this.checked = false
            return
          }

          updatePriceDisplay()
        }
      })
    }

    // FIXED: Disable partial wallet payment completely
    if (partialWalletRadio) {
      partialWalletRadio.addEventListener("change", function () {
        showToast(
          "Partial wallet payments are not supported. Please use full wallet payment or other payment methods.",
          false,
        )
        // Force switch to available payment method
        if (window.IS_COD_ENABLED) {
          document.getElementById("cod").checked = true
        } else {
          document.getElementById("online").checked = true
        }
        this.checked = false
      })
    }

    // Hide wallet section when other payment methods are selected
    const otherPaymentRadios = document.querySelectorAll(
      'input[name="paymentMethod"]:not(#wallet):not(#partial-wallet)',
    )
    otherPaymentRadios.forEach((radio) => {
      radio.addEventListener("change", function () {
        if (this.checked) {
          walletSection.style.display = "none"
          updatePriceDisplay()
        }
      })
    })
  }

  // FIXED: Enhanced price display with strict wallet validation
  function updatePriceDisplay() {
    const selectedPayment = document.querySelector('input[name="paymentMethod"]:checked')
    const finalTotalElement = document.getElementById("finalTotal")
    const walletRow = document.getElementById("walletRow")
    const payRow = document.getElementById("payRow")
    const walletUsageElement = document.getElementById("walletUsageAmount")
    const amountToPayElement = document.getElementById("amountToPay")

    if (!selectedPayment || !finalTotalElement) return

    const totalAmount = Number.parseFloat(finalTotalElement.textContent)
    let walletUsage = 0
    let amountToPay = totalAmount

    if (selectedPayment.value === "wallet") {
      const walletBalance = Number.parseFloat(document.getElementById("walletBalance").textContent)

      // FIXED: For wallet payment, ONLY allow if sufficient balance for FULL payment
      if (walletBalance >= totalAmount) {
        walletUsage = totalAmount
        amountToPay = 0
      } else {
        // Insufficient balance - show error and switch to available payment method
        showToast(
          `Insufficient wallet balance for full payment. Required: ₹${totalAmount}, Available: ₹${walletBalance}`,
          false,
        )
        if (window.IS_COD_ENABLED) {
          document.getElementById("cod").checked = true
        } else {
          document.getElementById("online").checked = true
        }
        selectedPayment.checked = false
        walletRow.style.display = "none"
        payRow.style.display = "none"
        return
      }
    }
    // REMOVED: Partial wallet payment logic

    // Update display
    if (walletUsage > 0) {
      walletRow.style.display = "flex"
      walletUsageElement.textContent = walletUsage.toFixed(2)

      if (amountToPay > 0) {
        payRow.style.display = "flex"
        amountToPayElement.textContent = amountToPay.toFixed(2)
      } else {
        payRow.style.display = "none"
      }
    } else {
      walletRow.style.display = "none"
      payRow.style.display = "none"
    }
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

        // Check COD eligibility
        if (radio.value === "COD" && !window.IS_COD_ENABLED) {
          showToast("Cash on Delivery is not available for orders above ₹1000. Please choose another payment method.", false)
          // Switch to online payment
          document.getElementById("online").checked = true
          radio.checked = false
          return
        }

        updatePriceDisplay()

        // FIXED: Revalidate wallet balance when payment method changes
        if (radio.value === "wallet") {
          loadWalletBalance()
        }
      })
    })
  }

  // Initialize coupon section
  function initializeCouponSection() {
    const applyCouponBtn = document.getElementById("applyCoupon")
    const couponInput = document.getElementById("couponCode")
    const removeCouponBtn = document.getElementById("removeCoupon")
    const couponInfoContainer = document.getElementById("couponInfoContainer")
    const couponSuggestions = document.getElementById("couponSuggestions")

    // Handle coupon suggestion clicks
    if (couponSuggestions) {
      const couponBadges = couponSuggestions.querySelectorAll(".coupon-badge")
      couponBadges.forEach((badge) => {
        badge.addEventListener("click", () => {
          const couponCode = badge.getAttribute("data-code")
          if (couponInput) {
            couponInput.value = couponCode
            applyCouponBtn.click()
          }
        })
      })
    }

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

        // Validate coupon with server
        fetch("/checkout/validate-coupon", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code: couponCode }),
        })
          .then((response) => response.json())
          .then((result) => {
            // Reset button
            applyCouponBtn.textContent = originalText
            applyCouponBtn.disabled = false

            if (result.success) {
              // Apply coupon discount
              applyCoupon(result.coupon.discountAmount, result.coupon)

              // Show coupon info
              if (couponInfoContainer) {
                couponInfoContainer.style.display = "block"
                const couponInfo = couponInfoContainer.querySelector(".coupon-info")
                if (couponInfo) {
                  let discountText = ""
                  if (result.coupon.discountType === "percentage") {
                    discountText = `${result.coupon.discountValue}% off`
                    if (result.coupon.maxDiscountValue) {
                      discountText += ` (max ₹${result.coupon.maxDiscountValue})`
                    }
                  } else {
                    discountText = `₹${result.coupon.discountValue} off`
                  }

                  couponInfo.innerHTML = `
                    <div class="coupon-applied">
                      <span class="coupon-code">${result.coupon.code}</span>
                      <span class="coupon-discount">${discountText}</span>
                    </div>
                    <div class="coupon-description">${result.coupon.description || ""}</div>
                  `
                }

                // Show remove button
                if (removeCouponBtn) {
                  removeCouponBtn.style.display = "block"
                }

                // Hide input and apply button
                couponInput.style.display = "none"
                applyCouponBtn.style.display = "none"
              }

              showToast("Coupon applied successfully!", true)

              // If there are product restrictions, show applicable products
              if (result.applicableProducts && result.applicableProducts.length > 0) {
                const applicableProductsContainer = document.getElementById("applicableProductsContainer")
                if (applicableProductsContainer) {
                  applicableProductsContainer.style.display = "block"
                  const productsList = applicableProductsContainer.querySelector(".applicable-products-list")
                  if (productsList) {
                    productsList.innerHTML = result.applicableProducts
                      .map((product) => `<li>${product.name} (₹${product.price} × ${product.quantity})</li>`)
                      .join("")
                  }
                }
              }

              // Update price display after coupon application
              updatePriceDisplay()
              // FIXED: Revalidate wallet balance after coupon application
              loadWalletBalance()
            } else {
              showToast(result.message || "Invalid coupon code", false)
            }
          })
          .catch((error) => {
            console.error("Error validating coupon:", error)
            applyCouponBtn.textContent = originalText
            applyCouponBtn.disabled = false
          })
      })

      // Allow Enter key to apply coupon
      couponInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          applyCouponBtn.click()
        }
      })
    }

    // Handle remove coupon
    if (removeCouponBtn) {
      removeCouponBtn.addEventListener("click", () => {
        removeCoupon()
      })
    }
  }

  // Apply coupon discount
  function applyCoupon(discountAmount, couponData) {
    const finalTotalElement = document.getElementById("finalTotal")
    const discountRow = document.getElementById("discountRow")
    const discountAmountElement = document.getElementById("discountAmount")

    if (!finalTotalElement) return

    const currentTotal = Number.parseFloat(finalTotalElement.textContent)

    // Update discount display
    if (discountAmountElement && discountRow) {
      discountAmountElement.textContent = discountAmount.toFixed(0)
      discountRow.style.display = "flex"
    }

    // Update final total
    const newTotal = currentTotal - discountAmount
    finalTotalElement.textContent = newTotal.toFixed(0)

    // Store coupon data for order placement
    window.appliedCoupon = couponData
  }

  // Remove coupon
  function removeCoupon() {
    const finalTotalElement = document.getElementById("finalTotal")
    const discountRow = document.getElementById("discountRow")
    const discountAmountElement = document.getElementById("discountAmount")
    const couponInput = document.getElementById("couponCode")
    const applyCouponBtn = document.getElementById("applyCoupon")
    const removeCouponBtn = document.getElementById("removeCoupon")
    const couponInfoContainer = document.getElementById("couponInfoContainer")
    const applicableProductsContainer = document.getElementById("applicableProductsContainer")

    if (!finalTotalElement || !discountAmountElement) return

    const currentTotal = Number.parseFloat(finalTotalElement.textContent)
    const discountAmount = Number.parseFloat(discountAmountElement.textContent)

    // Restore original total
    const originalTotal = currentTotal + discountAmount
    finalTotalElement.textContent = originalTotal.toFixed(0)

    // Hide discount row
    if (discountRow) {
      discountRow.style.display = "none"
    }

    // Reset coupon input
    if (couponInput) {
      couponInput.value = ""
      couponInput.style.display = "block"
    }

    // Show apply button, hide remove button
    if (applyCouponBtn) {
      applyCouponBtn.style.display = "block"
    }
    if (removeCouponBtn) {
      removeCouponBtn.style.display = "none"
    }

    // Hide coupon info
    if (couponInfoContainer) {
      couponInfoContainer.style.display = "none"
    }

    // Hide applicable products
    if (applicableProductsContainer) {
      applicableProductsContainer.style.display = "none"
    }

    // Clear stored coupon data
    window.appliedCoupon = null

    // Update price display after coupon removal
    updatePriceDisplay()
    // FIXED: Revalidate wallet balance after coupon removal
    loadWalletBalance()

    showToast("Coupon removed successfully", true)
  }

  // FIXED: Enhanced place order button with STRICT wallet validation
  function initializePlaceOrderButton() {
    const placeOrderBtn = document.getElementById("placeOrderBtn")

    if (placeOrderBtn) {
      placeOrderBtn.addEventListener("click", () => {
        // Check if this is a retry payment
        const isRetry =
          document.body.hasAttribute("data-is-retry") && document.body.getAttribute("data-is-retry") === "true"

        console.log("Place order clicked - isRetry:", isRetry)

        // If it's a retry, process retry payment
        if (isRetry) {
          const retryRazorpayOrderId = document.body.getAttribute("data-retry-razorpay-order-id")
          const retryAmount = document.body.getAttribute("data-retry-amount")

          console.log("Retry data:", { retryRazorpayOrderId, retryAmount })

          if (!retryRazorpayOrderId) {
            showToast("Missing retry order information", false)
            return
          }

          // Validate address selection for retry
          const selectedAddress = document.querySelector('input[name="selectedAddress"]:checked')
          if (!selectedAddress) {
            showToast("Please select a delivery address", false)
            return
          }

          // Show loading state
          const originalText = placeOrderBtn.innerHTML
          placeOrderBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing Payment...'
          placeOrderBtn.disabled = true

          // Process retry payment directly with current cart
          processRetryPayment(
            {
              razorpayOrderId: retryRazorpayOrderId,
              addressId: selectedAddress.value,
              amount: retryAmount,
            },
            originalText,
          )

          return
        }

        // Regular checkout flow
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

        // FIXED: STRICT wallet payment validation
        if (selectedPayment.value === "wallet") {
          const finalTotal = Number.parseFloat(document.getElementById("finalTotal").textContent)
          const walletBalance = Number.parseFloat(document.getElementById("walletBalance").textContent)

          if (walletBalance < finalTotal) {
            showToast(
              `Insufficient wallet balance for full payment. Required: ₹${finalTotal}, Available: ₹${walletBalance}`,
              false,
            )
            return
          }
        }

        // FIXED: Block partial wallet payments
        if (selectedPayment.value === "partial-wallet") {
          showToast(
            "Partial wallet payments are not supported. Please use full wallet payment or other payment methods.",
            false,
          )
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
          couponCode: window.appliedCoupon ? window.appliedCoupon.code : null,
        }

        if (selectedPayment.value === "COD") {
          // Place COD order directly
          placeCODOrder(orderData, originalText)
        } else if (selectedPayment.value === "wallet") {
          // Place full wallet order
          placeWalletOrder(orderData, originalText)
        } else {
          // Process online payment with Razorpay
          processOnlinePayment(orderData, originalText)
        }
      })
    }
  }

  // Updated function to handle retry payments
  function processRetryPayment(retryData, originalButtonText) {
    const placeOrderBtn = document.getElementById("placeOrderBtn")

    console.log("Processing retry payment with data:", retryData)

    // Create a new Razorpay order for the retry
    fetch("/checkout/create-razorpay-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        addressId: retryData.addressId,
        // Don't include isRetry flag - let it create a new order with current cart
      }),
    })
      .then((response) => response.json())
      .then((result) => {
        if (result.success) {
          // Initialize Razorpay payment
          const orderData = {
            addressId: retryData.addressId,
          }
          initializeRazorpayPayment(result, orderData, originalButtonText)
        } else {
          showToast(result.message || "Failed to create payment order", false)
          // Reset button
          placeOrderBtn.innerHTML = originalButtonText
          placeOrderBtn.disabled = false
        }
      })
      .catch((error) => {
        console.error("Error creating Razorpay order:", error)
        showToast("An error occurred while creating payment order", false)
        // Reset button
        placeOrderBtn.innerHTML = originalButtonText
        placeOrderBtn.disabled = false
      })
  }

  // Place COD order
  function placeCODOrder(orderData, originalButtonText) {
    const placeOrderBtn = document.getElementById("placeOrderBtn")

    // Client-side validation for COD
    if (!window.IS_COD_ENABLED) {
      showToast("Cash on Delivery is not available for orders above ₹1000. Please choose another payment method.", false)
      placeOrderBtn.innerHTML = originalButtonText
      placeOrderBtn.disabled = false
      // Switch to online payment
      document.getElementById("online").checked = true
      return
    }

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
          placeOrderBtn.innerHTML = originalButtonText
          placeOrderBtn.disabled = false
        }
      })
      .catch((error) => {
        console.error("Error placing order:", error)
        showToast("An error occurred while placing the order", false)
        // Reset button
        placeOrderBtn.innerHTML = originalButtonText
        placeOrderBtn.disabled = false
      })
  }

  // FIXED: Enhanced wallet order placement with strict validation
  function placeWalletOrder(orderData, originalButtonText) {
    const placeOrderBtn = document.getElementById("placeOrderBtn")

    fetch("/checkout/create-order-with-wallet", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...orderData,
        useWalletAmount: Number.parseFloat(document.getElementById("finalTotal").textContent),
      }),
    })
      .then((response) => response.json())
      .then((result) => {
        if (result.success) {
          // Redirect to order success page
          window.location.href = `/order-success?orderId=${result.orderId}`
        } else {
          showToast(result.message || "Failed to place order", false)
          // Reset button
          placeOrderBtn.innerHTML = originalButtonText
          placeOrderBtn.disabled = false
        }
      })
      .catch((error) => {
        console.error("Error placing wallet order:", error)
        showToast("An error occurred while placing the order", false)
        // Reset button
        placeOrderBtn.innerHTML = originalButtonText
        placeOrderBtn.disabled = false
      })
  }

  // Process online payment with Razorpay
  function processOnlinePayment(orderData, originalButtonText) {
    const placeOrderBtn = document.getElementById("placeOrderBtn")

    // First create Razorpay order
    fetch("/checkout/create-razorpay-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderData),
    })
      .then((response) => response.json())
      .then((result) => {
        if (result.success) {
          // Initialize Razorpay payment
          initializeRazorpayPayment(result, orderData, originalButtonText)
        } else {
          showToast(result.message || "Failed to create payment order", false)
          // Reset button
          placeOrderBtn.innerHTML = originalButtonText
          placeOrderBtn.disabled = false
        }
      })
      .catch((error) => {
        console.error("Error creating Razorpay order:", error)
        showToast("An error occurred while creating payment order", false)
        // Reset button
        placeOrderBtn.innerHTML = originalButtonText
        placeOrderBtn.disabled = false
      })
  }

  // Initialize Razorpay payment
  function initializeRazorpayPayment(paymentData, orderData, originalButtonText) {
    const placeOrderBtn = document.getElementById("placeOrderBtn")

    const options = {
      key: window.RAZORPAY_KEY_ID,
      amount: paymentData.amount * 100, // Amount in paise
      currency: paymentData.currency,
      name: "StepOut",
      description: "Order Payment",
      order_id: paymentData.orderId,
      handler: (response) => {
        // Payment successful, verify and place order
        verifyPaymentAndPlaceOrder(response, orderData)
      },
      prefill: {
        name: "Customer Name",
        email: "customer@example.com",
        contact: "9999999999",
      },
      theme: {
        color: "#009688",
      },
      modal: {
        ondismiss: () => {
          // Payment cancelled by user
          showToast("Payment cancelled", false)
          // Reset button
          placeOrderBtn.innerHTML = originalButtonText
          placeOrderBtn.disabled = false
        },
      },
    }

    const rzp = new Razorpay(options)

    // Update the payment failure handling to store the orderID
    rzp.on("payment.failed", (response) => {
      // Payment failed
      console.error("Payment failed:", response.error)

      // Send failure data to server for logging
      fetch("/checkout/payment-failure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          error: response.error,
          orderId: paymentData.orderId, // This is the Razorpay order ID
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          // Redirect to payment failure page with Razorpay order ID
          const errorData = {
            code: response.error.code,
            description: response.error.description,
            source: response.error.source,
            step: response.error.step,
            reason: response.error.reason,
          }

          // Use the Razorpay order ID for retry
          window.location.href = `/payment-failure?orderId=${paymentData.orderId}&error=${encodeURIComponent(JSON.stringify(errorData))}`
        })
        .catch((err) => {
          console.error("Error handling payment failure:", err)
          window.location.href = `/payment-failure?orderId=${paymentData.orderId}&error=${encodeURIComponent(JSON.stringify(response.error))}`
        })
    })

    // Reset button text before opening Razorpay
    placeOrderBtn.innerHTML = originalButtonText
    placeOrderBtn.disabled = false

    // Open Razorpay checkout
    rzp.open()
  }

  // Verify payment and place order
  function verifyPaymentAndPlaceOrder(paymentResponse, orderData) {
    const placeOrderBtn = document.getElementById("placeOrderBtn")

    // Show processing state
    placeOrderBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Verifying Payment...'
    placeOrderBtn.disabled = true

    const verificationData = {
      razorpay_order_id: paymentResponse.razorpay_order_id,
      razorpay_payment_id: paymentResponse.razorpay_payment_id,
      razorpay_signature: paymentResponse.razorpay_signature,
      addressId: orderData.addressId,
      couponCode: orderData.couponCode,
    }

    fetch("/checkout/verify-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(verificationData),
    })
      .then((response) => response.json())
      .then((result) => {
        if (result.success) {
          // Redirect to order success page
          window.location.href = `/order-success?orderId=${result.orderId}`
        } else {
          showToast(result.message || "Payment verification failed", false)
          // Reset button
          placeOrderBtn.innerHTML = '<i class="fas fa-lock me-2"></i>Place Order'
          placeOrderBtn.disabled = false
        }
      })
      .catch((error) => {
        console.error("Error verifying payment:", error)
        showToast("Payment verification failed. Please contact support.", false)
        // Reset button
        placeOrderBtn.innerHTML = '<i class="fas fa-lock me-2"></i>Place Order'
        placeOrderBtn.disabled = false
      })
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

// Add document ready check for retry payment
document.addEventListener("DOMContentLoaded", () => {
  // Check if this is a retry payment
  const isRetry = document.body.hasAttribute("data-is-retry") && document.body.getAttribute("data-is-retry") === "true"

  console.log("Document ready - isRetry:", isRetry)

  if (isRetry) {
    // Auto-select online payment method for retry
    const onlinePaymentRadio = document.getElementById("online")
    if (onlinePaymentRadio) {
      onlinePaymentRadio.checked = true
      console.log("Auto-selected online payment for retry")
    }

    // Disable other payment methods for retry
    const paymentRadios = document.querySelectorAll(".payment-radio:not(#online)")
    paymentRadios.forEach((radio) => {
      radio.disabled = true
      radio.parentElement.style.opacity = "0.5"
      radio.parentElement.style.pointerEvents = "none"
    })

    // Add retry notice
    const paymentSection = document.querySelector(".payment-methods")
    if (paymentSection) {
      const retryNotice = document.createElement("div")
      retryNotice.className = "alert alert-info mt-3"
      retryNotice.innerHTML =
        '<i class="fas fa-info-circle me-2"></i>You are retrying a failed payment. Please complete the payment to place your order.'
      paymentSection.appendChild(retryNotice)
    }

    // Update place order button text
    const placeOrderBtn = document.getElementById("placeOrderBtn")
    if (placeOrderBtn) {
      placeOrderBtn.innerHTML = '<i class="fas fa-redo me-2"></i>Retry Payment'
      console.log("Updated button text for retry")
    }
  }
})
