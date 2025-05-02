document.addEventListener('DOMContentLoaded', function() {
    // Toggle wishlist icon
    const wishlistIcons = document.querySelectorAll('.wishlist-icon');
    wishlistIcons.forEach(icon => {
        icon.addEventListener('click', function() {
            const heartIcon = this.querySelector('i');
            heartIcon.classList.toggle('far');
            heartIcon.classList.toggle('fas');
            heartIcon.classList.toggle('text-danger');
        });
    });
    
    // Clear search
    const clearSearchBtn = document.getElementById('clearSearch');
    clearSearchBtn.addEventListener('click', function() {
        document.getElementById('searchInput').value = '';
        // Submit the form to clear the search
        document.getElementById('searchForm').submit();
    });
    
    // Clear all filters
    const clearAllFiltersBtn = document.getElementById('clearAllFilters');
    clearAllFiltersBtn.addEventListener('click', function() {
        // Redirect to the base shop URL without any query parameters
        window.location.href = '/shop';
    });
    
    // Apply price range
    const applyPriceRangeBtn = document.getElementById('applyPriceRange');
    applyPriceRangeBtn.addEventListener('click', function() {
        const minPrice = document.getElementById('minPrice').value;
        const maxPrice = document.getElementById('maxPrice').value;
        
        // Build the URL with current parameters
        const currentUrl = new URL(window.location.href);
        const searchParams = currentUrl.searchParams;
        
        // Update or add price parameters
        if (minPrice) {
            searchParams.set('minPrice', minPrice);
        } else {
            searchParams.delete('minPrice');
        }
        
        if (maxPrice) {
            searchParams.set('maxPrice', maxPrice);
        } else {
            searchParams.delete('maxPrice');
        }
        
        // Reset to page 1 when applying new filters
        searchParams.set('page', '1');
        
        // Redirect to the new URL
        window.location.href = currentUrl.toString();
    });
    
    // Sort select change
    const sortSelect = document.getElementById('sortSelect');
    sortSelect.addEventListener('change', function() {
        // Build the URL with current parameters
        const currentUrl = new URL(window.location.href);
        const searchParams = currentUrl.searchParams;
        
        // Update sort parameter
        if (this.value) {
            searchParams.set('sort', this.value);
        } else {
            searchParams.delete('sort');
        }
        
        // Reset to page 1 when changing sort
        searchParams.set('page', '1');
        
        // Redirect to the new URL
        window.location.href = currentUrl.toString();
    });
    
    // Filter checkboxes
    const filterCheckboxes = document.querySelectorAll('.filter-options input[type="checkbox"]');
    filterCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            // Build the URL with current parameters
            const currentUrl = new URL(window.location.href);
            const searchParams = currentUrl.searchParams;
            
            // Get the filter type (category, brand, etc.)
            const filterType = this.name;
            
            // Update filter parameter
            if (this.checked) {
                searchParams.set(filterType, this.value);
            } else {
                searchParams.delete(filterType);
            }
            
            // Reset to page 1 when applying new filters
            searchParams.set('page', '1');
            
            // Redirect to the new URL
            window.location.href = currentUrl.toString();
        });
    });
    
    // Remove active filter tags
    const activeFilterTags = document.querySelectorAll('.active-filter-tag i');
    activeFilterTags.forEach(tag => {
        tag.addEventListener('click', function() {
            const filterId = this.getAttribute('data-filter-id');
            
            // Build the URL with current parameters
            const currentUrl = new URL(window.location.href);
            const searchParams = currentUrl.searchParams;
            
            // Remove the specific filter
            if (filterId === 'price-range') {
                searchParams.delete('minPrice');
                searchParams.delete('maxPrice');
            } else {
                searchParams.delete(filterId);
            }
            
            // Reset to page 1 when removing filters
            searchParams.set('page', '1');
            
            // Redirect to the new URL
            window.location.href = currentUrl.toString();
        });
    });
    
    // Mobile filter apply button
    const applyFiltersMobileBtn = document.getElementById('applyFiltersMobile');
    if (applyFiltersMobileBtn) {
        applyFiltersMobileBtn.addEventListener('click', function() {
            // Get all checked filters
            const checkedFilters = document.querySelectorAll('.filter-options input[type="checkbox"]:checked');
            
            // Build the URL with current parameters
            const currentUrl = new URL(window.location.href);
            const searchParams = currentUrl.searchParams;
            
            // Clear existing filter parameters
            searchParams.delete('category');
            searchParams.delete('brand');
            searchParams.delete('color');
            
            // Add checked filters
            checkedFilters.forEach(filter => {
                searchParams.set(filter.name, filter.value);
            });
            
            // Add price range if set
            const minPrice = document.getElementById('minPrice').value;
            const maxPrice = document.getElementById('maxPrice').value;
            
            if (minPrice) {
                searchParams.set('minPrice', minPrice);
            }
            
            if (maxPrice) {
                searchParams.set('maxPrice', maxPrice);
            }
            
            // Reset to page 1 when applying new filters
            searchParams.set('page', '1');
            
            // Redirect to the new URL
            window.location.href = currentUrl.toString();
        });
    }
    
    // Toggle filter visibility on mobile
    const filterHeader = document.querySelector('.filter-header h4');
    const filterContainer = document.querySelector('.filter-container');
    
    // Add mobile filter toggle functionality if needed
    if (window.innerWidth < 992 && filterHeader && filterContainer) {
        filterHeader.addEventListener('click', function() {
            filterContainer.classList.toggle('show-mobile');
        });
    }
});