// === Shorts Blocker: Hide shorts, reorder sidebar, manage CSS ===

function injectShortsBlockerCSS() {
    if (!document.getElementById(SHORTS_BLOCKER_CSS_ID)) {
        const style = document.createElement('style');
        style.id = SHORTS_BLOCKER_CSS_ID;
        style.textContent = SHORTS_BLOCKER_CSS;
        (document.head || document.documentElement).appendChild(style);
    }
}

function removeShortsBlockerCSS() {
    const el = document.getElementById(SHORTS_BLOCKER_CSS_ID);
    if (el) el.remove();
}

function applyShortsBlockerState() {
    if (shortsBlockerSettings.enabled) {
        injectShortsBlockerCSS();
        blockShorts();
    } else {
        removeShortsBlockerCSS();
        removeMockingScreen();
        // Un-hide any JS-hidden shorts tabs
        unhideShortsTabs();
    }
}

function unhideShortsTabs() {
    const selectors = ['yt-tab-shape', 'tp-yt-paper-tab', '.yt-tab-shape-wiz__tab', 'yt-chip-cloud-chip-renderer'];
    selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            const text = el.textContent.trim().toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            const title = (el.getAttribute('tab-title') || '').toLowerCase();
            if (text === 'shorts' || aria === 'shorts' || title === 'shorts') {
                el.style.removeProperty('display');
            }
        });
    });
}

function blockShorts() {
    // Hide channel tabs using JS (more reliable than CSS for text matching)
    hideShortsTabs();
    
    // Remove entire Shorts shelves/sections (including headers and "Show more" buttons)
    hideShortsShelves();

    // Reorder sidebar as requested
    reorderSidebar();

    // Check if we are on a shorts page
    if (window.location.pathname.startsWith('/shorts/')) {
        injectMockingScreen();
    } else {
        removeMockingScreen();
    }
}

function reorderSidebar() {
    // Find the sections by targeting the links they contain
    // "Subscriptions" corresponds to /feed/subscriptions
    // "You" corresponds to /feed/you or /feed/library
    const subLink = document.querySelector('a[href="/feed/subscriptions"]');
    const youLink = document.querySelector('a[href="/feed/you"], a[href="/feed/library"]');

    if (subLink && youLink) {
        const subSection = subLink.closest('ytd-guide-section-renderer');
        const youSection = youLink.closest('ytd-guide-section-renderer');

        if (subSection && youSection && subSection.parentNode === youSection.parentNode) {
            const parent = subSection.parentNode;
            // Check if youSection is after subSection in the DOM
            if (subSection.compareDocumentPosition(youSection) & Node.DOCUMENT_POSITION_FOLLOWING) {
                // Move youSection before subSection
                parent.insertBefore(youSection, subSection);
            }
        }
    }
}

function hideShortsTabs() {
    const selectors = ['yt-tab-shape', 'tp-yt-paper-tab', '.yt-tab-shape-wiz__tab', 'yt-chip-cloud-chip-renderer'];
    selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
            const text = el.textContent.trim().toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            const title = (el.getAttribute('tab-title') || '').toLowerCase();
            
            if (text === 'shorts' || aria === 'shorts' || title === 'shorts' || (el.querySelector && el.querySelector('a[href*="/shorts"]'))) {
                el.style.setProperty('display', 'none', 'important');
            }
        });
    });

    // Also hide any link that goes to shorts directly
    const links = document.querySelectorAll('a[href*="/shorts"]');
    links.forEach(link => {
        // If it's a tab link, hide the parent/containier if needed, but mostly the link itself
        if (link.classList.contains('yt-tab-shape-wiz__tab') || link.closest('tp-yt-paper-tab')) {
             const tab = link.closest('yt-tab-shape') || link.closest('tp-yt-paper-tab') || link;
             tab.style.setProperty('display', 'none', 'important');
        }
    });
}

function hideShortsShelves() {
    // 1. Find by the specific class identified in the screenshot
    const gridHosts = document.querySelectorAll('.ytGridShelfViewModelHost');
    gridHosts.forEach(host => {
        // If it contains a shorts link or the Shorts icon, hide the whole host
        if (host.querySelector('a[href*="/shorts/"]') || host.querySelector('yt-icon[type="shorts"]')) {
            if (host.style.display !== 'none') {
                host.style.setProperty('display', 'none', 'important');
            }
        }
    });

    // 2. Find by Shorts Icon (more generic)
    const shortsIcons = document.querySelectorAll('yt-icon[type="shorts"], path[d*="M17.7,3"]');
    shortsIcons.forEach(icon => {
        const shelf = icon.closest('ytd-shelf-renderer, ytd-rich-shelf-renderer, ytd-reel-shelf-renderer, ytd-rich-section-renderer, .ytGridShelfViewModelHost');
        if (shelf && shelf.style.display !== 'none') {
            shelf.style.setProperty('display', 'none', 'important');
        }
    });

    // 3. Find by Header Text "Shorts"
    const titles = document.querySelectorAll('h2#title, span#title, #title-text');
    titles.forEach(h => {
        if (h.textContent.trim().toLowerCase() === 'shorts') {
             const shelf = h.closest('ytd-shelf-renderer, ytd-rich-shelf-renderer, ytd-reel-shelf-renderer, ytd-rich-section-renderer, .ytGridShelfViewModelHost');
             if (shelf && shelf.style.display !== 'none') {
                  shelf.style.setProperty('display', 'none', 'important');
             }
        }
    });
}
