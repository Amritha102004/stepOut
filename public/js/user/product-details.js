document.addEventListener('DOMContentLoaded', function () {
    // Get product ID from URL
    const pathParts = window.location.pathname.split('/');
    const productId = pathParts[pathParts.length - 1];
    
    // Check if product is in wishlist
    checkWishlistStatus(productId);
    
    // Product image gallery
    const thumbnails = document.querySelectorAll('.thumbnail');
    const mainImage = document.getElementById('mainProductImage');

    thumbnails.forEach(thumbnail => {
        thumbnail.addEventListener('click', function () {
            // Update main image
            mainImage.src = this.getAttribute('data-image');

            // Update active thumbnail
            thumbnails.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Image zoom functionality
    const mainImageZoom = document.getElementById('mainImageZoom');
    if (mainImageZoom) {
        mainImageZoom.addEventListener('mousemove', function(e) {
            const { left, top, width, height } = this.getBoundingClientRect();
            const x = (e.clientX - left) / width * 100;
            const y = (e.clientY - top) / height * 100;
            
            mainImage.style.transformOrigin = `${x}% ${y}%`;
            mainImage.style.transform = 'scale(1.5)';
        });
        
        mainImageZoom.addEventListener('mouseleave', function() {
            mainImage.style.transform = 'scale(1)';
        });
    }

    // Quantity selector
    const minusBtn = document.querySelector('.quantity-btn.minus');
    const plusBtn = document.querySelector('.quantity-btn.plus');
    const quantityInput = document.querySelector('.quantity-input');

    if (minusBtn && plusBtn && quantityInput) {
        minusBtn.addEventListener('click', function () {
            const currentValue = parseInt(quantityInput.value);
            if (currentValue > 1) {
                quantityInput.value = currentValue - 1;
            }
        });

        plusBtn.addEventListener('click', function () {
            const currentValue = parseInt(quantityInput.value);
            const maxValue = parseInt(quantityInput.getAttribute('max') || 999);
            if (currentValue < maxValue) {
                quantityInput.value = currentValue + 1;
            }
        });
    }

    // Wishlist toggle
    const wishlistBtn = document.querySelector('.btn-wishlist');
    if (wishlistBtn) {
        wishlistBtn.addEventListener('click', function () {
            toggleWishlist(productId);
        });
    }
    
    // Size selection
    const sizeOptions = document.querySelectorAll('input[name="size"]');
    const currentPriceElement = document.querySelector('.current-price');
    const originalPriceElement = document.querySelector('.original-price');
    const discountElement = document.querySelector('.discount');

    if (sizeOptions.length > 0) {
        sizeOptions.forEach(option => {
            option.addEventListener('change', function() {
                // Update price based on selected size
                if (this.checked) {
                    const selectedSize = this.value;
                    const salePrice = this.getAttribute('data-sale-price');
                    const originalPrice = this.getAttribute('data-original-price');
                    
                    // Update the displayed price
                    if (currentPriceElement) {
                        currentPriceElement.textContent = `₹${salePrice}`;
                    }
                    
                    // Update original price and discount if applicable
                    if (originalPrice && parseFloat(originalPrice) > parseFloat(salePrice)) {
                        if (originalPriceElement) {
                            originalPriceElement.textContent = `₹${originalPrice}`;
                            originalPriceElement.style.display = 'inline';
                        }
                        
                        if (discountElement) {
                            const discount = Math.round((parseFloat(originalPrice) - parseFloat(salePrice)) / parseFloat(originalPrice) * 100);
                            discountElement.textContent = `${discount}% off`;
                            discountElement.style.display = 'inline';
                        }
                    } else {
                        // Hide original price and discount if there's no discount
                        if (originalPriceElement) {
                            originalPriceElement.style.display = 'none';
                        }
                        
                        if (discountElement) {
                            discountElement.style.display = 'none';
                        }
                    }
                    
                    console.log('Selected size:', selectedSize, 'Price:', salePrice);
                }
            });
        });
        
        // Select the first available size by default
        const firstAvailableSize = Array.from(sizeOptions).find(option => !option.disabled);
        if (firstAvailableSize) {
            firstAvailableSize.checked = true;
            // Trigger the change event to update the price
            const event = new Event('change');
            firstAvailableSize.dispatchEvent(event);
        }
    }
    
    // Review rating input
    const ratingStars = document.querySelectorAll('.rating-input i');
    const ratingInput = document.getElementById('ratingInput');
    
    if (ratingStars.length > 0 && ratingInput) {
        ratingStars.forEach(star => {
            star.addEventListener('click', function() {
                const rating = parseInt(this.getAttribute('data-rating'));
                ratingInput.value = rating;
                
                // Update stars visual
                ratingStars.forEach((s, index) => {
                    if (index < rating) {
                        s.classList.remove('far');
                        s.classList.add('fas');
                    } else {
                        s.classList.remove('fas');
                        s.classList.add('far');
                    }
                });
            });
            
            // Hover effect
            star.addEventListener('mouseenter', function() {
                const rating = parseInt(this.getAttribute('data-rating'));
                
                ratingStars.forEach((s, index) => {
                    if (index < rating) {
                        s.classList.add('hover');
                    } else {
                        s.classList.remove('hover');
                    }
                });
            });
        });
        
        document.querySelector('.rating-input').addEventListener('mouseleave', function() {
            ratingStars.forEach(s => {
                s.classList.remove('hover');
            });
        });
    }
    
    // Submit review
    const submitReviewBtn = document.getElementById('submitReview');
    if (submitReviewBtn) {
        submitReviewBtn.addEventListener('click', function() {
            const rating = document.getElementById('ratingInput').value;
            const title = document.getElementById('reviewTitle').value;
            const content = document.getElementById('reviewContent').value;
            
            if (rating === '0') {
                alert('Please select a rating');
                return;
            }
            
            if (!title.trim()) {
                alert('Please enter a review title');
                return;
            }
            
            if (!content.trim()) {
                alert('Please enter your review');
                return;
            }
            
            // Here you would typically submit the review to your backend
            console.log('Review submitted:', { rating, title, content });
            
            // Close modal and show success message
            const bootstrap = window.bootstrap; // Declare the bootstrap variable
            if (bootstrap) {
                const modal = bootstrap.Modal.getInstance(document.getElementById('writeReviewModal'));
                if (modal) {
                    modal.hide();
                }
            }
            
            showToast('Thank you for your review! It will be published after moderation.');
        });
    }
    
    // Apply coupon
    const applyCouponBtn = document.getElementById('applyCoupon');
    if (applyCouponBtn) {
        applyCouponBtn.addEventListener('click', function() {
            const couponCode = document.getElementById('couponCode').value;
            
            if (!couponCode.trim()) {
                showToast('Please enter a coupon code', 'error');
                return;
            }
            
            // Here you would typically validate the coupon with your backend
            // For demo purposes, we'll just show a success message
            showToast('Coupon applied successfully! 10% discount has been applied to your order.');
        });
    }
    
    // Add to cart button
    // const addToCartBtn = document.querySelector('.btn-add-to-cart');
    // if (addToCartBtn) {
    //     addToCartBtn.addEventListener('click', function() {
    //         const selectedSize = document.querySelector('input[name="size"]:checked');
            
    //         if (!selectedSize) {
    //             showToast('Please select a size', 'error');
    //             return;
    //         }
            
    //         const quantity = document.querySelector('.quantity-input').value;
            
    //         // Make AJAX call to add the item to the cart
    //         fetch('/cart/add', {
    //             method: 'POST',
    //             headers: {
    //                 'Content-Type': 'application/json'
    //             },
    //             body: JSON.stringify({
    //                 productId: productId,
    //                 size: selectedSize.value,
    //                 quantity: quantity
    //             })
    //         })
    //         .then(response => response.json())
    //         .then(data => {
    //             if (data.success) {
    //                 showToast('Product added to cart successfully!');
    //             } else {
    //                 showToast(data.message || 'Failed to add product to cart', 'error');
    //             }
    //         })
    //         .catch(error => {
    //             console.error('Error adding to cart:', error);
    //             showToast('An error occurred', 'error');
    //         });
    //     });
    // }
    // Add to cart button
const addToCartBtn = document.querySelector(".btn-add-to-cart")
if (addToCartBtn) {
  addToCartBtn.addEventListener("click", function () {
    const selectedSize = document.querySelector('input[name="size"]:checked')

    if (!selectedSize) {
      showToast("Please select a size", "error")
      return
    }

    const quantity = Number.parseInt(document.querySelector(".quantity-input").value)

    // Show loading state
    const originalText = this.innerHTML
    this.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Adding...'
    this.disabled = true

    // Make AJAX call to add the item to the cart
    fetch("/cart/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productId: productId,
        size: selectedSize.value,
        quantity: quantity,
      }),
    })
      .then((response) => {
        if (response.redirected) {
          window.location.href = response.url
          return null
        }
        return response.json()
      })
      .then((data) => {
        // Reset button state
        this.innerHTML = originalText
        this.disabled = false

        if (!data) return // Handle redirect case

        if (data.success) {
          showToast("Product added to cart successfully!")

          // Update cart count in header if element exists
          const cartCountElement = document.querySelector(".cart-count")
          if (cartCountElement && data.cartItemCount) {
            cartCountElement.textContent = data.cartItemCount
          }
        } else {
          showToast(data.message || "Failed to add product to cart", "error")
        }
      })
      .catch((error) => {
        // Reset button state
        this.innerHTML = originalText
        this.disabled = false

        console.error("Error adding to cart:", error)
        showToast("An error occurred while adding to cart", "error")
      })
  })
}
});

// Function to check if product is in wishlist
function checkWishlistStatus(productId) {
    fetch(`/wishlist/check/${productId}`)
        .then(response => response.json())
        .then(data => {
            updateWishlistButton(data.inWishlist);
        })
        .catch(error => {
            console.error('Error checking wishlist status:', error);
        });
}

// Function to toggle wishlist status
function toggleWishlist(productId) {
    const wishlistBtn = document.querySelector('.btn-wishlist');
    const isInWishlist = wishlistBtn.classList.contains('active');
    
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
                updateWishlistButton(false);
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
                updateWishlistButton(true);
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

// Function to update wishlist button appearance
function updateWishlistButton(isInWishlist) {
    const wishlistBtn = document.querySelector('.btn-wishlist');
    if (!wishlistBtn) return;
    
    const heartIcon = wishlistBtn.querySelector('i');
    
    if (isInWishlist) {
        wishlistBtn.classList.add('active');
        heartIcon.classList.remove('far');
        heartIcon.classList.add('fas');
        heartIcon.classList.add('text-danger');
    } else {
        wishlistBtn.classList.remove('active');
        heartIcon.classList.remove('fas');
        heartIcon.classList.remove('text-danger');
        heartIcon.classList.add('far');
    }
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
    if (bootstrap) {
        const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 3000 });
        toast.show();
    }
    
    // Remove toast after it's hidden
    toastElement.addEventListener('hidden.bs.toast', function() {
        toastElement.remove();
    });
}