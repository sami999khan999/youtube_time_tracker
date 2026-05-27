/**
 * Shared Dropdown Component
 * Handles space detection, open/close states, and value synchronization
 */

function initializeDropdowns() {
    // 1. Clean up existing listeners if any (re-initialization safety)
    document.querySelectorAll('.custom-dropdown').forEach(dropdown => {
        const trigger = dropdown.querySelector('.dropdown-trigger');
        if (trigger) {
            // Remove existing to avoid double binding
            const newTrigger = trigger.cloneNode(true);
            trigger.parentNode.replaceChild(newTrigger, trigger);
            
            newTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleDropdown(dropdown);
            });
        }

        dropdown.querySelectorAll('.dropdown-item').forEach(item => {
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
            newItem.addEventListener('click', (e) => {
                e.stopPropagation();
                selectDropdownItem(dropdown, newItem);
            });
        });
    });

    // 2. Global click listener to close all dropdowns
    if (!window.dropdownGlobalListenerAttached) {
        document.addEventListener('click', () => {
            closeAllDropdowns();
        });
        window.dropdownGlobalListenerAttached = true;
    }
}

function toggleDropdown(dropdown) {
    const isOpen = dropdown.classList.contains('open');
    
    // Close others
    closeAllDropdowns(dropdown);

    if (isOpen) {
        dropdown.classList.remove('open');
    } else {
        // Detect space
        const rect = dropdown.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const menuHeight = 250; // Estimated max height

        if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
            dropdown.classList.add('open-up');
            dropdown.classList.remove('open-down');
        } else {
            dropdown.classList.add('open-down');
            dropdown.classList.remove('open-up');
        }

        dropdown.classList.add('open');
    }
}

function selectDropdownItem(dropdown, item) {
    const value = item.dataset.value;
    const label = item.textContent;
    
    // Update data value
    dropdown.dataset.value = value;

    // Update trigger text
    const triggerSpan = dropdown.querySelector('.dropdown-trigger span');
    if (triggerSpan) {
        triggerSpan.textContent = label;
    }

    // Update active class
    dropdown.querySelectorAll('.dropdown-item').forEach(i => {
        i.classList.toggle('active', i === item);
    });

    // Close
    dropdown.classList.remove('open');

    // Trigger change event for parent logic
    const event = new CustomEvent('change', { 
        detail: { value, label },
        bubbles: true 
    });
    dropdown.dispatchEvent(event);
}

function closeAllDropdowns(except = null) {
    document.querySelectorAll('.custom-dropdown.open').forEach(d => {
        if (d !== except) {
            d.classList.remove('open');
        }
    });
}
