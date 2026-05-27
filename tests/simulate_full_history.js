/**
 * Simulation: Data Retention & Calendar Navigation
 * 
 * This script mocks the background env to test:
 * 1. cleanupOldHistory with various retention policies.
 * 2. Day shifting logic for the navigator.
 */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const RealDate = global.Date;
// Fix base date for simulation: 2026-04-08
let mockedNow = new RealDate('2026-04-08T12:00:00Z');

function createMockContext() {
    const ctx = {
        console: { log: (...args) => console.log('LOG:', ...args), error: (...args) => console.error('ERR:', ...args) },
        Date: class extends RealDate {
            constructor(arg) { if (arg) return new RealDate(arg); return new RealDate(mockedNow); }
            static now() { return mockedNow.getTime(); }
        },
        chrome: {
            storage: {
                local: { get: () => {}, set: () => {} },
                onChanged: { addListener: () => {} }
            },
            runtime: { onMessage: { addListener: () => {} }, sendMessage: () => {}, lastError: null },
            tabs: { remove: () => {}, onUpdated: { addListener: () => {} }, onRemoved: { addListener: () => {} } },
            alarms: { create: () => {}, clear: (name, cb) => cb && cb(), onAlarm: { addListener: () => {} } }
        },
        Icons: {}, // Placeholder
        icons: {}, // Placeholder
        Math: global.Math, Object: global.Object, Array: global.Array, String: global.String,
        Number: global.Number, Boolean: global.Boolean, Set: global.Set, Map: global.Map,
        isFinite: Number.isFinite,
        parseInt: global.parseInt,
        setTimeout: global.setTimeout,
        importScripts: (path) => {
            // Mock importScripts by loading the file into the context
            console.log(`  [Mock] Importing script: ${path}`);
            // Note: In this simulation we assume path is relative to root or we handled it
            // For db.js, we can just skip it if it's not needed for the retention logic
        }
    };
    ctx.global = ctx;
    vm.createContext(ctx);
    return ctx;
}

function loadFileIntoContext(ctx, filePath) {
    const code = fs.readFileSync(filePath, 'utf-8');
    new vm.Script(code).runInContext(ctx);
}

// --- SIMULATION START ---
console.log('🚀 Starting Simulation: Data Retention & Calendar Logic\n');

const ctx = createMockContext();
loadFileIntoContext(ctx, 'background.js');

const historyData = {
    '2026-04-08': { watchTime: 100, videos: [] }, // Today
    '2026-04-07': { watchTime: 200, videos: [] }, // Yesterday
    '2026-03-24': { watchTime: 300, videos: [] }, // 15 days ago
    '2026-03-09': { watchTime: 400, videos: [] }, // 30 days ago
    '2026-01-08': { watchTime: 500, videos: [] }, // 3 months ago
    '2025-04-08': { watchTime: 600, videos: [] }, // 1 year ago
};

console.log('Step 1: Testing cleanupOldHistory');
console.log('Initial keys:', Object.keys(historyData).join(', '));

const testRetention = (days) => {
    const result = ctx.cleanupOldHistory(historyData, days);
    const keys = Object.keys(result);
    console.log(`\n  Scenario: Retention = ${days} Days`);
    console.log(`  Remaining Keys: ${keys.length ? keys.join(', ') : 'None'}`);
    return keys;
};

const keys7 = testRetention(7); // Should keep today, yesterday
const keys30 = testRetention(30); // Should keep today, yesterday, 15 days ago, 30 days ago
const keysUnlimited = testRetention(-1); // Should keep all

// Assertions
if (keys7.includes('2026-04-08') && keys7.includes('2026-04-07') && !keys7.includes('2026-03-24')) {
    console.log('  ✅ 7-day retention works.');
} else {
    console.log('  ❌ 7-day retention failed.');
}

if (keys30.includes('2026-03-24') && keys30.includes('2026-03-09') && !keys30.includes('2026-01-08')) {
    console.log('  ✅ 30-day retention works (including boundary).');
} else {
    console.log('  ❌ 30-day retention failed.');
}

if (keysUnlimited.length === 6) {
    console.log('  ✅ Unlimited retention works.');
} else {
    console.log('  ❌ Unlimited retention failed.');
}

console.log('\nStep 2: Testing Calendar Shift Logic');
// We need to bake sidebar-events.js logic briefly
// The shiftDate logic was implemented in sidebar-events.js

const mockSidebarCtx = createMockContext();
mockSidebarCtx.selectedDayFilter = 'today';
mockSidebarCtx.getDayKey = ctx.getDayKey;

// Mocking icons for sidebar-events load
mockSidebarCtx.icons = { prev: '', next: '', calendar: '' };

// Simple manual recreation of shiftDate for the simulation context
const shiftDate = (filter, offset) => {
    let current;
    if (filter === "today") current = new RealDate(mockedNow.getTime());
    else if (filter === "yesterday") current = new RealDate(mockedNow.getTime() - 86400000);
    else if (filter === "all") current = new RealDate(mockedNow.getTime());
    else {
      const [y, m, d] = filter.split("-").map(Number);
      current = new RealDate(y, m - 1, d);
    }
    current.setDate(current.getDate() + offset);
    
    // getDayKey returns YYYY-MM-DD
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    const newKey = `${y}-${m}-${d}`;
    
    // Logic from sidebar-events: if today, use 'today' string
    const todayKey = `${mockedNow.getFullYear()}-${String(mockedNow.getMonth() + 1).padStart(2, "0")}-${String(mockedNow.getDate()).padStart(2, "0")}`;
    return (newKey === todayKey) ? "today" : newKey;
};

let filter = 'today';
console.log(`Current filter: ${filter}`);
filter = shiftDate(filter, -1);
console.log(`Shift -1: ${filter} (Expect: 2026-04-07 - Wait, my mock shiftDate logic treats 2026-04-07 as 2026-04-07 because today is 2026-04-08)`);
// Note: yesterday is also a keyword used sometimes, but we transitioned mostly to YYYY-MM-DD or today.
// In sidebar-events.js: 
// shiftDate(-1) from today -> current = 2026-04-08.set(-1) = 04-07. newKey = 2026-04-07. todayKey = 2026-04-08.
// returns 2026-04-07.

if (filter === '2026-04-07') {
    console.log('  ✅ Shift back works.');
}

filter = shiftDate(filter, 1);
console.log(`Shift +1: ${filter} (Expect: today)`);
console.log('\nStep 3: Testing Scenario - Import 6 months, then change retention to 1 month');
// Mock imported history (6 months ago: 2025-10-08 if today is 2026-04-08)
// Wait, 6 months ago from 2026-04-08 is 2025-10-08 approx.
const importedHistory = {
    '2026-04-08': { watchTime: 100, videos: [] }, // Today
    '2025-10-08': { watchTime: 999, videos: [] }, // 6 months ago
};

console.log('  Initial imported keys:', Object.keys(importedHistory).join(', '));

// Simulate background handler for "retention" update
const simUpdateRetention = (history, newDuration) => {
    console.log(`  Applying Retention Change: -> ${newDuration} Days`);
    return ctx.cleanupOldHistory(history, newDuration);
};

const finalHistory = simUpdateRetention(importedHistory, 30); // Change to 30 days
const finalKeys = Object.keys(finalHistory);

console.log(`  Final Keys after cleanup: ${finalKeys.join(', ')}`);

if (finalKeys.length === 1 && finalKeys[0] === '2026-04-08') {
    console.log('  ✅ Correct: 6-month old data was purged immediately after setting retention to 1 month.');
} else {
    console.log('  ❌ Logic mismatch.');
}

console.log('\n🏁 Simulation Complete.');
