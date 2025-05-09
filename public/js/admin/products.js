document.addEventListener("DOMContentLoaded", function () {
    
    let success_msg = typeof window.success_msg !== 'undefined' ? window.success_msg : '';
    let error_msg = typeof window.error_msg !== 'undefined' ? window.error_msg : '';

    //  flash messages
    if (typeof success_msg !== 'undefined' && success_msg.length > 0) { 
        Swal.fire({
            icon: 'success',
            title: 'Success',
            text: success_msg,
            confirmButtonColor: '#0d6efd'
        });
    } 

    if (typeof error_msg !== 'undefined' && error_msg.length > 0) { 
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error_msg,
            confirmButtonColor: '#0d6efd'
        });
    }

    // Toggle product status (listed/unlisted)
    const statusToggles = document.querySelectorAll('.status-toggle');
    statusToggles.forEach(toggle => {
        toggle.addEventListener('change', function() {
            const productId = this.dataset.productId;
            const isActive = this.checked;
            const slider = this.nextElementSibling;
            const label = this.parentElement.nextElementSibling;
            
            Swal.fire({
                title: isActive ? 'List Product?' : 'Unlist Product?',
                text: isActive ? 'This product will be visible to customers' : 'This product will be hidden from customers',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#0d6efd',
                cancelButtonColor: '#6c757d',
                confirmButtonText: isActive ? 'Yes, list it!' : 'Yes, unlist it!'
            }).then((result) => {
                if (result.isConfirmed) {
                    // Update UI immediately for better UX
                    if (isActive) {
                        slider.classList.add('green');
                        label.textContent = 'LISTED';
                    } else {
                        slider.classList.remove('green');
                        label.textContent = 'UNLISTED';
                    }
                    
                    // Send AJAX request to update product status
                    fetch(`/admin/toggleProductListing/${productId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Status Updated',
                                text: `Product is now ${isActive ? 'listed' : 'unlisted'}`,
                                confirmButtonColor: '#0d6efd'
                            });
                        } else {
                            // Revert UI changes if update failed
                            this.checked = !isActive;
                            if (!isActive) {
                                slider.classList.add('green');
                                label.textContent = 'LISTED';
                            } else {
                                slider.classList.remove('green');
                                label.textContent = 'UNLISTED';
                            }
                            
                            Swal.fire({
                                icon: 'error',
                                title: 'Update Failed',
                                text: data.message || 'Failed to update product status',
                                confirmButtonColor: '#0d6efd'
                            });
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        // Revert UI changes if update failed
                        this.checked = !isActive;
                        if (!isActive) {
                            slider.classList.add('green');
                            label.textContent = 'LISTED';
                        } else {
                            slider.classList.remove('green');
                            label.textContent = 'UNLISTED';
                        }
                        
                        Swal.fire({
                            icon: 'error',
                            title: 'Update Failed',
                            text: 'An error occurred while updating product status',
                            confirmButtonColor: '#0d6efd'
                        });
                    });
                } else {
                    // Revert the toggle if user cancels
                    this.checked = !isActive;
                }
            });
        });
    });
    
    // Delete product functionality
    const deleteButtons = document.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const productId = this.dataset.productId;
            const productName = this.dataset.productName;
            
            Swal.fire({
                title: 'Are you sure?',
                text: `You are about to delete "${productName}". This action cannot be undone!`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#dc3545',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Yes, delete it!'
            }).then((result) => {
                if (result.isConfirmed) {
                    // Send AJAX request to delete product
                    fetch(`/admin/deleteProduct/${productId}`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Deleted!',
                                text: data.message || 'Product has been deleted successfully.',
                                confirmButtonColor: '#0d6efd'
                            }).then(() => {
                                // Reload page after successful deletion
                                window.location.reload();
                            });
                        } else {
                            Swal.fire({
                                icon: 'error',
                                title: 'Delete Failed',
                                text: data.message || 'Failed to delete product',
                                confirmButtonColor: '#0d6efd'
                            });
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        Swal.fire({
                            icon: 'error',
                            title: 'Delete Failed',
                            text: 'An error occurred while deleting the product',
                            confirmButtonColor: '#0d6efd'
                        });
                    });
                }
            });
        });
    });
    
    // Add offer functionality
    const addOfferButtons = document.querySelectorAll('.add-offer-btn');
    const addOfferModal = document.getElementById('addOfferModal');
    
    if (addOfferModal) {
        const bsAddOfferModal = new bootstrap.Modal(addOfferModal);
        
        addOfferButtons.forEach(button => {
            button.addEventListener('click', function() {
                const productId = this.dataset.productId;
                const productName = this.dataset.productName;
                
                document.getElementById('offerProductId').value = productId;
                document.getElementById('offerProductName').value = productName;
                
                bsAddOfferModal.show();
            });
        });
    }
    
    // Handle offer form submission
    const addOfferForm = document.getElementById('addOfferForm');
    if (addOfferForm) {
        addOfferForm.addEventListener('submit', function(e) {
            const offerPercentage = document.getElementById('offerPercentage').value;
            
            if (!offerPercentage || offerPercentage < 1 || offerPercentage > 99) {
                e.preventDefault();
                Swal.fire({
                    icon: 'error',
                    title: 'Validation Error',
                    text: 'Offer percentage must be between 1 and 99',
                    confirmButtonColor: '#0d6efd'
                });
            }
        });
    }
});