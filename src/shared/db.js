/**
 * @file db.js
 * @description IndexedDB wrapper for YouTube Time Tracker backups.
 */

const DB_NAME = 'ytt_backups_db';
const DB_VERSION = 1;
const STORE_NAME = 'backups';

/**
 * Opens or initializes the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Adds a new backup to the database.
 * @param {Object} data - The full history and settings state.
 * @returns {Promise<number>} - ID of the new backup.
 */
async function addBackup(data) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const backupEntry = {
            timestamp: Date.now(),
            dateString: new Date().toLocaleString(undefined, { 
                month: 'short', day: '2-digit', year: 'numeric', 
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: true 
            }),
            data: data
        };

        const request = store.add(backupEntry);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Fetches all backup entries (metadata only for list view).
 * @returns {Promise<Array>}
 */
async function getAllBackups() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('timestamp');
        
        // Return latest first
        const request = index.openCursor(null, 'prev');
        const backups = [];

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                // Don't send huge 'data' field to list view, just metadata
                const { id, timestamp, dateString } = cursor.value;
                backups.push({ id, timestamp, dateString });
                cursor.continue();
            } else {
                resolve(backups);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Gets a specific backup by ID (full data).
 * @param {number} id 
 * @returns {Promise<Object>}
 */
async function getBackupById(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(parseInt(id, 10));

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Deletes a backup by ID.
 * @param {number} id 
 * @returns {Promise<void>}
 */
async function deleteBackup(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(parseInt(id, 10));

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Deletes oldest backups if the count exceeds the limit.
 * @param {number} limit - Maximum number of backups to keep.
 * @returns {Promise<number>} - Number of deleted backups.
 */
async function purgeOldBackups(limit) {
    if (!limit || limit <= 0) return 0;
    
    const backups = await getAllBackups();
    if (backups.length <= limit) return 0;
    
    const toDelete = backups.slice(limit); // getAllBackups returns newest first, so slice from limit onwards
    let deletedCount = 0;
    
    for (const b of toDelete) {
        await deleteBackup(b.id);
        deletedCount++;
    }
    
    console.log(`DB: Purged ${deletedCount} old backups. Limit was ${limit}.`);
    return deletedCount;
}

/**
 * Deletes all backups from the database.
 * @returns {Promise<void>}
 */
async function clearAllBackups() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Make functions available globally in extension context
self.yttDB = {
    addBackup,
    getAllBackups,
    getBackupById,
    deleteBackup,
    purgeOldBackups,
    clearAllBackups
};
