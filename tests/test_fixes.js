/**
 * Integration Test for YouTube Time Tracker
 * 
 * This script mocks the Chrome extension environment to verify the fixes
 * for history deletion (race condition) and metadata overwrite.
 */

const fs = require('fs');
const path = require('path');

// --- JEST MOCK ---
const jest = {
    fn: (initialImpl = () => {}) => {
        let currentImpl = initialImpl;
        const fn = (...args) => {
            fn.mock.calls.push(args);
            return currentImpl(...args);
        };
        fn.mock = { calls: [] };
        fn.mockImplementation = (newImpl) => {
            currentImpl = newImpl;
        };
        return fn;
    }
};

// --- MOCK ENVIRONMENT ---
global.chrome = {
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn()
        }
    },
    runtime: {
        onMessage: {
            addListener: jest.fn()
        },
        sendMessage: jest.fn(),
        lastError: null
    },
    tabs: {
        remove: jest.fn()
    }
};

// Helper to load a script into the global scope
function loadScript(filePath) {
    const code = fs.readFileSync(path.join(__dirname, filePath), 'utf-8');
    eval(code);
}

// --- TEST CASES ---

async function runTests() {
    console.log('🚀 Starting YouTube Time Tracker Integration Tests...\n');

    try {
        await testRaceConditionFix();
        await testMetadataOverwriteFix();
        await testCleanupLogic();
        console.log('\n✅ ALL TESTS PASSED!');
    } catch (error) {
        console.error('\n❌ TEST FAILED:', error);
        process.exit(1);
    }
}

/**
 * Test 3: Verify the background script correctly cleans up history older than 7 days.
 */
async function testCleanupLogic() {
    console.log('Testing 7-Day Cleanup Logic...');

    // Mock Date globally to "2026-04-10"
    const RealDate = global.Date;
    const mockToday = new RealDate('2026-04-10T12:00:00Z');
    global.Date = class extends RealDate {
        constructor(arg) {
            if (arg) return new RealDate(arg);
            return new RealDate(mockToday);
        }
        static now() {
            return mockToday.getTime();
        }
    };

    // Load background.js logic to get the cleanupOldHistory function
    const backgroundCode = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf-8');
    eval(backgroundCode);

    const mockHistory = {
        '2026-04-10': { watchTime: 100 }, // Today (Keep)
        '2026-04-04': { watchTime: 200 }, // 6 days ago (Keep)
        '2026-04-03': { watchTime: 300 }, // 7 days ago (Keep)
        '2026-04-02': { watchTime: 400 }, // 8 days ago (Delete)
        '2026-03-01': { watchTime: 500 }  // Long ago (Delete)
    };

    const cleaned = cleanupOldHistory(mockHistory);

    // Restore Date immediately so we don't break other things
    global.Date = RealDate;

    if (cleaned['2026-04-10'] && cleaned['2026-04-04'] && cleaned['2026-04-03'] && 
        !cleaned['2026-04-02'] && !cleaned['2026-03-01']) {
        console.log('   ✓ Old history correctly purged (7-day retention enforced).');
    } else {
        console.log('Cleaned keys:', Object.keys(cleaned));
        throw new Error('Cleanup logic failed to purge correct records!');
    }
}



/**
 * Test 1: Verify the background script waits for storage load before overwriting.
 */
async function testRaceConditionFix() {
    console.log('Testing Race Condition Fix...');
    
    // Reset mocks
    let messageHandler;
    chrome.runtime.onMessage.addListener = (handler) => { messageHandler = handler; };
    
    // Load background.js logic
    const backgroundCode = fs.readFileSync(path.join(__dirname, 'background.js'), 'utf-8');
    
    // Controlled storage load
    let resolveStorage;
    chrome.storage.local.get = (keys, cb) => {
        // Capture callback to resolve later
        resolveStorage = () => cb({ ytt_history: { '2026-04-01': { watchTime: 100, videos: [] } } });
    };

    // Execute background.js
    eval(backgroundCode);

    // 1. Send message BEFORE storage resolves
    const sendResponse = jest.fn();
    messageHandler({ action: 'REPORT_WATCH_TIME', delta: 10, videoId: 'new_vid' }, {}, sendResponse);

    // Verify: allHistory should NOT be overwritten yet
    // Wait a bit to ensure async processing
    await new Promise(r => setTimeout(r, 100));

    // Now resolve storage
    resolveStorage();
    
    // Wait for loadPromise.then() to execute
    await new Promise(r => setTimeout(r, 100));

    // Verify currentDay was added TO the existing history
    // check chrome.storage.local.set calls
    const setCalls = chrome.storage.local.set.mock.calls;
    const lastSet = setCalls[setCalls.length - 1][0];
    
    if (lastSet.ytt_history['2026-04-01'] && lastSet.ytt_history['2026-04-01'].watchTime === 100) {
        console.log('   ✓ History preserved across race condition.');
    } else {
        throw new Error('History was OVERWRITTEN during race condition!');
    }
}

/**
 * Test 2: Verify metadata guards prevent overwriting old video data with new video duration.
 */
async function testMetadataOverwriteFix() {
    console.log('Testing Metadata Overwrite Fix...');

    // Mock DOM and globals used in tracking.js
    global.document = {
        querySelector: jest.fn(),
        documentElement: {},
        addEventListener: jest.fn()
    };
    global.window = {
        location: { search: '?v=videoA' },
        addEventListener: jest.fn()
    };
    global.isFinite = Number.isFinite;
    global.isStatsOpen = false;
    global.getDayKey = () => '2026-04-03';
    global.deletedUids = new Set();
    global.lastWatchTimeUpdate = Date.now();
    global.lastVideoId = 'videoA';
    global.allHistory = {
        '2026-04-03': {
            videos: [{
                uid: '2026-04-03_videoA',
                id: 'videoA',
                watchedDuration: 599,
                currentPosition: 599,
                totalDuration: 600
            }]
        }
    };
    global.safeSendMessage = jest.fn();

    // Load tracking.js
    const trackingCode = fs.readFileSync(path.join(__dirname, 'src/stats-tracker/tracking.js'), 'utf-8');
    eval(trackingCode);

    // Scenario: Video A is done. Video B starts (Duration 180, Time 0.5) 
    // but videoId is still 'videoA' (stale DOM).
    const mockVideo = {
        duration: 180,
        currentTime: 0.5,
        paused: false,
        ended: false,
        readyState: 4
    };
    document.querySelector.mockImplementation((selector) => {
        if (selector.includes('video')) return mockVideo;
        return null;
    });

    // Call updateStats
    updateStats('videoA', false);

    // Verify that Video A's totalDuration is still 600, not 180
    const videoA = allHistory['2026-04-03'].videos[0];
    if (videoA.totalDuration === 600 && videoA.currentPosition === 599) {
        console.log('   ✓ Metadata preserved during transition (mismatch guard worked).');
    } else {
        throw new Error(`Video metadata was polluted! Duration: ${videoA.totalDuration}, Position: ${videoA.currentPosition}`);
    }
}

runTests();

