// Sidebar toggle functionality
document.addEventListener("DOMContentLoaded", () => {
    // Toggle sidebar on mobile
    const toggleBtn = document.querySelector(".toggle-sidebar")
    const sidebar = document.querySelector(".sidebar")
  
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation()
        sidebar.classList.toggle("active")
  
        // Create or toggle overlay
        let overlay = document.querySelector(".sidebar-overlay")
        if (!overlay) {
          overlay = document.createElement("div")
          overlay.className = "sidebar-overlay"
          document.body.appendChild(overlay)
        }
  
        overlay.classList.toggle("active")
  
        // Close sidebar when clicking on overlay
        overlay.addEventListener("click", () => {
          sidebar.classList.remove("active")
          overlay.classList.remove("active")
        })
      })
    }
  
    // Close sidebar when clicking outside on mobile
    document.addEventListener("click", (event) => {
      if (window.innerWidth <= 575) {
        if (sidebar && !sidebar.contains(event.target) && !toggleBtn.contains(event.target)) {
          sidebar.classList.remove("active")
  
          const overlay = document.querySelector(".sidebar-overlay")
          if (overlay) {
            overlay.classList.remove("active")
          }
        }
      }
    })
  })
  