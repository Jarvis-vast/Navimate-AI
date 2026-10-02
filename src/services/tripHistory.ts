import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  deleteDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

export interface TripRecord {
  tripId: string;
  userId: string;
  originName: string;
  destinationName: string;
  distanceMeters: number;
  durationSeconds: number;
  fuelConsumedLitres: number;
  fuelCost: number;
  averageSpeedKmh: number;
  fuelType: string;
  currency: string;
  status: 'COMPLETED' | 'CANCELLED' | 'ACTIVE' | 'PLANNED';
  createdAt: string;
  completedAt: string;
  routeSummary: string;
}

export interface TripAnalyticsSummary {
  totalTrips: number;
  totalDistanceKm: number;
  totalDurationHours: number;
  totalFuelLitres: number;
  totalTripCost: number;
  averageFuelEconomyL100km: number;
  averageSpeedKmh: number;
  currency: string;
}

/**
 * Persist completed trip to Cloud Firestore
 */
export async function saveTripRecord(trip: TripRecord): Promise<void> {
  const path = `trips/${trip.tripId}`;
  try {
    const docRef = doc(db, 'trips', trip.tripId);
    await setDoc(docRef, trip);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Retrieve user trip history from Cloud Firestore
 */
export async function fetchUserTrips(userId: string): Promise<TripRecord[]> {
  const path = 'trips';
  try {
    const tripsRef = collection(db, 'trips');
    // Rule constraint: Query must strictly filter on userId == request.auth.uid
    const q = query(tripsRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);

    const records: TripRecord[] = [];
    snapshot.forEach((d) => {
      records.push(d.data() as TripRecord);
    });

    // Sort client-side by date descending
    records.sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime());
    return records;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Delete a trip record from Firestore
 */
export async function deleteTripRecord(tripId: string): Promise<void> {
  const path = `trips/${tripId}`;
  try {
    const docRef = doc(db, 'trips', tripId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Compute aggregate summary analysis metrics over time
 */
export function computeTripAnalytics(trips: TripRecord[]): TripAnalyticsSummary {
  const completed = trips.filter((t) => t.status === 'COMPLETED');
  const totalTrips = completed.length;

  if (totalTrips === 0) {
    return {
      totalTrips: 0,
      totalDistanceKm: 0,
      totalDurationHours: 0,
      totalFuelLitres: 0,
      totalTripCost: 0,
      averageFuelEconomyL100km: 0,
      averageSpeedKmh: 0,
      currency: '₹',
    };
  }

  const totalMeters = completed.reduce((acc, t) => acc + (t.distanceMeters || 0), 0);
  const totalDistanceKm = totalMeters / 1000;
  const totalSeconds = completed.reduce((acc, t) => acc + (t.durationSeconds || 0), 0);
  const totalDurationHours = totalSeconds / 3600;
  const totalFuelLitres = completed.reduce((acc, t) => acc + (t.fuelConsumedLitres || 0), 0);
  const totalTripCost = completed.reduce((acc, t) => acc + (t.fuelCost || 0), 0);

  // L/100km = (litres * 100) / distanceKm
  const averageFuelEconomyL100km =
    totalDistanceKm > 0 && totalFuelLitres > 0
      ? (totalFuelLitres * 100) / totalDistanceKm
      : 0;

  const averageSpeedKmh =
    totalDurationHours > 0 ? totalDistanceKm / totalDurationHours : 0;

  const currency = completed[0]?.currency || '₹';

  return {
    totalTrips,
    totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
    totalDurationHours: Number(totalDurationHours.toFixed(1)),
    totalFuelLitres: Number(totalFuelLitres.toFixed(1)),
    totalTripCost: Math.round(totalTripCost),
    averageFuelEconomyL100km: Number(averageFuelEconomyL100km.toFixed(2)),
    averageSpeedKmh: Math.round(averageSpeedKmh),
    currency,
  };
}
