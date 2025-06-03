// Wallet page JavaScript
// Import bootstrap
const bootstrap = window.bootstrap

// Show add money modal
function showAddMoneyModal() {
  const modal = new bootstrap.Modal(document.getElementById("addMoneyModal"))
  modal.show()
}

// Set quick amount
function setAmount(amount) {
  document.getElementById("amount").value = amount
}

// Add money to wallet
async function addMoney() {
  const amount = document.getElementById("amount").value

  if (!amount || amount <= 0 || amount > 50000) {
    showToast("Please enter a valid amount between ₹1 and ₹50,000", "error")
    return
  }

  try {
    const response = await fetch("/account/wallet/add-money", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: Number.parseFloat(amount) }),
    })

    const data = await response.json()

    if (data.success) {
      showToast(data.message, "success")
      // Close modal
      const modal = bootstrap.Modal.getInstance(document.getElementById("addMoneyModal"))
      modal.hide()
      // Reload page to show updated balance
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } else {
      showToast(data.message, "error")
    }
  } catch (error) {
    console.error("Error adding money:", error)
    showToast("Failed to add money. Please try again.", "error")
  }
}

// Show toast notification
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
  let toastContainer = document.querySelector(".toast-container")
  if (!toastContainer) {
    toastContainer = document.createElement("div")
    toastContainer.className = "toast-container position-fixed top-0 end-0 p-3"
    document.body.appendChild(toastContainer)
  }

  toastContainer.insertAdjacentHTML("beforeend", toastHtml)

  // Show toast
  const toastElement = toastContainer.lastElementChild
  const toast = new bootstrap.Toast(toastElement)
  toast.show()

  // Remove toast element after it's hidden
  toastElement.addEventListener("hidden.bs.toast", () => {
    toastElement.remove()
  })
}

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount)
}

// Initialize page
document.addEventListener("DOMContentLoaded", () => {
  // Add event listener for add money form
  const addMoneyForm = document.getElementById("addMoneyForm")
  if (addMoneyForm) {
    addMoneyForm.addEventListener("submit", (e) => {
      e.preventDefault()
      addMoney()
    })
  }

  // Add event listener for amount input
  const amountInput = document.getElementById("amount")
  if (amountInput) {
    amountInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault()
        addMoney()
      }
    })
  }
})
