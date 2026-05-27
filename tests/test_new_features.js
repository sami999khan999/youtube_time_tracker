/**
 * Tests for recently implemented features:
 * 1. Deletion Watch Time Correction
 * 2. Re-tracking Currently Playing Video After Deletion
 * 3. Active Time Heartbeat Tracking
 */

const fs = require('fs');
const vm = require('vm');

const RealDate = global.Date;
let mockedNow = new RealDate('2026-04-07T12:00:00Z');

function createMockContext() {
    const jest = {
        fn: (initialImpl = () => {}) => {
            let currentImpl = initialImpl;
            const fn = (...args) => { fn.mock.calls.push(args); return currentImpl(...args); };
            fn.mock = { calls: [] };
            fn.mockImplementation = (newImpl) => { currentImpl = newImpl; };
            return fn;
        }
    };

    const ctx = {
        console, global: {},
        Date: class extends RealDate {
            constructor(arg) { if (arg) return new RealDate(arg); return new RealDate(mockedNow); }
            static now() { return mockedNow.getTime(); }
        },
        chrome: {
            storage: {
                local: { get: jest.fn(), set: jest.fn() },
                onChanged: { addListener: jest.fn() }
            },
            runtime: { onMessage: { addListener: jest.fn() }, sendMessage: jest.fn(), lastError: null, id: 'test' },
            tabs: { remove: jest.fn() }
        },
        document: {
            querySelector: jest.fn(() => null),
            querySelectorAll: jest.fn(() => []),
            createElement: jest.fn(() => ({ style: {}, classList: { add: jest.fn() }, appendChild: jest.fn() })),
            documentElement: { style: {} },
            addEventListener: jest.fn(),
            body: { appendChild: jest.fn() },
            getElementById: jest.fn(() => null)
        },
        window: {
            location: { search: '?v=vid1', href: 'https://www.youtube.com/watch?v=vid1' },
            addEventListener: jest.fn(), setTimeout: jest.fn((fn) => fn()), setInterval: jest.fn()
        },
        navigator: { userAgent: 'Mozilla/5.0' },
        isFinite: Number.isFinite,
        fetch: jest.fn(() => Promise.resolve({ json: () => Promise.resolve([]) })),
        MutationObserver: class { observe() {} disconnect() {} },
        Set: global.Set, Math: global.Math, Object: global.Object,
        Array: global.Array, String: global.String, Number: global.Number,
        Boolean: global.Boolean, RegExp: global.RegExp, Promise: global.Promise,
        parseFloat: global.parseFloat, parseInt: global.parseInt,
    };
    ctx.global = ctx;
    vm.createContext(ctx);
    return ctx;
}

let passed = 0, failed = 0;
function assert(testName, condition, detail = '') {
    if (condition) {
        console.log(`   ✅ ${testName}${detail ? ': ' + detail : ''}`);
        passed++;
    } else {
        console.log(`   ❌ ${testName}${detail ? ': ' + detail : ''}`);
        failed++;
    }
}

function loadBackground(ctx) {
    let code = fs.readFileSync('background.js', 'utf-8');
    code = code.replace('let allHistory = {};', 'var allHistory = {};');
    code = code.replace('let shortsBlockerSettings = { enabled: true };', 'var shortsBlockerSettings = { enabled: true };');
    code = code.replace('let breakSettings =', 'var breakSettings =');
    new vm.Script(code).runInContext(ctx);
}

// ============================================================
// TEST 1: Deletion Watch Time Correction
// ============================================================
function testDeletionWatchTimeCorrection() {
    console.log('\n── Test 1: Deletion Watch Time Correction ──');
    const ctx = createMockContext();
    loadBackground(ctx);

    const today = ctx.getDayKey();

    // Add two videos with known durations
    ctx.handleWatchTimeReport({ delta: 300, videoId: 'vid1', videoTitle: 'Video 1', currentPosition: 300, totalDuration: 600 });
    ctx.handleWatchTimeReport({ delta: 200, videoId: 'vid2', videoTitle: 'Video 2', currentPosition: 200, totalDuration: 400 });

    assert('Initial watchTime', ctx.allHistory[today].watchTime === 500, `Expected 500, got ${ctx.allHistory[today].watchTime}`);
    assert('Initial video count', ctx.allHistory[today].videos.length === 2, `Expected 2, got ${ctx.allHistory[today].videos.length}`);

    // Delete video 1 (300s)
    ctx.handleDeleteVideo(`${today}_vid1`);

    assert('watchTime decreased', ctx.allHistory[today].watchTime === 200, `Expected 200, got ${ctx.allHistory[today].watchTime}`);
    assert('Video removed', ctx.allHistory[today].videos.length === 1, `Expected 1, got ${ctx.allHistory[today].videos.length}`);
    assert('Remaining video correct', ctx.allHistory[today].videos[0].id === 'vid2');

    // Edge case: Delete last video
    ctx.handleDeleteVideo(`${today}_vid2`);
    assert('watchTime is zero', ctx.allHistory[today].watchTime === 0, `Expected 0, got ${ctx.allHistory[today].watchTime}`);
    assert('No videos left', ctx.allHistory[today].videos.length === 0);

    // Edge case: Delete non-existent video should not crash
    ctx.handleDeleteVideo(`${today}_nonexistent`);
    assert('Delete non-existent no crash', ctx.allHistory[today].watchTime === 0, 'No crash on missing uid');

    // Edge case: Delete video with 0 watchedDuration
    ctx.handleWatchTimeReport({ delta: 0, videoId: 'vid3', videoTitle: 'Video 3' });
    ctx.handleDeleteVideo(`${today}_vid3`);
    assert('Delete zero-duration OK', ctx.allHistory[today].watchTime === 0, 'WatchTime stays 0');
}

// ============================================================
// TEST 2: Re-tracking Currently Playing Video After Deletion
// ============================================================
function testReTrackCurrentVideo() {
    console.log('\n── Test 2: Re-track Currently Playing Video ──');
    const ctx = createMockContext();

    // Load state.js with const→var replacements to avoid redeclaration errors in VM
    let stateCode = fs.readFileSync('src/shared/state.js', 'utf-8');
    stateCode = stateCode.replace(/^const storage/m, 'var storage');
    stateCode = stateCode.replace(/^const runtime/m, 'var runtime');
    stateCode = stateCode.replace(/^let allHistory/m, 'var allHistory');
    stateCode = stateCode.replace(/^let deletedUids/m, 'var deletedUids');
    stateCode = stateCode.replace(/^let currentUid/m, 'var currentUid');
    stateCode = stateCode.replace(/^let /gm, 'var ');
    new vm.Script(stateCode).runInContext(ctx);

    const today = ctx.getDayKey();

    // Simulate: user is watching vid1
    ctx.currentUid = `${today}_vid1`;

    // Delete current video — should NOT be blacklisted
    ctx.deleteHistoryVideo(`${today}_vid1`);
    assert('Current video NOT blacklisted', !ctx.deletedUids.has(`${today}_vid1`), 'Should not be in deletedUids');

    // Delete a DIFFERENT video — should be blacklisted
    ctx.currentUid = `${today}_vid1`; // still watching vid1
    ctx.deleteHistoryVideo(`${today}_vid2`);
    assert('Other video IS blacklisted', ctx.deletedUids.has(`${today}_vid2`), 'Should be in deletedUids');
}

// ============================================================
// TEST 3: Active Time Heartbeat
// ============================================================
function testActiveTimeHeartbeat() {
    console.log('\n── Test 3: Active Time Heartbeat ──');
    const ctx = createMockContext();
    loadBackground(ctx);

    const today = ctx.getDayKey();

    // Simulate 5 seconds of video watching
    for (let i = 0; i < 5; i++) {
        ctx.handleWatchTimeReport({ delta: 1, videoId: 'vid1', videoTitle: 'V1', currentPosition: i, totalDuration: 300 });
    }

    assert('activeTime tracks video', ctx.allHistory[today].activeTime === 5, `Expected 5, got ${ctx.allHistory[today].activeTime}`);
    assert('watchTime matches', ctx.allHistory[today].watchTime === 5, `Expected 5, got ${ctx.allHistory[today].watchTime}`);

    // Simulate heartbeat-only (no video, delta=0) — browsing homepage
    ctx.handleWatchTimeReport({ delta: 0 });
    ctx.handleWatchTimeReport({ delta: 0 });
    ctx.handleWatchTimeReport({ delta: 0 });

    assert('activeTime includes heartbeats', ctx.allHistory[today].activeTime === 8, `Expected 8, got ${ctx.allHistory[today].activeTime}`);
    assert('watchTime unchanged by heartbeats', ctx.allHistory[today].watchTime === 5, `Expected 5, got ${ctx.allHistory[today].watchTime}`);

    // Edge case: Clear history should reset activeTime
    ctx.handleClearHistory();
    const newToday = ctx.getDayKey();
    assert('activeTime reset on clear', ctx.allHistory[newToday].activeTime === 0, `Expected 0, got ${ctx.allHistory[newToday].activeTime}`);
}

// ============================================================
// TEST 4: Edge Cases
// ============================================================
function testEdgeCases() {
    console.log('\n── Test 4: Edge Cases ──');
    const ctx = createMockContext();
    loadBackground(ctx);

    const today = ctx.getDayKey();

    // Edge: Negative delta should not affect anything
    ctx.handleWatchTimeReport({ delta: 100, videoId: 'vid1', videoTitle: 'V1' });
    ctx.handleWatchTimeReport({ delta: -50, videoId: 'vid1' });
    assert('Negative delta ignored for watchTime', ctx.allHistory[today].watchTime === 100, `Expected 100, got ${ctx.allHistory[today].watchTime}`);

    // Edge: Very large delta (e.g., tab was backgrounded for hours)
    ctx.handleWatchTimeReport({ delta: 36000, videoId: 'vid2', videoTitle: 'V2' });
    assert('Large delta accepted', ctx.allHistory[today].watchTime === 36100, `Expected 36100, got ${ctx.allHistory[today].watchTime}`);

    // Edge: Multiple deletes of same uid
    ctx.handleDeleteVideo(`${today}_vid1`);
    ctx.handleDeleteVideo(`${today}_vid1`); // Second delete of already-removed video
    assert('Double delete no crash', ctx.allHistory[today].videos.length === 1, `Expected 1, got ${ctx.allHistory[today].videos.length}`);

    // Edge: activeTime survives when all videos deleted
    const activeTimeBefore = ctx.allHistory[today].activeTime;
    ctx.handleDeleteVideo(`${today}_vid2`);
    assert('activeTime preserved after all deletions', ctx.allHistory[today].activeTime === activeTimeBefore, `Expected ${activeTimeBefore}`);
}

// ============================================================
// RUN ALL
// ============================================================
console.log('🧪 Running New Feature Tests...');
testDeletionWatchTimeCorrection();
testReTrackCurrentVideo();
testActiveTimeHeartbeat();
testEdgeCases();

console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
if (failed > 0) {
    console.log('❌ SOME TESTS FAILED');
    process.exit(1);
} else {
    console.log('✅ ALL TESTS PASSED');
}
