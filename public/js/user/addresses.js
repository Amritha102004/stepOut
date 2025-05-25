document.addEventListener("DOMContentLoaded", () => {
  // Import Bootstrap
  const bootstrap = window.bootstrap

  // Get DOM elements
  const addAddressForm = document.getElementById("addAddressForm")
  const editAddressForm = document.getElementById("editAddressForm")
  const saveAddressBtn = document.getElementById("saveAddressBtn")
  const updateAddressBtn = document.getElementById("updateAddressBtn")
  const confirmDeleteBtn = document.getElementById("confirmDeleteBtn")

  // Toast container
  const toastContainer = document.getElementById("toast-container")

  // Function to show toast message
  function showToast(message, isSuccess) {
    console.log("Showing toast:", message, isSuccess) // Debug log

    // Create toast element
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

    // Initialize and show the toast
    const bsToast = new bootstrap.Toast(toast)
    bsToast.show()

    // Auto remove after 5 seconds
    setTimeout(() => {
      bsToast.hide()
      // Remove from DOM after hiding
      setTimeout(() => {
        toast.remove()
      }, 500)
    }, 5000)
  }

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

      // Send AJAX request
      fetch("/account/addresses/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })
        .then((response) => response.json())
        .then((result) => {
          console.log("Add address result:", result) // Debug log

          if (result.success) {
            showToast(result.message, true)
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById("addAddressModal"))
            if (modal) modal.hide()

            // Reload page after a delay
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

      // Send AJAX request
      fetch("/account/addresses/edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })
        .then((response) => response.json())
        .then((result) => {
          console.log("Edit address result:", result) // Debug log

          if (result.success) {
            showToast(result.message, true)
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById("editAddressModal"))
            if (modal) modal.hide()

            // Reload page after a delay
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

  // Delete Address
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", () => {
      const addressId = document.getElementById("deleteAddressId").value

      if (!addressId) {
        showToast("No address selected for deletion", false)
        return
      }

      // Send AJAX request
      fetch(`/account/addresses/delete/${addressId}`, {
        method: "DELETE",
      })
        .then((response) => response.json())
        .then((result) => {
          console.log("Delete address result:", result) // Debug log

          if (result.success) {
            showToast(result.message, true)
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById("deleteAddressModal"))
            if (modal) modal.hide()

            // Reload page after a delay
            setTimeout(() => {
              window.location.reload()
            }, 1500)
          } else {
            showToast(result.message || "Failed to delete address", false)
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

      console.log("Loading address data for ID:", addressId) // Debug log

      // Fetch address data - FIXED: Use the correct endpoint with params
      fetch(`/account/addresses/edit/${addressId}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`)
          }
          return response.json()
        })
        .then((data) => {
          console.log("Fetched address data:", data) // Debug log

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

          // Alternative method: Extract data from the card if API fails
          console.log("Falling back to extracting data from the card")
          const addressCard = this.closest(".address-card")
          if (addressCard) {
            try {
              // Extract data from the card
              const name = addressCard.querySelector(".card-title").textContent.trim()
              document.getElementById("editName").value = name

              // Extract mobile (remove all non-digit characters)
              const mobileText = addressCard.querySelector(".address-content p:first-child").textContent.trim()
              const mobile = mobileText.replace(/[^0-9]/g, "")
              document.getElementById("editMobile").value = mobile

              // Extract address parts
              const addressText = addressCard.querySelector(".address-content p:nth-child(2)").textContent.trim()

              // Parse the address text (format: "address, city, state - pincode")
              // First, remove the icon from the beginning
              const cleanAddressText = addressText
                .replace(/^\s*[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-./:;<=>?@[\]^_`{|}~]\s*/, "")
                .trim()

              // Split by commas and dash
              const parts = cleanAddressText.split(",").map((part) => part.trim())

              if (parts.length >= 3) {
                // First part is the address
                document.getElementById("editAddress").value = parts[0]

                // Second part is the city
                document.getElementById("editCity").value = parts[1]

                // Third part contains state and pincode (format: "state - pincode")
                const stateAndPincode = parts[2].split("-").map((part) => part.trim())

                if (stateAndPincode.length >= 2) {
                  document.getElementById("editState").value = stateAndPincode[0]
                  document.getElementById("editPincode").value = stateAndPincode[1]
                }
              }

              // Check if default
              const isDefault = addressCard.querySelector(".badge.bg-primary") !== null
              document.getElementById("editIsDefault").checked = isDefault

              console.log("Successfully extracted data from card")
            } catch (extractError) {
              console.error("Error extracting data from card:", extractError)
              showToast("Failed to load address data", false)
            }
          } else {
            showToast("Failed to load address data", false)
          }
        })
    })
  })

  // Set up delete buttons
  const deleteButtons = document.querySelectorAll('[data-bs-target="#deleteAddressModal"]')
  deleteButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const addressId = this.getAttribute("data-address-id")
      document.getElementById("deleteAddressId").value = addressId
    })
  })
})
