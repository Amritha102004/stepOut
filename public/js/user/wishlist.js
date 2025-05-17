document.addEventListener("DOMContentLoaded", () => {
  initializeRemoveButtons();
  initializeClearWishlistButton();
  initializeAddToCartButtons();
});

// Handle removing individual items from wishlist
function initializeRemoveButtons() {
    const removeButtons = document.querySelectorAll(".remove-btn");

    removeButtons.forEach((button) => {
        button.addEventListener("click", function () {
            const productId = this.getAttribute("data-product-id");
            const wishlistCard = this.closest(".col-lg-4");

            // Make AJAX call to remove the item from the wishlist
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
                    // Animate removal
                    wishlistCard.style.opacity = "0";
                    wishlistCard.style.transform = "scale(0.8)";

                    setTimeout(() => {
                        wishlistCard.remove();

                        // Check if wishlist is now empty
                        const remainingItems = document.querySelectorAll(".wishlist-card");
                        if (remainingItems.length === 0) {
                            // Replace with empty state
                            const wishlistSection = document.querySelector(".wishlist-items");
                            const clearButton = document.querySelector("#clearWishlist")?.parentElement;

                            // Create empty state
                            const emptyState = document.createElement("div");
                            emptyState.className = "empty-wishlist";
                            emptyState.innerHTML = `
                                <div class="empty-wishlist-content">
                                    <div class="empty-wishlist-icon">
                                        <i class="far fa-heart"></i>
                                    </div>
                                    <h2>Your wishlist is empty</h2>
                                    <p>Add items you love to your wishlist. Review them anytime and easily move them to the cart.</p>
                                    <a href="/shop" class="btn btn-primary btn-lg mt-3">
                                        <i class="fas fa-shopping-bag me-2"></i> Continue Shopping
                                    </a>
                                </div>
                            `;

                            // Replace content
                            if (wishlistSection) {
                                wishlistSection.replaceWith(emptyState);
                            }
                            if (clearButton) {
                                clearButton.remove();
                            }
                        }

                        // Show success message using the improved showToast function
                        showToastImproved("Item removed from wishlist");
                    }, 300);
                } else {
                    showToastImproved(data.message || "Failed to remove item", "error");
                }
            })
            .catch(error => {
                console.error('Error:', error);
                window.location.href = '/login';
            });
        });
    });
}

// Handle clearing the entire wishlist
function initializeClearWishlistButton() {
  const clearButton = document.getElementById("clearWishlist");

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      // Make AJAX call to clear the wishlist
      fetch('/wishlist/clear', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          const wishlistContainer = document.querySelector(".wishlist-section .container");
          const wishlistHeader = document.querySelector(".wishlist-header");

          // Keep the header
          const newContent = document.createElement("div");
          newContent.innerHTML = `
            <div class="empty-wishlist">
              <div class="empty-wishlist-content">
                <div class="empty-wishlist-icon">
                  <i class="far fa-heart"></i>
                </div>
                <h2>Your wishlist is empty</h2>
                <p>Add items you love to your wishlist. Review them anytime and easily move them to the cart.</p>
                <a href="/shop" class="btn btn-primary btn-lg mt-3">
                  <i class="fas fa-shopping-bag me-2"></i> Continue Shopping
                </a>
              </div>
            </div>
          `;

          // Remove everything except the header
          if (wishlistContainer) {
            Array.from(wishlistContainer.children).forEach((child) => {
              if (!child.classList.contains("wishlist-header")) {
                child.remove();
              }
            });

            wishlistContainer.appendChild(newContent.firstElementChild);
          }

          // Show success message using the improved showToast function
          showToastImproved("Wishlist cleared successfully");
        } else {
          showToastImproved(data.message || "Failed to clear wishlist", "error");
        }
      })
      .catch(error => {
        console.error('Error:', error);
        showToastImproved("An error occurred", "error");
      });
    });
  }
}

// Handle adding items to cart
function initializeAddToCartButtons() {
  const addToCartButtons = document.querySelectorAll(".btn-add-to-cart");

  addToCartButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const productId = this.getAttribute("data-product-id");

   
      const originalText = this.innerHTML;
      this.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Adding...';
      this.disabled = true;

      // Make AJAX call to add the item to the cart
      fetch('/cart/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          productId: productId,
          quantity: 1
        })
      })
      .then(response => response.json())
      .then(data => {
        this.innerHTML = originalText;
        this.disabled = false;
        
        if (data.success) {
          showToastImproved("Item added to cart successfully");
        } else {
          showToastImproved(data.message || "Failed to add item to cart", "error");
        }
      })
      .catch(error => {
        this.innerHTML = originalText;
        this.disabled = false;
        
        console.error('Error:', error);
        showToastImproved("An error occurred", "error");
      });
    });
  });
}

// Improved Toast notification function that ensures Bootstrap is properly loaded
function showToastImproved(message, type = 'success') {
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
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
    
    const toastElement = document.getElementById(toastId);

    try {
        // First check if Bootstrap is available as a global variable
        const bootstrap = window.bootstrap;
        if (typeof bootstrap !== 'undefined') {
            const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 3000 });
            toast.show();
            return;
        }
        
        // Then check if it's available on the window object
        if (window.bootstrap) {
            const toast = new window.bootstrap.Toast(toastElement, { autohide: true, delay: 3000 });
            toast.show();
            return;
        }

        console.warn('Bootstrap not found, using custom toast implementation');
        
        toastElement.style.display = 'block';
        toastElement.style.position = 'fixed';
        toastElement.style.bottom = '20px';
        toastElement.style.right = '20px';
        toastElement.style.minWidth = '250px';
        toastElement.style.backgroundColor = type === 'success' ? '#28a745' : '#dc3545';
        toastElement.style.color = 'white';
        toastElement.style.padding = '15px';
        toastElement.style.borderRadius = '4px';
        toastElement.style.boxShadow = '0 0.5rem 1rem rgba(0, 0, 0, 0.15)';
        toastElement.style.opacity = '1';
        toastElement.style.transition = 'opacity 0.5s ease';
        toastElement.style.zIndex = '9999';
        
        setTimeout(() => {
            toastElement.style.opacity = '0';
            setTimeout(() => {
                toastElement.remove();
            }, 500);
        }, 3000);
    } catch (error) {
        console.error('Error showing toast:', error);
        alert(message);
    }
    
    // close button
    const closeButton = toastElement.querySelector('.btn-close');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            toastElement.remove();
        });
    }
}

// Keep the original showToast for backward compatibility
function showToast(message, type = 'success') {
    return showToastImproved(message, type);
}