import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  getDocFromServer,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: Must pass firestoreDatabaseId according to skill requirements
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Operational error types as strictly mandated by the Firestore skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test on boot as required by skill constraint
export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or initial connection pending.');
    }
  }
}

// Run test connection asynchronously
if (typeof window !== 'undefined') {
  testConnection().catch(() => {});
}

export interface UserProfileData {
  userId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phone?: string;
  preferredFuelType?: 'PETROL' | 'DIESEL' | 'EV' | 'HYBRID' | 'CNG';
  createdAt?: string;
  updatedAt?: string;
}

// User Profile Firestore helper methods
export async function getUserProfile(uid: string): Promise<UserProfileData | null> {
  const path = `users/${uid}`;
  try {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfileData;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserProfile(profile: UserProfileData): Promise<void> {
  const path = `users/${profile.userId}`;
  try {
    const docRef = doc(db, 'users', profile.userId);
    await setDoc(docRef, profile, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Authentication Wrappers
export async function loginWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider);
  if (result.user) {
    // Sync profile
    const existing = await getUserProfile(result.user.uid);
    if (!existing) {
      await saveUserProfile({
        userId: result.user.uid,
        email: result.user.email || '',
        displayName: result.user.displayName || result.user.email?.split('@')[0] || 'NaviMate Driver',
        photoURL: result.user.photoURL || '',
        preferredFuelType: 'PETROL',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }
  return result.user;
}

export async function loginWithEmail(email: string, pass: string): Promise<FirebaseUser> {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  return result.user;
}

export async function signupWithEmail(email: string, pass: string, name: string): Promise<FirebaseUser> {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  if (result.user) {
    await updateProfile(result.user, {
      displayName: name,
    });
    await saveUserProfile({
      userId: result.user.uid,
      email: result.user.email || email,
      displayName: name || email.split('@')[0],
      photoURL: '',
      preferredFuelType: 'PETROL',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return result.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}
