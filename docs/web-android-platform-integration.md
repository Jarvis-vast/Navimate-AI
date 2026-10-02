# NaviMate AI — Unified Platform Integration (Web + Android)

## 1. Platform Architecture Overview

NaviMate AI is built as a **single unified platform** where the Web dashboard and the native Android application are two connected client surfaces coordinating through an authoritative backend control plane.

```text
                                NAVIMATE AI
                                     │
                             SHARED PLATFORM
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
      WEB CLIENT               ANDROID CLIENT            BACKEND CONTROL
  (Vite + React PWA)         (Native Nav SDK 7.6)             PLANE
          │                          │                          │
          └──────────────────────────┼──────────────────────────┘
                                     │
                            SHARED AUTH + DATA
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                 Gemini        Routes API (v2)     Places
                    │                │                │
                    └────────────────┼────────────────┘
                                     │
                         REALTIME COORDINATION (SSE)
```

Both clients share:
1. **One User Account**: Ownership is tied to `userId` (never separate `WebUser` / `AndroidUser`).
2. **Device Registry**: Explicit device registration (`WEB` vs `ANDROID`), heartbeat, online/offline detection.
3. **Zero-Trust Pairing**: 6-digit short-lived PIN code + QR handshake with 5-minute TTL.
4. **Shared Vehicle**: Unified fuel type, tank capacity, average consumption, and current level.
5. **Shared Saved Places**: Database-backed collection (Home, Work, Family, Fuel Stations, Hotels).
6. **Shared Trips & Hand-Off**: Trips planned on Web dispatch directly with native Google Routes API Route Tokens to Android for turn-by-turn navigation.
7. **In-Car Live Navigation Mirroring**: Android streams live vehicle telemetry (speed, maneuver, remaining distance, ETA) back to Web in real-time.

---

## 2. Shared Identity & Ownership Model

Every platform resource enforces strict user ownership:

```typescript
export interface User {
  userId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
}
```

- Resources (`Vehicle`, `SavedPlace`, `Trip`, `Device`, `Session`) all contain `userId`.
- The backend never trusts client-supplied `userId` values; identity is resolved server-side via `Authorization: Bearer <token>` or session resolver.

---

## 3. Secure Web <-> Android Device Pairing Protocol

The pairing handshake connects a user's Android phone or in-car head unit to their Web dashboard:

```text
Web Client                      Backend Control Plane                   Android Client
    │                                     │                                    │
    │ ─── POST /api/devices/pair/create ──>                                    │
    │ <── { pairingCode, expiresAt } ──── │                                    │
    │                                     │                                    │
    │ [Displays 6-digit PIN & QR]         │                                    │
    │                                     │ ─── POST /api/devices/pair/confirm ┤
    │                                     │     { pairingCode, deviceId }      │
    │                                     │ <── { success: true, device } ─────┘
    │ <── SSE: DEVICE_PAIRED ──────────── │
    │     { deviceId, status: ONLINE }    │
```

### Security Guarantees:
- **One-time use**: Once consumed, the pairing code is invalidated.
- **Short TTL**: Expires in 5 minutes (300 seconds).
- **No permanent secrets in QR**: QR code contains only an ephemeral verification payload.
- **Zero token logging**: The raw pairing secret is never recorded in backend logs.

---

## 4. Shared Vehicle Profile

Both Web and Android read and write to the same vehicle state:

```typescript
export interface SharedVehicle {
  vehicleId: string;
  userId: string;
  make?: string;
  model?: string;
  fuelType: 'PETROL' | 'DIESEL' | 'CNG' | 'EV' | 'HYBRID';
  tankCapacityLitres?: number;
  averageConsumption?: number;
  currentFuelLevel?: number;
  preferredFuelPrice?: number;
  isTelemetryConnected: boolean;
  updatedAt: string;
}
```

- When updated from either Web (e.g. Fuel Tracker / Settings) or Android (OBD-II telemetry / in-car prompt), the backend pushes `VEHICLE_UPDATED` to all connected clients.

---

## 5. Shared Trips & Web → Android Hand-Off Flow

Users plan long-distance routes on the desktop or laptop Web dashboard, then dispatch directly to their car:

1. **Web**: User queries destination or uses AI Copilot (`"Take me to Mumbai without tolls"`).
2. **Backend**: Google Routes API (v2) computes the route and generates a native `routeToken`.
3. **Web**: Route Preview displays distance, duration, fuel economics, and a **"Send Route to Android / In-Car Device"** button.
4. **Dispatch**: Web calls `POST /api/trips/:id/dispatch`.
5. **Real-time Event**: Backend broadcasts `TRIP_DISPATCHED` with `routeToken` to the paired Android device.
6. **Android**: `SharedPlatformRepository.checkDispatchedTrip()` picks up the trip, loads `CustomRoutesOptions.setRouteToken(...)`, and starts native Google Navigation SDK guidance.

---

## 6. Live In-Car Companion Mirroring (Android → Web)

While the Android device is guiding the driver:
- Android calls `POST /api/navigation/telemetry` with:
  - `currentSpeedKmh`
  - `remainingDistanceMeters`
  - `remainingDurationSeconds`
  - `currentManeuver` (instruction, distance)
  - `currentLocation` (lat, lng, bearing)
- Backend broadcasts `NAVIGATION_TELEMETRY` over Server-Sent Events (SSE).
- Web displays the **Live In-Car Companion Mirror Card** in real time:
  - Current car speed
  - Next turn maneuver
  - Remaining km and ETA
  - **"Track Vehicle on Map"** to follow the live car position.

---

## 7. Verified API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/me` | `GET` | Get authenticated user, registered devices, and vehicle |
| `/api/devices` | `GET` | List paired devices with computed ONLINE/OFFLINE status |
| `/api/devices/register` | `POST` | Register Web or Android client device |
| `/api/devices/:id` | `DELETE` | Unpair a device |
| `/api/devices/heartbeat` | `POST` | Device presence ping |
| `/api/devices/pair/create` | `POST` | Generate 6-digit short-lived pairing PIN & QR |
| `/api/devices/pair/confirm` | `POST` | Android confirms pairing with 6-digit PIN |
| `/api/vehicle` | `GET`, `PUT` | Read & update shared vehicle profile |
| `/api/places/saved` | `GET`, `POST` | Synchronized saved places (Home, Work, etc.) |
| `/api/places/saved/:id` | `DELETE` | Remove a saved place |
| `/api/trips` | `GET`, `POST` | List and create planned trips |
| `/api/trips/active` | `GET` | Retrieve active dispatched trip |
| `/api/trips/:id/dispatch` | `POST` | Hand off trip with Route Token to Android device |
| `/api/navigation/telemetry` | `POST` | Push live car navigation telemetry |
| `/api/navigation/telemetry/active` | `GET`, `DELETE` | Get or clear active car telemetry |
| `/api/realtime/stream` | `GET` | Server-Sent Events (SSE) real-time event pipeline |
