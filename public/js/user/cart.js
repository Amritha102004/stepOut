document.addEventListener("DOMContentLoaded", () => {
  // Initialize cart functionality
  initializeQuantityControls()
  initializeRemoveButtons()
  initializeClearCartButton()
  initializeCouponSection()
  initializeCheckoutButton()

  // Calculate and update totals on page load
  updateCartTotals()
})

// Handle quantity increment/decrement
function initializeQuantityControls() {
  const quantityControls = document.querySelectorAll(".quantity-controls")

  quantityControls.forEach((control) => {
    const minusBtn = control.querySelector(".quantity-btn.minus")
    const plusBtn = control.querySelector(".quantity-btn.plus")
    const input = control.querySelector(".quantity-input")
    const cartItem = control.closest(".cart-item")

    // Minus button
    minusBtn.addEventListener("click", () => {
      const currentValue = Number.parseInt(input.value)
      const minValue = Number.parseInt(input.min)

      if (currentValue > minValue) {
        const newValue = currentValue - 1
        input.value = newValue
        updateItemTotal(cartItem)
        updateCartTotals()
        updateCartOnServer(cartItem, newValue)
      }
    })

    // Plus button
    plusBtn.addEventListener("click", () => {
      const currentValue = Number.parseInt(input.value)
      const maxValue = Number.parseInt(input.max)

      if (currentValue < maxValue) {
        const newValue = currentValue + 1
        input.value = newValue
        updateItemTotal(cartItem)
        updateCartTotals()
        updateCartOnServer(cartItem, newValue)
      } else {
        showToast("Maximum quantity reached for this item", "error")
      }
    })

    // Direct input change
    input.addEventListener("change", () => {
      const value = Number.parseInt(input.value)
      const minValue = Number.parseInt(input.min)
      const maxValue = Number.parseInt(input.max)

      if (value < minValue) {
        input.value = minValue
      } else if (value > maxValue) {
        input.value = maxValue
        showToast("Maximum quantity reached for this item", "error")
      }

      updateItemTotal(cartItem)
      updateCartTotals()
      updateCartOnServer(cartItem, Number.parseInt(input.value))
    })
  })
}

// Handle removing items from cart
function initializeRemoveButtons() {
  const removeButtons = document.querySelectorAll(".btn-remove")

  removeButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const cartItem = this.closest(".cart-item")
      const productId = cartItem.getAttribute("data-product-id")
      const size = cartItem.getAttribute("data-size")

      // Animate removal
      cartItem.style.opacity = "0"
      cartItem.style.transform = "translateX(-100%)"

      setTimeout(() => {
        cartItem.remove()
        updateCartTotals()
        updateCartCount()

        // Check if cart is empty
        const remainingItems = document.querySelectorAll(".cart-item")
        if (remainingItems.length === 0) {
          showEmptyCartState()
        }

        showToast("Item removed from cart")
      }, 300)

      // Remove item from server
      removeItemFromServer(productId, size)
    })
  })
}

// Handle clearing entire cart
function initializeClearCartButton() {
  const clearButton = document.getElementById("clearCart")

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      // Clear cart on server
      fetch("/cart/clear", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            // Animate all items removal
            const cartItems = document.querySelectorAll(".cart-item")
            cartItems.forEach((item, index) => {
              setTimeout(() => {
                item.style.opacity = "0"
                item.style.transform = "scale(0.8)"
              }, index * 100)
            })

            setTimeout(
              () => {
                showEmptyCartState()
                showToast("Cart cleared successfully")
              },
              cartItems.length * 100 + 300,
            )
          } else {
            showToast(data.message || "Failed to clear cart", "error")
          }
        })
        .catch((error) => {
          console.error("Error clearing cart:", error)
          showToast("Failed to clear cart", "error")
        })
    })
  }
}

// Handle coupon application
function initializeCouponSection() {
  const applyCouponBtn = document.getElementById("applyCoupon")
  const couponInput = document.getElementById("couponCode")

  if (applyCouponBtn && couponInput) {
    applyCouponBtn.addEventListener("click", () => {
      const couponCode = couponInput.value.trim()

      if (!couponCode) {
        showToast("Please enter a coupon code", "error")
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
          showToast("Coupon applied successfully!")
        } else if (couponCode.toUpperCase() === "FLAT50") {
          applyCoupon(50, true) // ₹50 flat discount
          showToast("Coupon applied successfully!")
        } else {
          showToast("Invalid coupon code", "error")
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

// Handle checkout button
function initializeCheckoutButton() {
  const checkoutBtn = document.getElementById("proceedCheckout")

  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", () => {
      // Check for out-of-stock items
      const outOfStockItems = document.querySelectorAll(".stock-status.out-of-stock")

      if (outOfStockItems.length > 0) {
        showToast("Please remove out-of-stock items before proceeding to checkout", "error")
        return
      }

      // Show loading state
      const originalText = checkoutBtn.innerHTML
      checkoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Processing...'
      checkoutBtn.disabled = true

      // Simulate processing
      setTimeout(() => {
        // In a real app, you would redirect to checkout page
        window.location.href = "/checkout"

        // Reset button for demo
        checkoutBtn.innerHTML = originalText
        checkoutBtn.disabled = false
      }, 2000)
    })
  }
}

// Update individual item total
function updateItemTotal(cartItem) {
  const quantity = Number.parseInt(cartItem.querySelector(".quantity-input").value)
  const priceElement = cartItem.querySelector(".item-price")
  const totalElement = cartItem.querySelector(".item-total")

  if (priceElement && totalElement) {
    const price = Number.parseFloat(priceElement.textContent)
    const total = price * quantity
    totalElement.textContent = total.toFixed(0)
  }
}

// Update cart totals
function updateCartTotals() {
  const cartItems = document.querySelectorAll(".cart-item")
  let subtotal = 0
  let itemCount = 0

  cartItems.forEach((item) => {
    const totalElement = item.querySelector(".item-total")
    const quantity = Number.parseInt(item.querySelector(".quantity-input").value)

    if (totalElement) {
      subtotal += Number.parseFloat(totalElement.textContent)
      itemCount += quantity
    }
  })

  // Update summary
  const subtotalElement = document.getElementById("summary-subtotal")
  const itemsElement = document.getElementById("summary-items")
  const taxElement = document.getElementById("summary-tax")
  const totalElement = document.getElementById("summary-total")

  if (subtotalElement) subtotalElement.textContent = subtotal.toFixed(0)
  if (itemsElement) itemsElement.textContent = itemCount

  // Calculate tax (18% GST)
  const tax = subtotal * 0.18
  if (taxElement) taxElement.textContent = tax.toFixed(0)

  // Calculate total
  const discountAmount = Number.parseFloat(document.getElementById("discount-amount")?.textContent || "0")
  const total = subtotal + tax - discountAmount

  if (totalElement) totalElement.textContent = total.toFixed(0)
}

// Update cart count in header
function updateCartCount() {
  fetch("/cart/count")
    .then((response) => response.json())
    .then((data) => {
      const cartCountElement = document.querySelector(".cart-count")
      if (cartCountElement) {
        cartCountElement.textContent = data.cartItemCount
      }
    })
    .catch((error) => {
      console.error("Error updating cart count:", error)
    })
}

// Apply coupon discount
function applyCoupon(discount, isFlat = false) {
  const subtotal = Number.parseFloat(document.getElementById("summary-subtotal").textContent)
  let discountAmount = 0

  if (isFlat) {
    discountAmount = discount
  } else {
    discountAmount = (subtotal * discount) / 100
  }

  // Show discount section
  const couponDiscountElement = document.getElementById("couponDiscount")
  const discountAmountElement = document.getElementById("discount-amount")

  if (couponDiscountElement && discountAmountElement) {
    discountAmountElement.textContent = discountAmount.toFixed(0)
    couponDiscountElement.style.display = "flex"
  }

  // Update totals
  updateCartTotals()
}

// Show empty cart state
function showEmptyCartState() {
  const cartSection = document.querySelector(".cart-section .container")

  // Keep the header
  const newContent = document.createElement("div")
  newContent.innerHTML = `
    <div class="empty-cart">
      <div class="empty-cart-content">
        <div class="empty-cart-icon">
          <i class="fas fa-shopping-cart"></i>
        </div>
        <h2>Your cart is empty</h2>
        <p>Looks like you haven't added anything to your cart yet. Start shopping to fill it up!</p>
        <a href="/shop" class="btn btn-primary btn-lg mt-3">
          <i class="fas fa-shopping-bag me-2"></i> Start Shopping
        </a>
        
        <div class="quick-links mt-4">
          <h5>You might be interested in:</h5>
          <div class="quick-link-buttons">
            <a href="/shop" class="btn btn-outline-secondary btn-sm">
              <i class="fas fa-shopping-bag me-1"></i> Continue Shopping
            </a>
          </div>
        </div>
      </div>
    </div>
  `

  // Remove everything except the header
  Array.from(cartSection.children).forEach((child) => {
    if (!child.classList.contains("cart-header")) {
      child.remove()
    }
  })

  // Add the empty state
  cartSection.appendChild(newContent.firstElementChild)
}

// Server communication functions
function updateCartOnServer(cartItem, quantity) {
  const productId = cartItem.getAttribute("data-product-id")
  const size = cartItem.getAttribute("data-size")

  fetch("/cart/update", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      productId: productId,
      size: size,
      quantity: quantity,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (!data.success) {
        showToast(data.message || "Failed to update cart", "error")
        // Reload page to sync with server state
        location.reload()
      }
    })
    .catch((error) => {
      console.error("Error:", error)
      showToast("An error occurred", "error")
    })
}

function removeItemFromServer(productId, size) {
  fetch(`/cart/remove/${productId}/${size}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((response) => response.json())
    .then((data) => {
      if (!data.success) {
        showToast(data.message || "Failed to remove item", "error")
      }
    })
    .catch((error) => {
      console.error("Error:", error)
      showToast("An error occurred", "error")
    })
}

// Toast notification function
function showToast(message, type = "success") {
  let toastContainer = document.querySelector(".toast-container")

  if (!toastContainer) {
    toastContainer = document.createElement("div")
    toastContainer.className = "toast-container position-fixed bottom-0 end-0 p-3"
    document.body.appendChild(toastContainer)
  }

  const toastId = "toast-" + Date.now()
  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center text-white bg-${type === "success" ? "success" : "danger"}" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `

  toastContainer.insertAdjacentHTML("beforeend", toastHtml)

  const toastElement = document.getElementById(toastId)

  if (window.bootstrap) {
    const toast = new window.bootstrap.Toast(toastElement, {
      autohide: true,
      delay: 3000,
    })
    toast.show()
  }

  toastElement.addEventListener("hidden.bs.toast", () => {
    toastElement.remove()
  })
}
