document.addEventListener('DOMContentLoaded', function () {
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
            const heartIcon = this.querySelector('i');
            heartIcon.classList.toggle('far');
            heartIcon.classList.toggle('fas');
            heartIcon.classList.toggle('text-danger');
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
            const modal = bootstrap.Modal.getInstance(document.getElementById('writeReviewModal'));
            modal.hide();
            
            alert('Thank you for your review! It will be published after moderation.');
        });
    }
    
    // Apply coupon
    const applyCouponBtn = document.getElementById('applyCoupon');
    if (applyCouponBtn) {
        applyCouponBtn.addEventListener('click', function() {
            const couponCode = document.getElementById('couponCode').value;
            
            if (!couponCode.trim()) {
                alert('Please enter a coupon code');
                return;
            }
            
            // Here you would typically validate the coupon with your backend
            // For demo purposes, we'll just show a success message
            alert('Coupon applied successfully! 10% discount has been applied to your order.');
        });
    }
    
    // Add to cart button
    const addToCartBtn = document.querySelector('.btn-add-to-cart');
    if (addToCartBtn) {
        addToCartBtn.addEventListener('click', function() {
            const selectedSize = document.querySelector('input[name="size"]:checked');
            
            if (!selectedSize) {
                alert('Please select a size');
                return;
            }
            
            const quantity = document.querySelector('.quantity-input').value;
            
            // Here you would typically add the item to cart via AJAX
            // console.log('Adding to cart:', {
            //     productId: '<%= product._id %>',
            //     size: selectedSize.value,
            //     quantity: quantity
            // });
            
            // Show success message
            alert('Product added to cart successfully!');
        });
    }
});