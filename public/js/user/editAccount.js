document.addEventListener("DOMContentLoaded", () => {
  // Profile image upload functionality
  const profileImageInput = document.getElementById("profileImageInput");
  const profileImage = document.getElementById("profileImage");
  const chooseImageBtn = document.getElementById("chooseImageBtn");
  
  if (profileImageInput && profileImage && chooseImageBtn) {
    // Trigger file input when button is clicked
    chooseImageBtn.addEventListener("click", () => {
      profileImageInput.click();
    });
    
    // Handle image preview when file is selected
    profileImageInput.addEventListener("change", function() {
      const file = this.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          profileImage.src = e.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }
  
  // Password toggle functionality
  const togglePasswordButtons = document.querySelectorAll(".password-toggle");
  if (togglePasswordButtons) {
    togglePasswordButtons.forEach((button) => {
      button.addEventListener("click", function() {
        const input = this.previousElementSibling;
        const type = input.getAttribute("type") === "password" ? "text" : "password";
        input.setAttribute("type", type);
        
        // Change icon
        const icon = this.querySelector("i");
        if (icon) {
          if (type === "text") {
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
          } else {
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
          }
        }
      });
    });
  }
  
  // Form validation for password change
  // const passwordForm = document.getElementById("passwordForm");
  // if (passwordForm) {
  //   passwordForm.addEventListener("submit", function(e) {
  //     const newPassword = document.getElementById("newPassword").value;
  //     const confirmPassword = document.getElementById("confirmPassword").value;
      
  //     if (newPassword !== confirmPassword) {
  //       e.preventDefault();
  //       alert("New password and confirm password do not match!");
  //     }
  //   });
  // }
});