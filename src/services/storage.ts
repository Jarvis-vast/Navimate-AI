import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { RouteOption, SavedPlace, FuelLog, POIItem, OfflineRegion, VehicleProfile } from '../types/navigation';

interface NaviMateDB extends DBSchema {
  routes: {
    key: string;
    value: {
      id: string;
      route: RouteOption;
      cachedAt: number;
      origin: string;
      destination: string;
    };
    indexes: { 'by-time': number };
  };
  places: {
    key: string;
    value: SavedPlace;
  };
  fuelLogs: {
    key: string;
    value: FuelLog;
    indexes: { 'by-date': string };
  };
  cachedPOIs: {
    key: string;
    value: {
      key: string;
      query: string;
      items: POIItem[];
      cachedAt: number;
    };
  };
  offlineRegions: {
    key: string;
    value: OfflineRegion;
  };
}

const DB_NAME = 'navimate_offline_store_v1';

let dbPromise: Promise<IDBPDatabase<NaviMateDB>> | null = null;

export function getDatabase() {
  if (!dbPromise) {
    dbPromise = openDB<NaviMateDB>(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('routes')) {
          const routeStore = db.createObjectStore('routes', { keyPath: 'id' });
          routeStore.createIndex('by-time', 'cachedAt');
        }
        if (!db.objectStoreNames.contains('places')) {
          db.createObjectStore('places', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('fuelLogs')) {
          const fuelStore = db.createObjectStore('fuelLogs', { keyPath: 'id' });
          fuelStore.createIndex('by-date', 'date');
        }
        if (!db.objectStoreNames.contains('cachedPOIs')) {
          db.createObjectStore('cachedPOIs', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('offlineRegions')) {
          db.createObjectStore('offlineRegions', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveLastRoute(origin: string, destination: string, route: RouteOption) {
  try {
    const db = await getDatabase();
    await db.put('routes', {
      id: 'last_active_route',
      route,
      cachedAt: Date.now(),
      origin,
      destination,
    });
  } catch (err) {
    console.warn('Failed to cache route in IndexedDB', err);
  }
}

export async function getLastRoute() {
  try {
    const db = await getDatabase();
    return await db.get('routes', 'last_active_route');
  } catch {
    return null;
  }
}

export async function saveCachedPOIs(queryKey: string, items: POIItem[]) {
  try {
    const db = await getDatabase();
    await db.put('cachedPOIs', {
      key: queryKey,
      query: queryKey,
      items,
      cachedAt: Date.now(),
    });
  } catch (err) {
    console.warn('Failed to cache POIs', err);
  }
}

export async function getCachedPOIs(queryKey: string) {
  try {
    const db = await getDatabase();
    return await db.get('cachedPOIs', queryKey);
  } catch {
    return null;
  }
}

export async function getAllFuelLogs(): Promise<FuelLog[]> {
  try {
    const db = await getDatabase();
    return await db.getAll('fuelLogs');
  } catch {
    return [];
  }
}

export async function insertFuelLog(log: FuelLog): Promise<void> {
  const db = await getDatabase();
  await db.put('fuelLogs', log);
}

export async function deleteFuelLog(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete('fuelLogs', id);
}

export async function getAllOfflineRegions(): Promise<OfflineRegion[]> {
  try {
    const db = await getDatabase();
    return await db.getAll('offlineRegions');
  } catch {
    return [];
  }
}

export async function saveOfflineRegion(region: OfflineRegion): Promise<void> {
  try {
    const db = await getDatabase();
    await db.put('offlineRegions', region);
  } catch (err) {
    console.warn('Failed to save offline region:', err);
  }
}

export async function deleteOfflineRegion(id: string): Promise<void> {
  try {
    const db = await getDatabase();
    await db.delete('offlineRegions', id);
  } catch (err) {
    console.warn('Failed to delete offline region:', err);
  }
}

const VEHICLE_STORAGE_KEY = 'navimate_active_vehicle_v1';

export function saveVehicleProfile(vehicle: VehicleProfile): void {
  try {
    localStorage.setItem(VEHICLE_STORAGE_KEY, JSON.stringify(vehicle));
  } catch (err) {
    console.warn('Failed to persist vehicle profile in localStorage:', err);
  }
}

export function getVehicleProfile(): VehicleProfile | null {
  try {
    const saved = localStorage.getItem(VEHICLE_STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export async function clearAllLocalData(): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction(['routes', 'places', 'fuelLogs', 'cachedPOIs', 'offlineRegions'], 'readwrite');
  await Promise.all([
    tx.objectStore('routes').clear(),
    tx.objectStore('places').clear(),
    tx.objectStore('fuelLogs').clear(),
    tx.objectStore('cachedPOIs').clear(),
    tx.objectStore('offlineRegions').clear(),
    tx.done,
  ]);
  localStorage.clear();
}
