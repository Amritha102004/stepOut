document.addEventListener("DOMContentLoaded", () => {
  // Toggle password visibility
  const togglePasswordButtons = document.querySelectorAll(".password-toggle")
  if (togglePasswordButtons) {
    togglePasswordButtons.forEach((button) => {
      button.addEventListener("click", function () {
        const input = this.previousElementSibling
        const type = input.getAttribute("type") === "password" ? "text" : "password"
        input.setAttribute("type", type)

        // Change icon
        const icon = this.querySelector("i")
        if (icon) {
          if (type === "text") {
            icon.classList.remove("fa-eye")
            icon.classList.add("fa-eye-slash")
          } else {
            icon.classList.remove("fa-eye-slash")
            icon.classList.add("fa-eye")
          }
        }
      })
    })
  }

  // OTP input handling
  const otpInputs = document.querySelectorAll(".otp-input")
  if (otpInputs.length) {
    otpInputs.forEach((input, index) => {
      input.addEventListener("keyup", (e) => {
        if (e.key >= "0" && e.key <= "9") {
          // Move to next input
          if (index < otpInputs.length - 1) {
            otpInputs[index + 1].focus()
          }
        } else if (e.key === "Backspace") {
          // Move to previous input
          if (index > 0) {
            otpInputs[index - 1].focus()
          }
        }
      })

      input.addEventListener("click", function () {
        this.select()
      })
    })
  }

  // Profile image preview
  const profileImageInput = document.getElementById("profileImageInput")
  const profileImagePreview = document.getElementById("profileImage")

  if (profileImageInput && profileImagePreview) {
    profileImageInput.addEventListener("change", function () {
      const file = this.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          profileImagePreview.src = e.target.result
        }
        reader.readAsDataURL(file)
      }
    })
  }

  // Address type radio buttons
  const addressTypeRadios = document.querySelectorAll('input[name="addressType"]')
  if (addressTypeRadios.length) {
    addressTypeRadios.forEach((radio) => {
      radio.addEventListener("change", function () {
        document.querySelectorAll(".address-type-label").forEach((label) => {
          label.classList.remove("active")
        })

        if (this.checked) {
          this.parentElement.classList.add("active")
        }
      })
    })
  }

  // Email verification
  const verifyEmailBtn = document.getElementById("verifyEmailBtn")
  if (verifyEmailBtn) {
    verifyEmailBtn.addEventListener("click", () => {
      // Show verification modal or redirect to verification page
      const emailVerificationModalElement = document.getElementById("emailVerificationModal")
      if (emailVerificationModalElement) {
        const verificationModal = new bootstrap.Modal(emailVerificationModalElement)
        verificationModal.show()
      }
    })
  }

  // Cancel order confirmation
  const cancelOrderBtns = document.querySelectorAll(".cancel-order-btn")
  if (cancelOrderBtns.length) {
    cancelOrderBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault()
        if (confirm("Are you sure you want to cancel this order?")) {
          // Proceed with order cancellation
          alert("Order cancelled successfully!")
        }
      })
    })
  }
})
