import { useState, useEffect, useRef, useCallback } from 'react';
import { Coordinates } from '../types/navigation';

export type GPSStatus =
  | 'acquiring'
  | 'permission_denied'
  | 'unavailable'
  | 'good_accuracy'
  | 'low_accuracy'
  | 'stale';

export interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  staleThresholdMs?: number;
}

export interface GeolocationState {
  coords: Coordinates;
  accuracy: number; // in meters
  heading: number; // in degrees
  speedKmh: number | null; // in km/h or null if unavailable
  status: GPSStatus;
  statusLabel: string;
  isSimulated: boolean;
  lastUpdated: number;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 15000,
    maximumAge = 2000,
    staleThresholdMs = 15000,
  } = options;

  // Default coordinate (Pune Regional Center fallback if GPS denied)
  const [state, setState] = useState<GeolocationState>({
    coords: { lat: 18.5204, lng: 73.8567 },
    accuracy: 10,
    heading: 0,
    speedKmh: null,
    status: 'acquiring',
    statusLabel: 'Acquiring GPS fix...',
    isSimulated: false,
    lastUpdated: Date.now(),
  });

  const [isSimulatorActive, setIsSimulatorActive] = useState<boolean>(false);
  const watchIdRef = useRef<number | null>(null);
  const smoothedHeadingRef = useRef<number>(0);

  // Smooth heading changes to prevent jitter
  const smoothHeading = useCallback((newHeading: number | null): number => {
    if (newHeading === null || Number.isNaN(newHeading)) {
      return smoothedHeadingRef.current;
    }
    // Exponential smoothing filter
    const prev = smoothedHeadingRef.current;
    let diff = newHeading - prev;
    // Normalize diff to -180 .. 180
    while (diff < -180) diff += 360;
    while (diff > 180) diff -= 360;
    const smoothed = (prev + diff * 0.35 + 360) % 360;
    smoothedHeadingRef.current = smoothed;
    return smoothed;
  }, []);

  // Real device GPS tracking
  useEffect(() => {
    if (isSimulatorActive) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (!('geolocation' in navigator)) {
      setState((prev) => ({
        ...prev,
        status: 'unavailable',
        statusLabel: 'GPS Hardware Unavailable',
      }));
      return;
    }

    // Check permission status if available in browser
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((p) => {
        if (p.state === 'denied') {
          setState((prev) => ({
            ...prev,
            status: 'permission_denied',
            statusLabel: 'GPS Permission Denied',
          }));
        }
      }).catch(() => {});
    }

    const onPositionSuccess = (pos: GeolocationPosition) => {
      const { latitude, longitude, accuracy, heading, speed } = pos.coords;
      const speedInKmh = speed !== null && speed >= 0 ? Math.round(speed * 3.6) : null;
      const effectiveHeading = smoothHeading(heading);
      const isGood = accuracy <= 30;

      setState({
        coords: { lat: latitude, lng: longitude },
        accuracy: Math.round(accuracy),
        heading: effectiveHeading,
        speedKmh: speedInKmh,
        status: isGood ? 'good_accuracy' : 'low_accuracy',
        statusLabel: isGood ? `GPS Active · ±${Math.round(accuracy)}m` : `Low Accuracy · ±${Math.round(accuracy)}m`,
        isSimulated: false,
        lastUpdated: Date.now(),
      });
    };

    const onPositionError = (err: GeolocationPositionError) => {
      let status: GPSStatus = 'unavailable';
      let label = 'GPS Error';

      if (err.code === err.PERMISSION_DENIED) {
        status = 'permission_denied';
        label = 'Location Access Denied';
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        status = 'unavailable';
        label = 'GPS Signal Lost';
      } else if (err.code === err.TIMEOUT) {
        status = 'stale';
        label = 'GPS Timed Out';
      }

      setState((prev) => ({
        ...prev,
        status,
        statusLabel: label,
      }));
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      onPositionSuccess,
      onPositionError,
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );

    // Staleness monitor
    const interval = setInterval(() => {
      setState((prev) => {
        if (prev.isSimulated) return prev;
        if (Date.now() - prev.lastUpdated > staleThresholdMs && prev.status === 'good_accuracy') {
          return {
            ...prev,
            status: 'stale',
            statusLabel: 'Location Stale (>15s)',
          };
        }
        return prev;
      });
    }, 5000);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      clearInterval(interval);
    };
  }, [isSimulatorActive, enableHighAccuracy, timeout, maximumAge, staleThresholdMs, smoothHeading]);

  // Simulator controls
  const setSimulatedPosition = useCallback(
    (coords: Coordinates, heading: number = 0, speedKmh: number = 65) => {
      setIsSimulatorActive(true);
      setState({
        coords,
        accuracy: 5,
        heading,
        speedKmh,
        status: 'good_accuracy',
        statusLabel: 'SIMULATION / DEMO',
        isSimulated: true,
        lastUpdated: Date.now(),
      });
    },
    []
  );

  const disableSimulator = useCallback(() => {
    setIsSimulatorActive(false);
    setState((prev) => ({
      ...prev,
      isSimulated: false,
      status: 'acquiring',
      statusLabel: 'Re-acquiring device GPS...',
    }));
  }, []);

  return {
    ...state,
    isSimulatorActive,
    setSimulatedPosition,
    disableSimulator,
  };
}
