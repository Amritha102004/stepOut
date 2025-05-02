document.addEventListener("DOMContentLoaded", function () {
    // Check for flash messages
    try {
        // Flash messages are handled by the server-side rendering
        // This is just a placeholder for any client-side flash message handling
    } catch (e) {
        console.log("Flash message check error:", e);
    }

    // Image upload functionality
    function setupImageUpload(
        containerId,
        inputId,
        buttonId,
        removeButtonId,
        oldImageInputName
    ) {
        const container = document.getElementById(containerId);
        const fileInput = document.getElementById(inputId);
        const removeButton = document.getElementById(removeButtonId);
        const oldImageInput = oldImageInputName ? document.querySelector(`input[name="${oldImageInputName}"]`) : null;

        if (!container || !fileInput || !removeButton) {
            console.error(`Missing elements for ${containerId}, ${inputId}, or ${removeButtonId}`);
            return;
        }

        container.addEventListener("click", function (e) {
            if (e.target !== removeButton && !removeButton.contains(e.target)) {
                fileInput.click();
            }
        });

        fileInput.addEventListener("change", function () {
            if (fileInput.files && fileInput.files[0]) {
                const reader = new FileReader();

                reader.onload = function (e) {
                    container.style.backgroundImage = `url('${e.target.result}')`;
                    container.style.backgroundSize = "cover";
                    container.style.backgroundPosition = "center";

                    container.innerHTML = "";

                    removeButton.classList.remove("d-none");

                    if (oldImageInput) {
                        oldImageInput.setAttribute('data-replaced', 'true');
                    }
                };

                reader.readAsDataURL(fileInput.files[0]);
            }
        });

        if (removeButton) {
            removeButton.addEventListener("click", function (e) {
                e.stopPropagation();

                fileInput.value = "";

                container.style.backgroundImage = "";
                container.innerHTML = `
                    <i class="fas fa-image upload-icon"></i>
                    <p class="upload-text">Drag and drop image here, or click to add image</p>
                    <button type="button" class="btn-upload" id="${buttonId}">Add Image</button>`;

                const newButton = document.getElementById(buttonId);
                if (newButton) {
                    newButton.addEventListener("click", function (e) {
                        e.stopPropagation();
                        fileInput.click();
                    });
                }

                removeButton.classList.add("d-none");

                if (oldImageInput) {
                    oldImageInput.setAttribute('data-removed', 'true');
                }
            });
        }

        container.addEventListener("dragover", function (e) {
            e.preventDefault();
            container.style.borderColor = "#0d6efd";
        });

        container.addEventListener("dragleave", function (e) {
            e.preventDefault();
            container.style.borderColor = "#dee2e6";
        });

        container.addEventListener("drop", function (e) {
            e.preventDefault();
            container.style.borderColor = "#dee2e6";

            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                fileInput.files = e.dataTransfer.files;

                const reader = new FileReader();
                reader.onload = function (e) {
                    container.style.backgroundImage = `url('${e.target.result}')`;
                    container.style.backgroundSize = "cover";
                    container.style.backgroundPosition = "center";

                    container.innerHTML = "";

                    removeButton.classList.remove("d-none");

                    if (oldImageInput) {
                        oldImageInput.setAttribute('data-replaced', 'true');
                    }
                };

                reader.readAsDataURL(e.dataTransfer.files[0]);
            }
        });
    }

    // Setup image upload for all image containers
    setupImageUpload(
        "mainPhotoUpload",
        "mainImage",
        "mainImageBtn",
        "removeMainImage",
        "oldMainImage"
    );
    setupImageUpload(
        "additionalPhoto1Container",
        "additionalImage1",
        "additionalImage1Btn",
        "removeAdditionalPhoto1",
        "oldAdditionalImage1"
    );
    setupImageUpload(
        "additionalPhoto2Container",
        "additionalImage2",
        "additionalImage2Btn",
        "removeAdditionalPhoto2",
        "oldAdditionalImage2"
    );

    // Form validation
    const form = document.getElementById("updateProductForm");
    if (form) {
        form.addEventListener("submit", function (e) {
            const productName = document
                .getElementById("productName")
                .value.trim();
            const description = document
                .getElementById("description")
                .value.trim();
            const category = document.getElementById("category").value;

            let isValid = true;
            let errorMessage = "";

            if (!productName) {
                isValid = false;
                errorMessage = "Product name is required";
            } else if (!description) {
                isValid = false;
                errorMessage = "Product description is required";
            } else if (!category) {
                isValid = false;
                errorMessage = "Category selection is required";
            }

            if (!isValid) {
                e.preventDefault();
                Swal.fire({
                    icon: "error",
                    title: "Validation Error",
                    text: errorMessage,
                    confirmButtonColor: "#0d6efd",
                });
            }
        });
    }
});