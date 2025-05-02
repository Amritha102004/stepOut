// Common JavaScript functions for all pages
document.addEventListener('DOMContentLoaded', function() {
    // Header search functionality
    initializeHeaderSearch();
    
    // Fix shop page search if it exists
    fixShopPageSearch();
    
    // Initialize Bootstrap components
    initializeBootstrapComponents();
    
    // Initialize wishlist functionality
    initializeWishlistIcons();
});

// Toggle header search bar
function initializeHeaderSearch() {
    const searchIcon = document.getElementById('search-icon');
    const searchContainer = document.querySelector('.navbar .search-container');
    const searchInput = document.querySelector('.navbar .search-input');
    
    if (searchIcon && searchContainer && searchInput) {
        searchIcon.addEventListener('click', function(e) {
            e.preventDefault();
            searchContainer.classList.toggle('active');
            if (searchContainer.classList.contains('active')) {
                searchInput.focus();
            }
        });
        
        // Close search when clicking outside
        document.addEventListener('click', function(e) {
            if (searchContainer && !searchContainer.contains(e.target) && searchContainer.classList.contains('active')) {
                searchContainer.classList.remove('active');
            }
        });
    }
}

// Make sure the shop page search doesn't get affected by header search
function fixShopPageSearch() {
    const shopSearchInput = document.querySelector('.search-filter-section #searchInput');
    if (shopSearchInput) {
        // Ensure shop search is always visible and not affected by header search toggle
        shopSearchInput.style.opacity = '1';
        shopSearchInput.style.position = 'static';
    }
}

// Initialize Bootstrap components
function initializeBootstrapComponents() {
    // Initialize all tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    if (typeof bootstrap !== 'undefined') {
        const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl)
        })
        
        // Initialize all popovers
        const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
        const popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
            return new bootstrap.Popover(popoverTriggerEl)
        })
    }
}

// Add to wishlist functionality
function initializeWishlistIcons() {
    const wishlistIcons = document.querySelectorAll('.wishlist-icon');
    if (wishlistIcons.length > 0) {
        wishlistIcons.forEach(icon => {
            icon.addEventListener('click', function() {
                const heartIcon = this.querySelector('i');
                heartIcon.classList.toggle('far');
                heartIcon.classList.toggle('fas');
                heartIcon.classList.toggle('text-danger');
            });
        });
    }
}

// Handle image loading errors
function handleImageErrors() {
    const productImages = document.querySelectorAll('.product-image, #mainProductImage, .thumbnail img');
    
    productImages.forEach(img => {
        img.addEventListener('error', function() {
            // Replace with placeholder image if loading fails
            this.src = '/placeholder.svg?height=250&width=250&query=product%20image%20not%20found';
            this.classList.add('error-image');
        });
    });
}

// Add to existing DOMContentLoaded event
document.addEventListener('DOMContentLoaded', function() {
    // Existing code...
    
    // Declare variables to avoid errors
    let initializeHeaderSearch;
    let fixShopPageSearch;
    let initializeBootstrapComponents;
    let initializeWishlistIcons;

    // Initialize header search functionality
    if (typeof initializeHeaderSearch === 'function') {
        initializeHeaderSearch();
    }
    
    // Fix shop page search if it exists
    if (typeof fixShopPageSearch === 'function') {
        fixShopPageSearch();
    }
    
    // Initialize Bootstrap components
    if (typeof initializeBootstrapComponents === 'function') {
        initializeBootstrapComponents();
    }
    
    // Initialize wishlist functionality
    if (typeof initializeWishlistIcons === 'function') {
        initializeWishlistIcons();
    }
    
    // Handle image errors
    handleImageErrors();
});