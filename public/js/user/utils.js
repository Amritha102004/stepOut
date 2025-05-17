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

// Export functions
window.showToast = showToast;
window.updateWishlistIcon = updateWishlistIcon;