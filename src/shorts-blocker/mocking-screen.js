// === Mocking Screen: Overlay when user navigates to /shorts/ ===

function removeMockingScreen() {
    const overlay = document.getElementById('shorts-blocker-overlay');
    if (overlay) {
        // Clear the playback killer interval
        const intervalId = overlay.dataset.playbackIntervalId;
        if (intervalId) {
            clearInterval(Number(intervalId));
        }
        overlay.remove();
    }
}

function injectMockingScreen() {
    if (document.getElementById('shorts-blocker-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'shorts-blocker-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: radial-gradient(circle at center, #1b1b1b 0%, #050505 100%);
        color: white;
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2147483647;
        font-family: 'Inter', 'Roboto', Arial, sans-serif;
        text-align: center;
        overflow: hidden;
    `;

    overlay.innerHTML = `
        <div id="civilization-card" style="
            background: rgba(255, 255, 255, 0.03);
            backdrop-filter: blur(40px) saturate(150%);
            -webkit-backdrop-filter: blur(40px) saturate(150%);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 64px 48px;
            border-radius: 40px;
            box-shadow: 0 40px 100px rgba(0, 0, 0, 0.8), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
            max-width: 600px;
            width: 90%;
            display: flex;
            flex-direction: column;
            align-items: center;
            opacity: 0;
            transform: translateY(40px);
            transition: all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
        ">
            <div style="margin-bottom: 40px; animation: ytt-float 4s infinite ease-in-out;">
                <svg width="100" height="70" viewBox="0 0 1024 721" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#FF0000" d="M1013 156c-12-44-47-79-92-91C841 40 512 40 512 40s-329 0-409 25c-45 12-80 47-92 91C-13 237-13 404-13 404s0 167 24 248c12 44 47 80 92 92 80 24 409 24 409 24s329 0 409-24c45-12 80-48 92-92 24-81 24-248 24-248s0-167-24-248z"/>
                    <polygon fill="#FFF" points="408 528 674 404 408 280"/>
                </svg>
            </div>
            
            <h1 style="font-size: 48px; font-weight: 900; margin: 0 0 16px; letter-spacing: -2px; color: #fff; line-height: 1.1;">Shorts Blocked</h1>
            <p style="font-size: 18px; color: rgba(255, 255, 255, 0.6); margin-bottom: 48px; line-height: 1.6; font-weight: 500;">
                Focus on what matters. Your concentration is valuable, <br>
                and today is a great day to be <span style="color: #FF0033; font-weight: 700;">productive</span>.
            </p>
            
            <button id="go-back-btn" class="modal-btn premium-primary" style="width: 240px; height: 56px; font-size: 16px; text-transform: none;">
                Back to Civilization
            </button>
        </div>

        <style>
            @keyframes ytt-float {
                0%, 100% { transform: translateY(0) rotate(0deg); }
                33% { transform: translateY(-15px) rotate(2deg); }
                66% { transform: translateY(-5px) rotate(-1deg); }
            }
            #shorts-blocker-overlay::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 600px;
                height: 600px;
                background: radial-gradient(circle, rgba(255, 0, 51, 0.08) 0%, transparent 70%);
                transform: translate(-50%, -50%);
                pointer-events: none;
                z-index: -1;
            }
        </style>
    `;

    document.documentElement.appendChild(overlay);

    // Staggered Entrance Animation
    requestAnimationFrame(() => {
        const card = document.getElementById('civilization-card');
        if (card) {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }
    });

    document.getElementById('go-back-btn').onclick = (e) => {
        e.preventDefault();
        window.location.href = 'https://www.youtube.com';
    };

    // Kill playback
    const killPlayback = () => {
        const media = document.querySelectorAll('video, audio');
        media.forEach(m => {
            m.pause();
            m.muted = true;
            m.volume = 0;
            m.currentTime = 0;
            m.style.display = 'none';
        });
    };
    
    killPlayback();
    const playbackInterval = setInterval(killPlayback, 100);
    overlay.dataset.playbackIntervalId = playbackInterval;
}
