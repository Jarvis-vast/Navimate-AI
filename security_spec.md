# Security Specification & Threat Model for NaviMate AI

## 1. Data Invariants
- A UserProfile can only be read, created, or updated by the authenticated user whose `request.auth.uid == userId`.
- A UserProfile cannot have arbitrary or oversized fields, and cannot spoof ownership.
- A TripRecord belongs to a specific user (`userId`).
- A user can only list or read their own trips (`resource.data.userId == request.auth.uid`).
- A user can only create a trip if `request.resource.data.userId == request.auth.uid`.
- A user can only update or delete their own trips.
- SavedPlaces are strictly isolated by owner `userId == request.auth.uid`.
- All writes require authenticated users (`request.auth != null`).

## 2. The "Dirty Dozen" Payloads (Must Return PERMISSION_DENIED)
1. Unauthenticated read to `/users/{userId}` -> DENIED.
2. User A attempting to read User B's `/users/{userB}` -> DENIED.
3. User A creating a UserProfile with `userId: userB` -> DENIED.
4. User A updating User B's profile -> DENIED.
5. User injecting a 2MB junk payload into UserProfile -> DENIED.
6. Unauthenticated write to `/trips/{tripId}` -> DENIED.
7. User A listing all trips without `where('userId', '==', userA)` query filter -> DENIED.
8. User A creating a trip with `userId: userB` -> DENIED.
9. User A modifying or deleting User B's trip -> DENIED.
10. Trip with invalid/oversized string (>256 chars for routeSummary) -> DENIED.
11. Unauthenticated deletion of saved places -> DENIED.
12. Direct write to non-existent collection or root documents -> DENIED.
