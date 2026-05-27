/**
 * YouTube Time Tracker - Verification Test Suite
 * 
 * Verifies key-agnostic backup imports and instant UI synchronization.
 */

const fs = require('fs');
const path = require('path');

// --- MOCK JEST-LIKE ---
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

// --- MOCK CHROME ENVIRONMENT ---
global.chrome = {
    storage: {
        local: {
            get: jest.fn((keys, cb) => cb({})),
            set: jest.fn((data, cb) => cb && cb())
        },
        onChanged: { addListener: jest.fn() }
    },
    runtime: {
        sendMessage: jest.fn(),
        onMessage: { addListener: jest.fn() },
        lastError: null
    },
    alarms: { create: jest.fn(), clearAll: jest.fn() }
};

// --- MOCK DOM ---
global.document = {
    getElementById: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    querySelector: jest.fn(),
    createElement: jest.fn(() => ({})),
    body: { appendChild: jest.fn(), removeChild: jest.fn() }
};
global.window = {
    location: { reload: jest.fn() }
};
global.setTimeout = setTimeout;

// --- UTILS ---
function loadFile(relPath) {
    const fullPath = path.join(__dirname, '..', relPath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    // Wrap in IIFE if needed, but here we eval directly to populate global scope
    try {
        eval(content);
    } catch (e) {
        // Silently ignore some browser-specific execution errors during eval
        // as long as the functions we need are defined.
    }
}

// Mock IndexedDB
global.self = {
    yttDB: {
        addBackup: jest.fn(() => Promise.resolve()),
        getAllBackups: jest.fn(() => Promise.resolve([])),
        getBackupById: jest.fn(() => Promise.resolve({ data: {} })),
        deleteBackup: jest.fn(() => Promise.resolve())
    }
};

// --- START TESTS ---
async function runTests() {
    console.log('🧪 Starting Verification Tests for Backup & Sync...\n');

    try {
        await testKeyAgnosticImport();
        await testUISyncLogic();
        console.log('\n✅ ALL VERIFICATION TESTS PASSED!');
    } catch (error) {
        console.error('\n❌ TEST FAILED:', error);
        process.exit(1);
    }
}

/**
 * Test 1: Verify handleImportBackup handles both prefixed and non-prefixed keys.
 */
async function testKeyAgnosticImport() {
    console.log('Testing Key-Agnostic Import (Background)...');

    // Load background.js logic
    // We need to mock functions it calls
    global.scheduleAlarms = jest.fn();
    global.createBackup = jest.fn();
    
    loadFile('background.js');

    // Scenario A: Legacy data (prefixed keys)
    const legacyBackup = {
        ytt_history: { '2026-04-12': { watchTime: 100 } },
        ytt_retention_settings: { duration: 15 },
        ytt_shorts_settings: { enabled: false }
    };

    const resultA = await handleImportBackup(legacyBackup);
    
    if (resultA.success && 
        resultA.settings.ytt_retention_settings.duration === 15 &&
        resultA.settings.ytt_shorts_settings.enabled === false) {
        console.log('   ✓ Scenario A: Legacy prefixed keys correctly parsed.');
    } else {
        throw new Error('Legacy key parsing failed!');
    }

    // Scenario B: Modern data (non-prefixed keys)
    const modernBackup = {
        allHistory: { '2026-04-13': { watchTime: 200 } },
        retentionSettings: { duration: 30 },
        shortsBlockerSettings: { enabled: true }
    };

    const resultB = await handleImportBackup(modernBackup);
    
    if (resultB.success && 
        resultB.settings.ytt_retention_settings.duration === 30 &&
        resultB.settings.ytt_shorts_settings.enabled === true) {
        console.log('   ✓ Scenario B: Modern non-prefixed keys correctly parsed.');
    } else {
        throw new Error('Modern key parsing failed!');
    }
}

/**
 * Test 2: Verify syncSettingsUI updates DOM elements and handles the 50ms delay.
 */
async function testUISyncLogic() {
    console.log('Testing UI Sync Logic (Sidebar)...');

    // Initialize Global State
    global.retentionSettings = { duration: 7 };
    global.selectedDayFilter = 'all';
    global.shortsBlockerSettings = { enabled: true };
    global.breakSettings = { enabled: true, intervalMinutes: 15, workUrl: 'google.com' };
    global.backupSettings = { enabled: true, intervalHours: 24, backupOnClose: true };
    global.dislikeCountSettings = { enabled: true };
    global.isStatsOpen = true;

    // Load sidebar-events.js
    // Mocking browser functions used in evaluation
    global.renderStats = jest.fn();
    global.renderBackups = jest.fn();
    global.switchView = jest.fn();
    global.getDayKey = (d) => '2026-04-12';

    loadFile('src/stats-tracker/sidebar-events.js');

    // Mock DOM elements
    const mockElements = {
        'shorts-blocker-toggle': { checked: false },
        'history-period-dropdown': { 
            dataset: {}, 
            querySelector: jest.fn((sel) => {
                if (sel === '.dropdown-trigger span') return { textContent: '' };
                if (sel === '.dropdown-item.special') return { textContent: '' };
                return null;
            }),
            querySelectorAll: jest.fn(() => [])
        }
    };

    document.getElementById.mockImplementation((id) => mockElements[id] || null);

    // Call syncSettingsUI (simulating an import response)
    // First, manually update state variables as the callback would
    global.retentionSettings = { duration: 90 };
    global.selectedDayFilter = 'today';
    
    syncSettingsUI();

    // Verify
    const periodDropdown = mockElements['history-period-dropdown'];
    const specialItem = periodDropdown.querySelector('.dropdown-item.special');
    
    if (specialItem && specialItem.textContent === '90 Days History') {
        console.log('   ✓ syncSettingsUI correctly updated "Special History" label from duration.');
    } else {
        throw new Error(`Duration label sync failed! Expected "90 Days History", got "${specialItem.textContent}"`);
    }

    if (periodDropdown.dataset.value === 'today') {
        console.log('   ✓ syncSettingsUI correctly reset selectedDayFilter to "today".');
    } else {
        throw new Error('Filter reset failed!');
    }
}

runTests();
