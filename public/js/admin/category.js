document.addEventListener("DOMContentLoaded", () => {
    
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

    
    const deleteButtons = document.querySelectorAll(".delete-btn")
    deleteButtons.forEach((button) => {
        button.addEventListener("click", function () {
            if (this.disabled) {
                Swal.fire({
                    title: "Cannot Delete",
                    text: "This category has associated products and cannot be deleted",
                    icon: "warning",
                    confirmButtonColor: "#000",
                })
                return
            }

            const categoryId = this.getAttribute("data-id")
            const categoryName = this.getAttribute("data-name")

            Swal.fire({
                title: "Are you sure?",
                text: `Do you want to delete the category "${categoryName}"?`,
                icon: "warning",
                showCancelButton: true,
                confirmButtonColor: "#d33",
                cancelButtonColor: "#3085d6",
                confirmButtonText: "Yes, delete it!",
            }).then((result) => {
                if (result.isConfirmed) {
                    Swal.fire({
                        title: "Deleting...",
                        html: "Please wait while we delete the category",
                        allowOutsideClick: false,
                        didOpen: () => {
                            Swal.showLoading()
                        },
                    })

                    fetch(`/admin/deleteCategory/${categoryId}`, {
                        method: "DELETE",
                    })
                        .then((response) => response.json())
                        .then((data) => {
                            if (data.success) {
                                Swal.fire({
                                    title: "Deleted!",
                                    text: "Category has been deleted successfully.",
                                    icon: "success",
                                    confirmButtonColor: "#000",
                                }).then(() => {
                                    window.location.reload()
                                })
                            } else {
                                Swal.fire({
                                    title: "Error!",
                                    text: data.message,
                                    icon: "error",
                                    confirmButtonColor: "#000",
                                })
                            }
                        })
                        .catch((error) => {
                            console.error("Error:", error)
                            Swal.fire({
                                title: "Error!",
                                text: "There was a problem deleting the category.",
                                icon: "error",
                                confirmButtonColor: "#000",
                            })
                        })
                }
            })
        })
    })

    
    const toggleForms = document.querySelectorAll(".toggle-form")
    toggleForms.forEach((form) => {
        const checkbox = form.querySelector('input[type="checkbox"]')
        checkbox.addEventListener("change", () => {
            const isChecked = checkbox.checked
            const action = isChecked ? "list" : "unlist"

            Swal.fire({
                title: `${action.charAt(0).toUpperCase() + action.slice(1)} Category?`,
                text: `Are you sure you want to ${action} this category?`,
                icon: "question",
                showCancelButton: true,
                confirmButtonColor: "#000",
                cancelButtonColor: "#6c757d",
                confirmButtonText: `Yes, ${action} it!`,
            }).then((result) => {
                if (result.isConfirmed) {
                    Swal.fire({
                        title: "Processing...",
                        html: `Please wait while we ${action} the category`,
                        allowOutsideClick: false,
                        didOpen: () => {
                            Swal.showLoading()
                            form.submit()
                        },
                    })
                } else {
                    checkbox.checked = !isChecked
                }
            })
        })
    })
})