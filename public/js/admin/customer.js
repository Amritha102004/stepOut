document.addEventListener("DOMContentLoaded", function () {

const statusToggles = document.querySelectorAll('.status-toggle');
statusToggles.forEach(toggle => {
    toggle.addEventListener('change', function() {
        const customerId = this.dataset.customerId;
        const isBlocked = this.checked;
        const slider = this.nextElementSibling;
        const label = this.parentElement.nextElementSibling;
        
        Swal.fire({
            title: isBlocked ? 'Block Customer?' : 'Unblock Customer?',
            text: isBlocked ? 'This customer will be blocked' : 'This customer will be Unblocked',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#0d6efd',
            cancelButtonColor: '#6c757d',
            confirmButtonText: isBlocked ? 'Yes, Block!' : 'Yes, Unblock!'
        }).then((result) => {
            if (result.isConfirmed) {
                
                if (isBlocked) {
                    slider.classList.add('green');
                    label.textContent = 'BLOCKED';
                } else {
                    slider.classList.remove('green');
                    label.textContent = 'BLOCK';
                }
                
                
                fetch(`/admin/toggleUserStatus/${customerId}`, {
                    method: 'PATCH',
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
                            text: `Customer is now ${isBlocked ? 'Blocked' : 'Unblocked'}`,
                            confirmButtonColor: '#0d6efd'
                        }).then(() => {
                            // Reload page after successful deletion
                            window.location.reload();
                        });
                    } else {
                        // Revert UI changes if update failed
                        this.checked = !isBlocked;
                        if (!isBlocked) {
                            slider.classList.add('green');
                            label.textContent = 'BLOCKED';
                        } else {
                            slider.classList.remove('green');
                            label.textContent = 'BLOCK';
                        }
                        
                        Swal.fire({
                            icon: 'error',
                            title: 'Update Failed',
                            text: data.message || 'Failed to update customer status',
                            confirmButtonColor: '#0d6efd'
                        });
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    // Revert UI changes if update failed
                    this.checked = !isBlocked;
                    if (!isBlocked) {
                        slider.classList.add('green');
                        label.textContent = 'BLOCKED';
                    } else {
                        slider.classList.remove('green');
                        label.textContent = 'BLOCK';
                    }
                    
                    Swal.fire({
                        icon: 'error',
                        title: 'Update Failed',
                        text: 'An error occurred while updating customer status',
                        confirmButtonColor: '#0d6efd'
                    });
                });
            } else {
                // Revert the toggle if user cancels
                this.checked = !isBlocked;
            }
        });
    });
});

})