const fs = require('fs');
const vm = require('vm');

// --- JEST-LIKE MOCK UTILITY ---
const jest = {
    fn: (initialImpl = () => {}) => {
        let currentImpl = initialImpl;
        const fn = (...args) => {
            fn.mock.calls.push(args);
            return currentImpl(...args);
        };
        fn.mock = { calls: [] };
        fn.mockImplementation = (newImpl) => { currentImpl = newImpl; };
        return fn;
    }
};

// --- MOCK ENVIRONMENT ---
const RealDate = global.Date;
let mockedNow = new RealDate('2026-04-03T12:00:00Z');

const mockContext = {
    console,
    global: {},
    Date: class extends RealDate {
        constructor(arg) {
            if (arg) return new RealDate(arg);
            return new RealDate(mockedNow);
        }
        static now() { return mockedNow.getTime(); }
    },
    chrome: {
        storage: {
            local: {
                get: jest.fn(),
                set: jest.fn(),
                onChanged: { addListener: jest.fn() }
            }
        },
        runtime: {
            onMessage: { addListener: jest.fn() },
            sendMessage: jest.fn(),
            lastError: null
        },
        tabs: { remove: jest.fn(), query: jest.fn() }
    },
    document: {
        querySelector: jest.fn(),
        querySelectorAll: jest.fn(() => []),
        createElement: jest.fn(() => ({ style: {}, classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn() }, appendChild: jest.fn(), querySelector: jest.fn() })),
        documentElement: { style: {} },
        addEventListener: jest.fn(),
        body: { appendChild: jest.fn(), removeChild: jest.fn() },
        getElementById: jest.fn(() => ({ style: {}, classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn() }, appendChild: jest.fn(), querySelector: jest.fn() }))
    },
    window: {
        location: { search: '?v=initialVid', href: 'https://www.youtube.com/watch?v=initialVid' },
        addEventListener: jest.fn(),
        scrollTo: jest.fn(),
        setTimeout: jest.fn((fn) => fn()),
        setInterval: jest.fn()
    },
    navigator: { userAgent: 'Mozilla/5.0' },
    isFinite: Number.isFinite,
    fetch: jest.fn(() => Promise.resolve({ json: () => Promise.resolve([{ q: 'Mocked Quote', a: 'Mocked Author' }]) })),
    MutationObserver: class { observe() {} disconnect() {} },
    Set: global.Set,
    Math: global.Math,
    Object: global.Object,
    Array: global.Array,
    String: global.String,
    Number: global.Number,
    Boolean: global.Boolean,
    RegExp: global.RegExp,
    Promise: global.Promise
};
mockContext.global = mockContext;
vm.createContext(mockContext);

// --- COMPREHENSIVE TEST SUITE ---
const results = [];
function report(scenario, passed, note = '') {
    results.push({ scenario, status: passed ? '✅ PASSED' : '❌ FAILED', note });
}

async function runAllTests() {
    console.log('🧪 Starting Comprehensive Scenario Verification (VM Mode)...\n');

    try {
        await testWatchTracking();
        await testAnalytics();
        await testProductivity();
        await testDataManagement();
        await testUserExperience();
    } catch (e) {
        console.error('Test Execution Error:', e);
    }

    console.table(results);
    const failures = results.filter(r => r.status.includes('FAILED'));
    if (failures.length > 0) process.exit(1);
}

// --- CATEGORY: WATCH TRACKING ---
async function testWatchTracking() {
    console.log('Testing Watch Tracking...');
    
    // Create fresh context for each category to avoid pollution
    let bgCode = fs.readFileSync('background.js', 'utf-8');
    bgCode = bgCode.replace('let allHistory = {};', 'var allHistory = {};');
    bgCode = bgCode.replace('let shortsBlockerSettings = { enabled: true };', 'var shortsBlockerSettings = { enabled: true };');
    bgCode = bgCode.replace('let breakSettings =', 'var breakSettings =');
    const script = new vm.Script(bgCode);
    script.runInContext(mockContext);
    
    // Scenario: Single Session
    mockContext.handleWatchTimeReport({ action: 'REPORT_WATCH_TIME', delta: 10, videoId: 'v1', videoTitle: 'T1', currentPosition: 100, totalDuration: 600 });
    const today = mockContext.getDayKey();
    report('Single Session', mockContext.allHistory[today]?.videos[0]?.watchedDuration === 10, 'Tracked 10s correctly.');

    // Scenario: Multi-Tab Sync
    mockContext.handleWatchTimeReport({ action: 'REPORT_WATCH_TIME', delta: 5, videoId: 'v1' }); 
    mockContext.handleWatchTimeReport({ action: 'REPORT_WATCH_TIME', delta: 5, videoId: 'v1' }); 
    report('Multi-Tab Sync', mockContext.allHistory[today]?.videos[0]?.watchedDuration === 20, 'Aggregated time correctly.');

    // Scenario: Cross-Midnight
    mockedNow = new Date('2026-04-03T23:59:59Z');
    mockContext.handleWatchTimeReport({ action: 'REPORT_WATCH_TIME', delta: 1, videoId: 'v2' });
    mockedNow = new Date('2026-04-04T00:00:01Z');
    mockContext.handleWatchTimeReport({ action: 'REPORT_WATCH_TIME', delta: 1, videoId: 'v2' });
    report('Cross-Midnight', mockContext.allHistory['2026-04-03']?.videos.length === 2 && mockContext.allHistory['2026-04-04']?.videos.length === 1, 'Split across days.');

    // Scenario: Auto-Play Guard
    const videoA = mockContext.allHistory['2026-04-04'].videos[0];
    let trackingCode = fs.readFileSync('src/stats-tracker/tracking.js', 'utf-8');
    trackingCode = 'var lastWatchTimeUpdate = Date.now(); var lastVideoId = "";' + trackingCode;
    const trackingScript = new vm.Script(trackingCode);
    trackingScript.runInContext(mockContext);
    
    const mockVid = { duration: 180, currentTime: 0.5, paused: false, ended: false, readyState: 4 };
    mockContext.document.querySelector.mockImplementation(() => mockVid);
    mockContext.activeVideo = videoA;
    mockContext.currentUid = videoA.uid;
    
    mockContext.updateStats('v2', false); 
    report('Auto-Play Guard', videoA.totalDuration !== 180, 'Prevented metadata leak.');
}


// --- CATEGORY: ANALYTICS ---
async function testAnalytics() {
    console.log('Testing Analytics...');
    const script = new vm.Script(fs.readFileSync('src/stats-tracker/analytics-render.js', 'utf-8'));
    script.runInContext(mockContext);
    
    mockContext.renderBarChart = jest.fn();
    mockContext.renderPieChart = jest.fn();
    mockContext.allHistory = { '2026-04-04': { watchTime: 3600, videos: [{ title: 'V1', watchedDuration: 3600 }] } };
    mockContext.selectedDayFilter = 'today';
    mockedNow = new Date('2026-04-04T12:00:00Z');
    
    mockContext.renderAnalyticsView();
    report('Trend Analysis', mockContext.renderBarChart.mock.calls.length > 0, 'Trend chart rendered.');
    report('Watch Distribution', mockContext.renderPieChart.mock.calls.length > 0, 'Pie chart rendered.');
}

// --- CATEGORY: PRODUCTIVITY ---
async function testProductivity() {
    console.log('Testing Productivity...');
    const blockerScript = new vm.Script(fs.readFileSync('src/shorts-blocker/blocker.js', 'utf-8'));
    blockerScript.runInContext(mockContext);
    
    const mockShort = { style: { display: '' }, querySelector: () => ({ href: '/shorts/123' }) };
    mockContext.document.querySelectorAll.mockImplementation(() => [mockShort]);
    mockContext.shortsBlockerSettings = { enabled: true };
    
    mockContext.hideShortsFromFeed();
    report('Shorts Blocker', mockShort.style.display === 'none', 'Shorts hidden.');

    const reminderScript = new vm.Script(fs.readFileSync('src/break-reminder/reminder.js', 'utf-8'));
    reminderScript.runInContext(mockContext);
    
    mockContext.showBreakReminderModal = jest.fn();
    mockContext.breakSettings = { enabled: true, intervalMinutes: 1 };
    mockContext.checkBreakReminder(61);
    report('Break Reminder', mockContext.showBreakReminderModal.mock.calls.length > 0, 'Reminder triggered.');
}

// --- CATEGORY: DATA MANAGEMENT ---
async function testDataManagement() {
    console.log('Testing Data Management...');
    const history = { '2026-04-04': {}, '2026-03-01': {} };
    const cleaned = mockContext.cleanupOldHistory(history);
    report('Auto-Retention', !cleaned['2026-03-01'], 'Old data purged.');

    mockContext.handleClearHistory();
    report('Full Data Wipe', Object.keys(mockContext.allHistory).length === 1, 'History cleared.');
}

// --- CATEGORY: USER EXPERIENCE ---
async function testUserExperience() {
    console.log('Testing UX...');
    const historyScript = new vm.Script(fs.readFileSync('src/stats-tracker/history-render.js', 'utf-8'));
    historyScript.runInContext(mockContext);
    
    const mockItem = { classList: { toggle: jest.fn() }, previousElementSibling: true };
    const mockList = { 
        innerHTML: '', 
        querySelectorAll: () => [], 
        querySelector: () => mockItem, 
        prepend: jest.fn() 
    };
    mockContext.document.getElementById.mockReturnValue(mockList);
    
    mockContext.activeView = 'history';
    mockContext.currentUid = 'u1';
    mockContext.displayVideos = [{ uid: 'u1', lastUpdated: Date.now(), watchedDuration: 1, totalDuration: 10 }];
    
    mockContext.renderStats(); 
    report('Active Priority Top', mockList.prepend.mock.calls.length > 0, 'Playing video moved to top.');
}

runAllTests();
