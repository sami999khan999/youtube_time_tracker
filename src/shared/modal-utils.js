/**
 * Global stacks for elements made inert by modals and active key handlers
 */
let isolationStack = [];
let keyHandlerStack = [];
let activeModalKeyHandler = null;

/**
 * isolateModal - Makes all background elements inert except the modal itself.
 * 
 * @param {HTMLElement} modalOverlay - The modal overlay to keep active
 */
/**
 * isolateModal - Makes all background elements inert except the modal itself.
 * 
 * @param {HTMLElement} modalOverlay - The modal overlay to keep active
 */
function isolateModal(modalOverlay) {
    const isolatedInThisStep = [];
    const siblings = Array.from(document.body.children);
    
    siblings.forEach(sibling => {
        // We only isolate elements that are NOT the current modal and NOT already inert
        // This ensures nested modals don't try to double-isolate background
        if (sibling !== modalOverlay && !sibling.hasAttribute('inert')) {
            sibling.setAttribute('inert', '');
            sibling.setAttribute('aria-hidden', 'true');
            isolatedInThisStep.push(sibling);
        }
    });
    
    isolationStack.push(isolatedInThisStep);

    // Save current handler if we're nesting
    if (activeModalKeyHandler) {
        removeModalListeners();
        keyHandlerStack.push(activeModalKeyHandler);
    }

    activeModalKeyHandler = (e) => {
        if (typeof isRecording !== 'undefined' && isRecording) return;

        const isInside = modalOverlay.contains(e.target);
        const isTab = e.key === 'Tab';
        const isEscape = e.key === 'Escape';
        const isActionOnButton = (e.key === ' ' || e.key === 'Enter') && isInside && e.target.tagName === 'BUTTON';
        const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable;
        
        if (isTab || isEscape || isActionOnButton || isInput) {
            return;
        }

        e.stopImmediatePropagation();
        e.preventDefault();
    };

    addModalListeners();
}

/**
 * Global helper to add/remove listeners across multiple levels
 */
function addModalListeners() {
    ['keydown', 'keyup', 'keypress'].forEach(type => {
        window.addEventListener(type, activeModalKeyHandler, true);
        document.addEventListener(type, activeModalKeyHandler, true);
    });
}

function removeModalListeners() {
    ['keydown', 'keyup', 'keypress'].forEach(type => {
        window.removeEventListener(type, activeModalKeyHandler, true);
        document.removeEventListener(type, activeModalKeyHandler, true);
    });
}

/**
 * restoreIsolation - Removes inert and aria-hidden from formerly isolated elements.
 */
/**
 * restoreIsolation - Removes inert and aria-hidden from formerly isolated elements.
 */
function restoreIsolation() {
    const elementsToRestore = isolationStack.pop() || [];
    elementsToRestore.forEach(el => {
        if (el) {
            el.removeAttribute('inert');
            el.removeAttribute('aria-hidden');
        }
    });

    if (activeModalKeyHandler) {
        removeModalListeners();
    }

    // Restore previous handler
    activeModalKeyHandler = keyHandlerStack.pop() || null;
    
    if (activeModalKeyHandler) {
        addModalListeners();
    }
}

/**
 * showConfirmModal - Reusable accessible confirmation dialog
 * 
 * @param {Object} options 
 *   - title: Modal title
 *   - message: Modal message/body
 *   - confirmText: Text for the confirm button
 *   - cancelText: Text for the cancel button
 *   - icon: Emoji or icon HTML
 *   - onConfirm: Callback when confirmed
 */
function showConfirmModal({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', icon = '🗑️', onConfirm }) {
    if (document.getElementById('stats-confirm-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'stats-confirm-modal';
    overlay.className = 'stats-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'modal-title');

    overlay.innerHTML = `
        <div class="stats-modal">
            <span class="stats-modal-icon">${icon}</span>
            <h2 id="modal-title" class="stats-modal-title">${title}</h2>
            <p class="stats-modal-message">${message}</p>
            <div class="stats-modal-actions">
                <button id="modal-cancel" class="modal-btn secondary">${cancelText}</button>
                <button id="modal-confirm" class="modal-btn danger">${confirmText}</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Lock Scroll & Selection
    document.body.style.overflow = 'hidden';
    document.body.style.userSelect = 'none';

    const cancelBtn = document.getElementById('modal-cancel');
    const confirmBtn = document.getElementById('modal-confirm');

    const dismiss = () => {
        overlay.classList.remove('visible');
        
        // Only clear global styles if this is the last modal or sidebar
        if (isolationStack.length <= 1) {
            document.body.style.overflow = '';
            document.body.style.userSelect = '';
        }
        
        restoreIsolation();
        setTimeout(() => overlay.remove(), 300);
    };

    // Animation
    requestAnimationFrame(() => {
        overlay.classList.add('visible');
        isolateModal(overlay);
    });
    setTimeout(() => cancelBtn.focus(), 100);

    // Events
    cancelBtn.onclick = (e) => {
        e.stopPropagation();
        dismiss();
    };

    confirmBtn.onclick = (e) => {
        e.stopPropagation();
        dismiss();
        if (onConfirm) onConfirm();
    };

    overlay.onclick = (e) => {
        if (e.target === overlay) dismiss();
    };

    // Accessibility: Focus Trap & Escape
    overlay.onkeydown = (e) => {
        if (e.key === 'Tab') {
            const focusables = [cancelBtn, confirmBtn];
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    last.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === last) {
                    first.focus();
                    e.preventDefault();
                }
            }
        }
        if (e.key === 'Escape') dismiss();
    };
}

/**
 * showAlertModal - Reusable accessible alert dialog (One button)
 * 
 * @param {Object} options 
 *   - title: Modal title
 *   - message: Modal message/body
 *   - buttonText: Text for the close button
 *   - icon: Emoji or icon HTML
 */
function showAlertModal({ title, message, buttonText = 'Got it', icon = '⚠️' }) {
    if (document.getElementById('stats-confirm-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'stats-confirm-modal'; // Reuse same overlay ID for styling
    overlay.className = 'stats-modal-overlay';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
        <div class="stats-modal">
            <span class="stats-modal-icon">${icon}</span>
            <h2 class="stats-modal-title">${title}</h2>
            <p class="stats-modal-message">${message}</p>
            <div class="stats-modal-actions single">
                <button id="modal-ok" class="modal-btn premium-primary" style="width: 100%">${buttonText}</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const okBtn = document.getElementById('modal-ok');
    const dismiss = () => {
        overlay.classList.remove('visible');
        
        if (isolationStack.length <= 1) {
            document.body.style.overflow = '';
        }

        restoreIsolation();
        setTimeout(() => overlay.remove(), 300);
    };

    requestAnimationFrame(() => {
        overlay.classList.add('visible');
        isolateModal(overlay);
    });
    setTimeout(() => okBtn.focus(), 100);

    okBtn.onclick = (e) => {
        e.stopPropagation();
        dismiss();
    };
    overlay.onclick = (e) => {
        if (e.target === overlay) dismiss();
    };
    overlay.onkeydown = (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') dismiss();
    };
}

/**
 * showMultiTabToast - A beautiful floating banner warning about multiple tabs playing
 * 
 * @param {number} otherTabId - The ID of the other tab to close
 * @param {Function} onDismiss - Callback when dismissed so we don't show it again immediately
 */
function showMultiTabToast(otherTabId, onDismiss) {
    if (document.getElementById('stats-multitab-toast')) return;

    // Inject keyframes once
    if (!document.getElementById('ytt-toast-styles')) {
        const style = document.createElement('style');
        style.id = 'ytt-toast-styles';
        style.textContent = `
            @keyframes ytt-toast-in {
                from { transform: translateY(20px) scale(0.95); opacity: 0; }
                to   { transform: translateY(0) scale(1);     opacity: 1; }
            }
            #stats-multitab-toast {
                animation: ytt-toast-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            #toast-close-other {
                background: linear-gradient(135deg, #e11d48, #be123c);
                color: #fff;
                border: none;
                border-radius: 20px;
                padding: 0 18px;
                height: 34px;
                font-size: 12px;
                font-weight: 700;
                letter-spacing: 0.2px;
                cursor: pointer;
                box-shadow: 0 4px 14px rgba(225, 29, 72, 0.4);
                transition: transform 0.15s ease, box-shadow 0.15s ease;
                white-space: nowrap;
            }
            #toast-close-other:hover {
                transform: translateY(-1px);
                box-shadow: 0 6px 18px rgba(225, 29, 72, 0.55);
            }
            #toast-close-other:active {
                transform: translateY(0);
                box-shadow: 0 2px 8px rgba(225, 29, 72, 0.3);
            }
            #toast-dismiss-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                background: transparent;
                border: none;
                color: rgba(255,255,255,0.35);
                font-size: 16px;
                cursor: pointer;
                transition: background 0.2s, color 0.2s;
                flex-shrink: 0;
            }
            #toast-dismiss-btn:hover {
                background: rgba(255,255,255,0.1);
                color: rgba(255,255,255,0.75);
            }
        `;
        document.head.appendChild(style);
    }

    const toast = document.createElement('div');
    toast.id = 'stats-multitab-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 28px;
        right: 28px;
        background: rgba(18, 18, 18, 0.72);
        backdrop-filter: blur(32px) saturate(200%);
        -webkit-backdrop-filter: blur(32px) saturate(200%);
        color: #fff;
        padding: 14px 14px 14px 16px;
        border-radius: 20px;
        border: 1px solid rgba(255,255,255,0.12);
        border-top: 1px solid rgba(255,255,255,0.2);
        box-shadow: 0 24px 48px rgba(0,0,0,0.45), 0 0 0 0.5px rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        gap: 14px;
        z-index: 999999;
        font-family: -apple-system, 'Inter', BlinkMacSystemFont, sans-serif;
        pointer-events: auto;
        min-width: 320px;
        max-width: 400px;
    `;

    toast.innerHTML = `
        <div style="
            width: 38px; height: 38px; flex-shrink: 0;
            background: rgba(225, 29, 72, 0.12);
            border: 1px solid rgba(225, 29, 72, 0.35);
            border-radius: 11px;
            display: flex; align-items: center; justify-content: center;
        ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M10 7.5l5 2.5-5 2.5z" fill="#e11d48" stroke="none"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
                <line x1="8"  y1="21" x2="16" y2="21"/>
            </svg>
        </div>
        <div style="flex: 1; min-width: 0;">
            <div style="font-size: 10px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #e11d48; line-height: 1; margin-bottom: 4px;">Playing in two tabs</div>
            <div style="font-size: 13.5px; font-weight: 500; color: rgba(255,255,255,0.85); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;">This video is active elsewhere</div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
            <button id="toast-close-other">Close Other</button>
            <button id="toast-dismiss-btn" title="Dismiss">✕</button>
        </div>
    `;

    document.body.appendChild(toast);

    const removeToast = () => {
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px) scale(0.97)';
        setTimeout(() => toast.remove(), 350);
        if (onDismiss) onDismiss();
    };

    document.getElementById('toast-close-other').onclick = (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ action: 'CLOSE_TAB_BY_ID', tabId: otherTabId });
        removeToast();
    };

    document.getElementById('toast-dismiss-btn').onclick = (e) => {
        e.stopPropagation();
        removeToast();
    };
}

function showMultiTabModal(otherTabId, onKeep) {
    if (document.getElementById('stats-multitab-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'stats-multitab-modal';
    overlay.className = 'stats-modal-overlay';
    overlay.style.backdropFilter = 'blur(12px)';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
        <div class="stats-modal premium" style="background: rgba(20, 20, 20, 0.95); border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 30px 60px rgba(0,0,0,0.5);">
            <div class="ytt-icon-box" style="width: 72px; height: 72px; background: rgba(255,0,51,0.1); border: 2px solid var(--stats-primary); border-radius: 20px; box-shadow: 0 0 30px rgba(255,0,51,0.2);">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--stats-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <path d="M10 7l5 2-5 2z" fill="var(--stats-primary)"></path>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                </svg>
            </div>
            <h2 class="stats-modal-title" style="margin: 20px 0 10px; font-size: 24px; letter-spacing: -0.5px;">Duplicate Playback</h2>
            <p class="stats-modal-message" style="font-size: 15px; line-height: 1.6; opacity: 0.8; max-width: 320px; margin: 0 auto;">We detected this video is already playing elsewhere. Tracking is paused here.</p>
            <div class="stats-modal-actions" style="margin-top: 40px; width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <button id="modal-keep-this" class="modal-btn secondary" style="height: 48px; border-radius: 12px;">Keep Here</button>
                <button id="modal-close-other" class="modal-btn premium-primary" style="height: 48px; border-radius: 12px;">Close Other</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const keepBtn = document.getElementById('modal-keep-this');
    const closeOtherBtn = document.getElementById('modal-close-other');

    const dismiss = () => {
        overlay.classList.remove('visible');
        
        if (isolationStack.length <= 1) {
            document.body.style.overflow = '';
        }

        restoreIsolation();
        setTimeout(() => overlay.remove(), 400);
    };

    requestAnimationFrame(() => {
        overlay.classList.add('visible');
        isolateModal(overlay);
    });

    keepBtn.onclick = (e) => {
        e.stopPropagation();
        dismiss();
        if (onKeep) onKeep();
    };

    closeOtherBtn.onclick = (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ action: 'CLOSE_TAB_BY_ID', tabId: otherTabId });
        dismiss();
        if (onKeep) onKeep();
    };

    overlay.onkeydown = (e) => {
        if (e.key === 'Tab') {
            const focusables = [keepBtn, closeOtherBtn];
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    last.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === last) {
                    first.focus();
                    e.preventDefault();
                }
            }
        }
        if (e.key === 'Escape') dismiss();
    };
}


