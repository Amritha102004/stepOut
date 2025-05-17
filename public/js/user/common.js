// Common JavaScript functions for all pages
document.addEventListener('DOMContentLoaded', function() {

    initializeHeaderSearch();

    fixShopPageSearch();
 
    initializeBootstrapComponents();
 
    initializeWishlistIcons();
  
    checkWishlistStatusForProducts();
  
    handleImageErrors();
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
        shopSearchInput.style.opacity = '1';
        shopSearchInput.style.position = 'static';
    }
}

// Initialize Bootstrap components
function initializeBootstrapComponents() {
    // Initialize all tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const bootstrap = window.bootstrap; // Declare the bootstrap variable
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
            icon.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Get product ID from closest product card
                const productCard = this.closest('.product-card');
                const productLink = productCard.querySelector('a[href^="/product/"]');
                
                if (productLink) {
                    const href = productLink.getAttribute('href');
                    const productId = href.split('/').pop();
                    
                    toggleProductWishlist(productId, this);
                }
            });
        });
    }
}

// Toggle product in wishlist
function toggleProductWishlist(productId, buttonElement) {
    const heartIcon = buttonElement.querySelector('i');
    const isInWishlist = heartIcon.classList.contains('fas');
    
    if (isInWishlist) {
        // Remove from wishlist
        fetch(`/wishlist/remove/${productId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => {
            if (response.redirected) {
                // If redirected to login page
                window.location.href = response.url;
                return null;
            }
            return response.json();
        })
        .then(data => {
            if (!data) return; // Handle redirect case
            
            if (data.success) {
                updateWishlistIcon(heartIcon, false);
                showToast('Product removed from wishlist');
            } else {
                showToast(data.message || 'Failed to remove from wishlist', 'error');
            }
        })
        .catch(error => {
            console.error('Error removing from wishlist:', error);
            // Redirect to login if it's an authentication error
            window.location.href = '/login';
        });
    } else {
        // Add to wishlist
        fetch('/wishlist/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ productId })
        })
        .then(response => {
            if (response.redirected) {
                // If redirected to login page
                window.location.href = response.url;
                return null;
            }
            return response.json();
        })
        .then(data => {
            if (!data) return; // Handle redirect case
            
            if (data.success) {
                updateWishlistIcon(heartIcon, true);
                showToast('Product added to wishlist');
            } else {
                showToast(data.message || 'Failed to add to wishlist', 'error');
            }
        })
        .catch(error => {
            console.error('Error adding to wishlist:', error);
            // Redirect to login if it's an authentication error
            window.location.href = '/login';
        });
    }
}

// Update wishlist icon appearance
function updateWishlistIcon(heartIcon, isInWishlist) {
    if (isInWishlist) {
        heartIcon.classList.remove('far');
        heartIcon.classList.add('fas');
        heartIcon.classList.add('text-danger');
    } else {
        heartIcon.classList.remove('fas');
        heartIcon.classList.remove('text-danger');
        heartIcon.classList.add('far');
    }
}

// Toast notification function - Standardized across all files
function showToast(message, type = 'success') {
    // Check if toast container exists, if not create it
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toastId = 'toast-' + Date.now();
    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center text-white bg-${type === 'success' ? 'success' : 'danger'}" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    
    // Initialize and show the toast
    const toastElement = document.getElementById(toastId);
    
    // Check if Bootstrap is available
    if (window.bootstrap) {
        const toast = new window.bootstrap.Toast(toastElement, { autohide: true, delay: 3000 });
        toast.show();
    } else {
        // Fallback to alert if Bootstrap is not available
        alert(message);
    }
    
    // Remove toast after it's hidden
    toastElement.addEventListener('hidden.bs.toast', function() {
        toastElement.remove();
    });
}

// Function to check wishlist status for all products on page
function checkWishlistStatusForProducts() {
    // Get all product cards
    const productCards = document.querySelectorAll('.product-card');
    
    productCards.forEach(card => {
        const productLink = card.querySelector('a[href^="/product/"]');
        const wishlistIcon = card.querySelector('.wishlist-icon i');
        
        if (productLink && wishlistIcon) {
            const href = productLink.getAttribute('href');
            const productId = href.split('/').pop();
            
            // Check if product is in wishlist
            fetch(`/wishlist/check/${productId}`)
                .then(response => response.json())
                .then(data => {
                    updateWishlistIcon(wishlistIcon, data.inWishlist);
                })
                .catch(error => {
                    console.error('Error checking wishlist status:', error);
                });
        }
    });
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

// Toast notification function
function showToast(message, type = 'success') {
    // Check if toast container exists, if not create it
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toastId = 'toast-' + Date.now();
    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center text-white bg-${type === 'success' ? 'success' : 'danger'}" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    
    // Initialize and show the toast
    const toastElement = document.getElementById(toastId);
    const bootstrap = window.bootstrap; // Declare the bootstrap variable
    if (typeof bootstrap !== 'undefined') {
        const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 3000 });
        toast.show();
    }
    
    // Remove toast after it's hidden
    toastElement.addEventListener('hidden.bs.toast', function() {
        toastElement.remove();
    });
}