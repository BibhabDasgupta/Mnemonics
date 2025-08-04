const CHECKER_URL = 'http://localhost:5000';

interface DeviceState {
  current_hash: string;
  current_size: number;
  timestamp: number;
}

interface StoredState {
  id: string;
  biometric_hash: string;
  database_size: number;
  timestamp: number;
}

const DB_NAME = 'FidoVaultDB';
const DB_VERSION = 2; // Unified version
const STORE_NAME = 'DeviceStates';

let dbInstance: IDBDatabase | null = null;

// Initialize IndexedDB with singleton pattern
async function initIndexedDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) => {
      const error = (event.target as IDBOpenDBRequest).error;
      console.error('IndexedDB open error:', error);
      reject(new Error(`Error opening IndexedDB: ${error?.message || 'Unknown error'}`));
    };
    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      dbInstance.onclose = () => {
        console.log('IndexedDB connection closed');
        dbInstance = null;
      };
      resolve(dbInstance);
    };
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      console.log(`Upgrading IndexedDB to version ${DB_VERSION}`);
      if (!db.objectStoreNames.contains('EncryptedKeys')) {
        db.createObjectStore('EncryptedKeys', { keyPath: 'id' });
        console.log('Created EncryptedKeys store');
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        console.log('Created DeviceStates store');
      }
    };
  });
}

// Save device state to IndexedDB
async function saveDeviceState(customerId: string, state: DeviceState): Promise<void> {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const data: StoredState = {
      id: customerId,
      biometric_hash: state.current_hash,
      database_size: state.current_size,
      timestamp: state.timestamp,
    };
    const request = store.put(data);
    request.onsuccess = () => {
      transaction.commit?.();
      console.log('Device state saved:', data);
      resolve();
    };
    request.onerror = () => {
      transaction.abort?.();
      reject(new Error('Failed to save device state to IndexedDB.'));
    };
    transaction.onerror = () => {
      reject(new Error('Transaction failed while saving device state.'));
    };
  });
}

// Load device state from IndexedDB
async function loadDeviceState(customerId: string): Promise<StoredState | null> {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(customerId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(new Error('Failed to load device state from IndexedDB.'));
  });
}

// Store encrypted key in IndexedDB
async function storeKeyInIndexedDB(id: string, data: any): Promise<void> {
  const db = await initIndexedDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['EncryptedKeys'], 'readwrite');
    const store = transaction.objectStore('EncryptedKeys');
    const request = store.put({ id, data });
    request.onsuccess = () => {
      transaction.commit?.();
      console.log('Encrypted key stored:', { id });
      resolve();
    };
    request.onerror = () => {
      transaction.abort?.();
      reject(new Error('Failed to store key in IndexedDB.'));
    };
    transaction.onerror = () => {
      reject(new Error('Transaction failed while storing key.'));
    };
  });
}

// Check Windows Hello state
async function checkDeviceState(): Promise<DeviceState | null> {
  try {
    const response = await fetch(`${CHECKER_URL}/check_state`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const state: DeviceState = await response.json();
    return state;
  } catch (error) {
    console.error(`Device state check failed: ${error}`);
    return null;
  }
}

// Check Windows Hello availability
async function checkWindowsHelloAvailability(): Promise<boolean> {
  try {
    const response = await fetch(`${CHECKER_URL}/check_hello_availability`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) return false;
    const result = await response.json();
    return result.available;
  } catch (error) {
    console.error(`Windows Hello availability check failed: ${error}`);
    return false;
  }
}

// Reset IndexedDB for testing
async function resetIndexedDB(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => {
      console.log('FidoVaultDB deleted');
      resolve();
    };
    request.onerror = () => reject(new Error('Failed to delete FidoVaultDB'));
    request.onblocked = () => console.warn('Database deletion blocked; close other connections');
  });
}

export { checkDeviceState, saveDeviceState, loadDeviceState, checkWindowsHelloAvailability, storeKeyInIndexedDB, resetIndexedDB };