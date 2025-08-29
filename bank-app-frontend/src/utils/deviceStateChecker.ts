const CHECKER_URL = 'http://localhost:5050';

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

interface CustomerInfo {
  customerId: string;
  name: string;
  encryptedPrivateKey?: {
    iv: number[];
    encryptedData: number[];
  };
}

const DB_NAME = 'FidoVaultDB';
const DB_VERSION = 2;
const STORE_NAME = 'DeviceStates';
const CUSTOMER_STORE = 'CustomerInfo';

let dbInstance: IDBDatabase | null = null;

async function initIndexedDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    console.log('initIndexedDB: Using existing dbInstance');
    return dbInstance;
  }
  return new Promise((resolve, reject) => {
    console.log('initIndexedDB: Opening database', DB_NAME, 'version', DB_VERSION);
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) => {
      const error = (event.target as IDBOpenDBRequest).error;
      console.error('initIndexedDB: Error opening database:', error);
      reject(new Error(`Error opening IndexedDB: ${error?.message || 'Unknown error'}`));
    };
    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      console.log('initIndexedDB: Database opened successfully');
      dbInstance.onclose = () => {
        console.log('initIndexedDB: Database connection closed');
        dbInstance = null;
      };
      resolve(dbInstance);
    };
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      console.log(`initIndexedDB: Upgrading database to version ${DB_VERSION}`);
      if (!db.objectStoreNames.contains('EncryptedKeys')) {
        db.createObjectStore('EncryptedKeys', { keyPath: 'id' });
        console.log('initIndexedDB: Created EncryptedKeys store');
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        console.log('initIndexedDB: Created DeviceStates store');
      }
      if (!db.objectStoreNames.contains(CUSTOMER_STORE)) {
        db.createObjectStore(CUSTOMER_STORE, { keyPath: 'customerId' });
        console.log('initIndexedDB: Created CustomerInfo store');
      }
    };
  });
}

async function forceInitialize(): Promise<IDBDatabase> {
  console.log('forceInitialize: Resetting and reinitializing database');
  await resetIndexedDB();
  return initIndexedDB();
}

async function saveDeviceState(customerId: string, state: DeviceState): Promise<void> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        reject(new Error(`Object store ${STORE_NAME} not found`));
        return;
      }
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
        console.log('saveDeviceState: Device state saved:', data);
        resolve();
      };
      request.onerror = () => {
        transaction.abort?.();
        console.error('saveDeviceState: Error saving device state:', request.error);
        reject(new Error(`Failed to save device state: ${request.error?.message || 'Unknown error'}`));
      };
      transaction.onerror = () => {
        console.error('saveDeviceState: Transaction error');
        reject(new Error('Transaction failed while saving device state'));
      };
    });
  } catch (err) {
    console.error('saveDeviceState: Error:', err);
    throw err;
  }
}

async function loadDeviceState(customerId: string): Promise<StoredState | null> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        reject(new Error(`Object store ${STORE_NAME} not found`));
        return;
      }
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(customerId);
      request.onsuccess = () => {
        console.log('loadDeviceState: Device state loaded:', request.result);
        resolve(request.result || null);
      };
      request.onerror = () => {
        console.error('loadDeviceState: Error:', request.error);
        reject(new Error(`Failed to load device state: ${request.error?.message || 'Unknown error'}`));
      };
    });
  } catch (err) {
    console.error('loadDeviceState: Error:', err);
    throw err;
  }
}

async function storeKeyInIndexedDB(id: string, data: any): Promise<void> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains('EncryptedKeys')) {
        reject(new Error(`Object store EncryptedKeys not found`));
        return;
      }
      const transaction = db.transaction(['EncryptedKeys'], 'readwrite');
      const store = transaction.objectStore('EncryptedKeys');
      const request = store.put({ id, data });
      request.onsuccess = () => {
        transaction.commit?.();
        console.log('storeKeyInIndexedDB: Encrypted key stored:', { id });
        resolve();
      };
      request.onerror = () => {
        transaction.abort?.();
        console.error('storeKeyInIndexedDB: Error:', request.error);
        reject(new Error(`Failed to store key: ${request.error?.message || 'Unknown error'}`));
      };
      transaction.onerror = () => {
        console.error('storeKeyInIndexedDB: Transaction error');
        reject(new Error('Transaction failed while storing key'));
      };
    });
  } catch (err) {
    console.error('storeKeyInIndexedDB: Error:', err);
    throw err;
  }
}

async function saveCustomerInfo(customerId: string, name: string, encryptedPrivateKey?: { iv: number[]; encryptedData: number[] }): Promise<void> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(CUSTOMER_STORE)) {
        reject(new Error(`Object store ${CUSTOMER_STORE} not found`));
        return;
      }
      const transaction = db.transaction([CUSTOMER_STORE], 'readwrite');
      const store = transaction.objectStore(CUSTOMER_STORE);
      const data: CustomerInfo = { customerId, name, encryptedPrivateKey };
      const request = store.put(data);
      request.onsuccess = () => {
        transaction.commit?.();
        console.log('saveCustomerInfo: Customer info saved:', { customerId, name });
        resolve();
      };
      request.onerror = () => {
        transaction.abort?.();
        console.error('saveCustomerInfo: Error:', request.error);
        reject(new Error(`Failed to save customer info: ${request.error?.message || 'Unknown error'}`));
      };
      transaction.onerror = () => {
        console.error('saveCustomerInfo: Transaction error');
        reject(new Error('Transaction failed while saving customer info'));
      };
    });
  } catch (err) {
    console.error('saveCustomerInfo: Error:', err);
    throw err;
  }
}

async function loadCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(CUSTOMER_STORE)) {
        reject(new Error(`Object store ${CUSTOMER_STORE} not found`));
        return;
      }
      const transaction = db.transaction([CUSTOMER_STORE], 'readonly');
      const store = transaction.objectStore(CUSTOMER_STORE);
      const request = store.getAll();
      request.onsuccess = () => {
        console.log('loadCustomerInfo: Customer info loaded:', request.result);
        resolve(request.result.length > 0 ? request.result[0] : null);
      };
      request.onerror = () => {
        console.error('loadCustomerInfo: Error:', request.error);
        reject(new Error(`Failed to load customer info: ${request.error?.message || 'Unknown error'}`));
      };
    });
  } catch (err) {
    console.error('loadCustomerInfo: Error:', err);
    throw err;
  }
}

async function checkDeviceState(): Promise<DeviceState | null> {
  try {
    const response = await fetch(`${CHECKER_URL}/check_state`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const state: DeviceState = await response.json();
    console.log('checkDeviceState: Device state fetched:', state);
    return state;
  } catch (error) {
    console.error(`checkDeviceState: Error: ${error}`);
    return null;
  }
}

async function checkWindowsHelloAvailability(): Promise<boolean> {
  try {
    const response = await fetch(`${CHECKER_URL}/check_availability`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) return false;
    const result = await response.json();
    console.log('checkWindowsHelloAvailability: Result:', result.available);
    return result.available;
  } catch (error) {
    console.error(`checkWindowsHelloAvailability: Error: ${error}`);
    return false;
  }
}

async function resetIndexedDB(): Promise<void> {
  try {
    if (dbInstance) {
      console.log('resetIndexedDB: Closing existing database connection');
      dbInstance.close();
      dbInstance = null;
    }
    return new Promise((resolve, reject) => {
      console.log('resetIndexedDB: Deleting database', DB_NAME);
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => {
        console.log('resetIndexedDB: Database deleted successfully');
        resolve();
      };
      request.onerror = () => {
        console.error('resetIndexedDB: Error:', request.error);
        reject(new Error(`Failed to delete database: ${request.error?.message || 'Unknown error'}`));
      };
      request.onblocked = () => {
        console.warn('resetIndexedDB: Database deletion blocked; close other connections');
      };
    });
  } catch (err) {
    console.error('resetIndexedDB: Error:', err);
    throw err;
  }
}

export { initIndexedDB, forceInitialize, checkDeviceState, saveDeviceState, loadDeviceState, checkWindowsHelloAvailability, storeKeyInIndexedDB, resetIndexedDB, saveCustomerInfo, loadCustomerInfo };