/**
 * Backup Reminder Popup
 * Appears bottom-right on YouTube periodically based on settings.
 */

(function() {
    let reminderActive = false;

    function createReminderUI() {
        if (document.getElementById('ytt-backup-reminder')) return;

        const container = document.createElement('div');
        container.id = 'ytt-backup-reminder';
        
        // Define SVG constants within the function to be self-contained
        const icons = {
            backup: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`,
            close: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
        };

        const css = `
            #ytt-backup-reminder {
                position: fixed;
                bottom: 32px;
                right: 32px;
                width: 380px;
                background: linear-gradient(135deg, rgba(24, 24, 24, 0.85) 0%, rgba(15, 15, 15, 0.95) 100%);
                backdrop-filter: blur(20px) saturate(180%);
                -webkit-backdrop-filter: blur(20px) saturate(180%);
                color: #ffffff;
                border-radius: 20px;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1);
                z-index: 2147483647;
                padding: 24px;
                font-family: "YouTube Sans", Roboto, "Arial", sans-serif;
                display: flex;
                flex-direction: column;
                gap: 16px;
                animation: ytt-premium-slide-up 0.7s cubic-bezier(0.16, 1, 0.3, 1);
            }

            @keyframes ytt-premium-slide-up {
                from { transform: translateY(40px) scale(0.95); opacity: 0; }
                to { transform: translateY(0) scale(1); opacity: 1; }
            }

            #ytt-backup-reminder.closing {
                animation: ytt-premium-slide-down 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }

            @keyframes ytt-premium-slide-down {
                from { transform: translateY(0) scale(1); opacity: 1; }
                to { transform: translateY(40px) scale(0.95); opacity: 0; }
            }

            #ytt-backup-reminder .ytt-header {
                display: flex;
                align-items: center;
                gap: 14px;
            }

            #ytt-backup-reminder .ytt-icon-box {
                background: rgba(225, 29, 72, 0.12);
                width: 44px;
                height: 44px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                box-shadow: 0 4px 12px rgba(225, 29, 72, 0.15);
            }

            #ytt-backup-reminder .ytt-title-group {
                flex: 1;
            }

            #ytt-backup-reminder h3 {
                margin: 0;
                font-size: 17px;
                font-weight: 700;
                color: #ffffff;
                letter-spacing: -0.01em;
            }

            #ytt-backup-reminder .ytt-subtitle {
                font-size: 12px;
                color: #e11d48;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                margin-bottom: 2px;
                display: block;
            }

            #ytt-backup-reminder p {
                margin: 0;
                font-size: 14px;
                color: rgba(255, 255, 255, 0.75);
                line-height: 1.5;
                padding-left: 0;
            }

            #ytt-backup-reminder .ytt-btn-group {
                display: flex;
                gap: 12px;
                margin-top: 6px;
            }

            #ytt-backup-reminder button {
                padding: 12px 20px;
                border-radius: 12px;
                border: none;
                font-size: 14px;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                outline: none;
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }

            #ytt-backup-reminder .download-btn {
                background: #e11d48;
                color: #ffffff;
                box-shadow: 0 4px 15px rgba(225, 29, 72, 0.35);
            }

            #ytt-backup-reminder .download-btn:hover {
                background: #f43f5e;
                transform: translateY(-2px);
                box-shadow: 0 8px 20px rgba(225, 29, 72, 0.45);
            }

            #ytt-backup-reminder .download-btn:active {
                transform: translateY(0);
            }

            #ytt-backup-reminder .download-btn:disabled {
                opacity: 0.7;
                cursor: not-allowed;
                transform: none;
            }

            #ytt-backup-reminder .close-btn {
                background: rgba(255, 255, 255, 0.08);
                color: #ffffff;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            #ytt-backup-reminder .close-btn:hover {
                background: rgba(255, 255, 255, 0.15);
                border-color: rgba(255, 255, 255, 0.2);
            }

            #ytt-backup-reminder .ytt-close-x {
                position: absolute;
                top: 16px;
                right: 16px;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: rgba(255, 255, 255, 0.4);
                cursor: pointer;
                transition: all 0.2s;
            }

            #ytt-backup-reminder .ytt-close-x:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #ffffff;
            }
        `;

        const styleElement = document.createElement('style');
        styleElement.id = 'ytt-reminder-styles';
        styleElement.textContent = css;
        document.head.appendChild(styleElement);

        container.innerHTML = `
            <div class="ytt-close-x" id="ytt-reminder-x">
                ${icons.close}
            </div>
            <div class="ytt-header">
                <div class="ytt-icon-box">
                    ${icons.backup}
                </div>
                <div class="ytt-title-group">
                    <span class="ytt-subtitle">Maintenance</span>
                    <h3>Backup Your Data</h3>
                </div>
            </div>
            <p>It's time to download a fresh backup of your YouTube history and settings to keep them safe.</p>
            <div class="ytt-btn-group">
                <button class="download-btn">Download & Save</button>
                <button class="close-btn">Dismiss</button>
            </div>
        `;

        document.body.appendChild(container);

        const closeReminder = () => {
            container.classList.add('closing');
            
            // Interaction Reset: Ensure the timer starts fresh from dismissal/download
            backupSettings.lastReminderTime = Date.now();
            saveBackupSettings();

            setTimeout(() => {
                container.remove();
                styleElement.remove();
            }, 500);
        };

        container.querySelector('.download-btn').onclick = () => {
            const btn = container.querySelector('.download-btn');
            btn.disabled = true;
            btn.textContent = 'Preparing...';

            chrome.runtime.sendMessage({ action: "CREATE_BACKUP_AND_DOWNLOAD" }, (response) => {
                if (response && response.success && response.data) {
                    downloadBackup(response.data);
                    btn.textContent = 'Saved!';
                    setTimeout(closeReminder, 1000);
                } else {
                    btn.disabled = false;
                    btn.textContent = 'Failed, retry?';
                }
            });
        };

        container.querySelector('.close-btn').onclick = closeReminder;
        container.querySelector('#ytt-reminder-x').onclick = closeReminder;
    }

    function downloadBackup(data) {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).replace(/\s/g, '-').replace(/,/g, '');
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).replace(/\s/g, '').replace(/:/g, '-');
        a.href = url;
        a.download = `ytt-backup_${dateStr}_${timeStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function checkBackupReminder() {
        if (!backupSettings || !backupSettings.reminderEnabled) return;

        let multiplier = 1;
        const unit = backupSettings.reminderUnit;
        if (unit === 'seconds') multiplier = 1/60;
        else if (unit === 'minutes') multiplier = 1;
        else if (unit === 'hours') multiplier = 60;
        else if (unit === 'days') multiplier = 1440;
        else if (unit === 'weeks') multiplier = 10080;

        const intervalMs = backupSettings.reminderInterval * multiplier * 60 * 1000;
        const now = Date.now();
        const lastTime = backupSettings.lastReminderTime || 0;

        if (now - lastTime >= intervalMs) {
            // Don't show if sidebar is open
            const sidebar = document.getElementById('stats-sidebar');
            if (sidebar && sidebar.classList.contains('open')) return;

            // Only show if not already showing
            if (!document.getElementById('ytt-backup-reminder')) {
                createReminderUI();
                // Update lastReminderTime immediately so other tabs don't fire
                backupSettings.lastReminderTime = now;
                saveBackupSettings();
            }
        }
    }

    // Expose to window for bootstrap to call
    window.checkBackupReminder = checkBackupReminder;

    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === "SHOW_BACKUP_REMINDER") {
            createReminderUI();
            // Also update the timer if manually triggered
            backupSettings.lastReminderTime = Date.now();
            saveBackupSettings();
        }
    });

})();
