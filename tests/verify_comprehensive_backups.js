/**
 * Diagnostic Test Suite: Comprehensive Backups & Settings Sync
 * 
 * Verifies:
 * 1. Background real-time sync via storage listener.
 * 2. Backup data integrity (contains all settings/hotkeys).
 * 3. Import/Restore logic completeness.
 */

const fs = require('fs');
const vm = require('vm');

const RealDate = global.Date;
let mockedNow = new RealDate('2026-04-19T12:00:00Z');

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
        console, 
        global: {},
        Date: class extends RealDate {
            constructor(arg) { if (arg) return new RealDate(arg); return new RealDate(mockedNow); }
            static now() { return mockedNow.getTime(); }
        },
        chrome: {
            storage: {
                local: { 
                    get: jest.fn((keys, cb) => cb({})), 
                    set: jest.fn((obj, cb) => cb && cb()) 
                },
                onChanged: { addListener: jest.fn() }
            },
            runtime: { 
                onMessage: { addListener: jest.fn() }, 
                sendMessage: jest.fn(), 
                lastError: null 
            },
            alarms: {
                clear: jest.fn((name, cb) => cb && cb()),
                create: jest.fn(),
                onAlarm: { addListener: jest.fn() }
            },
            tabs: {
                onUpdated: { addListener: jest.fn() },
                onRemoved: { addListener: jest.fn() },
                query: jest.fn((q, cb) => cb([])),
                sendMessage: jest.fn()
            },
            commands: {
                onCommand: { addListener: jest.fn() }
            }
        },
        self: {
            yttDB: {
                addBackup: jest.fn(() => Promise.resolve()),
                getAllBackups: jest.fn(() => Promise.resolve([])),
                getBackupById: jest.fn(() => Promise.resolve({})),
                clearAllBackups: jest.fn(() => Promise.resolve())
            }
        },
        document: {
            querySelector: jest.fn(() => null),
            createElement: jest.fn(() => ({ style: {}, classList: { add: jest.fn() } })),
            documentElement: { style: {} },
            head: { appendChild: jest.fn() }
        },
        window: {
            addEventListener: jest.fn(),
            setTimeout: jest.fn((fn) => fn()),
            setInterval: jest.fn()
        },
        MutationObserver: class { observe() {} disconnect() {} },
        Set: global.Set, Math: global.Math, Object: global.Object,
        Array: global.Array, String: global.String, Number: global.Number,
        Promise: global.Promise, Map: global.Map,
        fetch: jest.fn(() => Promise.resolve({ json: () => Promise.resolve([]) })),
        cleanupOldHistory: (h) => h,
        getDayKey: () => '2026-04-19'
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
    // Replace const/let with var for shared scope in VM
    code = code.replace(/const\s+storage/g, 'var storage');
    code = code.replace(/let\s+allHistory/g, 'var allHistory');
    code = code.replace(/let\s+shortsBlockerSettings/g, 'var shortsBlockerSettings');
    code = code.replace(/let\s+breakSettings/g, 'var breakSettings');
    code = code.replace(/let\s+backupSettings/g, 'var backupSettings');
    code = code.replace(/let\s+retentionSettings/g, 'var retentionSettings');
    code = code.replace(/let\s+dislikeCountSettings/g, 'var dislikeCountSettings');
    code = code.replace(/let\s+opacitySettings/g, 'var opacitySettings');
    code = code.replace(/let\s+smartFullscreenSettings/g, 'var smartFullscreenSettings');
    code = code.replace(/let\s+keybindSettings/g, 'var keybindSettings');
    
    try {
        new vm.Script(code).runInContext(ctx);
    } catch (e) {
        console.error('Error loading background.js:', e);
    }
}

// ============================================================
// TEST 1: Real-time Storage Sync (Live Watcher)
// ============================================================
function testRealTimeSync() {
    console.log('\n── Test 1: Real-time Storage Sync ──');
    const ctx = createMockContext();
    loadBackground(ctx);

    // Initial state check
    assert('Default hotkey matches', ctx.keybindSettings.toggleSidebar === 'Alt+S');

    // Simulate storage change event (Live sync)
    const listener = ctx.chrome.storage.onChanged.addListener.mock.calls[0][0];
    listener({
        ytt_keybind_settings: { newValue: { toggleSidebar: 'Alt+P' } }
    }, 'local');

    assert('Background variable UPDATED via storage listener', ctx.keybindSettings.toggleSidebar === 'Alt+P', `Expected Alt+P, got ${ctx.keybindSettings.toggleSidebar}`);

    // Test opacity sync
    listener({
        ytt_opacity_settings: { newValue: { enabled: true, value: 0.25 } }
    }, 'local');
    assert('Background opacity UPDATED via storage listener', ctx.opacitySettings.value === 0.25);
}

// ============================================================
// TEST 2: Backup Data Integrity
// ============================================================
async function testBackupIntegrity() {
    console.log('\n── Test 2: Backup Data Integrity ──');
    const ctx = createMockContext();
    loadBackground(ctx);

    // Setup custom state
    ctx.keybindSettings.toggleSidebar = 'Alt+K';
    ctx.opacitySettings = { enabled: true, value: 0.1 };
    ctx.smartFullscreenSettings = { enabled: false };

    // Trigger backup creation
    await ctx.createBackup();

    const backupCall = ctx.self.yttDB.addBackup.mock.calls[0][0];
    
    assert('Backup contains keybindSettings', !!backupCall.keybindSettings);
    assert('Backup has correct custom hotkey', backupCall.keybindSettings.toggleSidebar === 'Alt+K');
    assert('Backup contains opacitySettings', !!backupCall.opacitySettings);
    assert('Backup has correct opacity value', backupCall.opacitySettings.value === 0.1);
    assert('Backup contains smartFullscreenSettings', !!backupCall.smartFullscreenSettings);
    assert('Backup preserves disabled state', backupCall.smartFullscreenSettings.enabled === false);
}

// ============================================================
// TEST 3: Import / Restore Logic
// ============================================================
async function testImportRestore() {
    console.log('\n── Test 3: Import / Restore Logic ──');
    const ctx = createMockContext();
    loadBackground(ctx);

    const mockImportData = {
        ytt_history: { '2026-04-19': { watchTime: 100 } },
        ytt_keybind_settings: { toggleSidebar: 'Alt+X' },
        ytt_opacity_settings: { enabled: true, value: 0.99 },
        ytt_smart_fullscreen_settings: { enabled: true }
    };

    const response = await ctx.handleImportBackup(mockImportData);

    assert('Import reports success', response.success === true);
    assert('Import response contains updated hotkeys', response.settings.ytt_keybind_settings.toggleSidebar === 'Alt+X');
    assert('Import response contains updated opacity', response.settings.ytt_opacity_settings.value === 0.99);
    
    assert('Background memory UPDATED after import', ctx.keybindSettings.toggleSidebar === 'Alt+X');
    
    const storageCall = ctx.chrome.storage.local.set.mock.calls[0][0];
    assert('Storage updated with new hotkeys', storageCall.ytt_keybind_settings.toggleSidebar === 'Alt+X');
}

// ============================================================
// RUN ALL
// ============================================================
async function runAll() {
    console.log('🧪 Running Backup & Sync Diagnostic Tests...');
    try {
        testRealTimeSync();
        await testBackupIntegrity();
        await testImportRestore();

        console.log(`\n${'═'.repeat(50)}`);
        console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} total`);
        
        if (failed > 0) {
            console.log('❌ SYSTEM VERIFICATION FAILED');
            process.exit(1);
        } else {
            console.log('✅ SYSTEM VERIFICATION SUCCESSFUL');
        }
    } catch (err) {
        console.error('Test Execution Error:', err);
        process.exit(1);
    }
}

runAll();
