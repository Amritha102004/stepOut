document.addEventListener("DOMContentLoaded", () => {
  // Handle mobile sidebar toggle if needed
  const mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle');
  const profileSidebar = document.querySelector('.profile-sidebar');
  
  if (mobileSidebarToggle && profileSidebar) {
    mobileSidebarToggle.addEventListener('click', () => {
      profileSidebar.classList.toggle('mobile-visible');
    });
  }
  
  // Highlight current page in sidebar
  const currentPath = window.location.pathname;
  const sidebarLinks = document.querySelectorAll('.profile-nav a');
  
  sidebarLinks.forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('active');
    }
  });
});