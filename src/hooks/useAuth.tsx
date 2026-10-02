import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, getIdToken } from 'firebase/auth';
import {
  auth,
  getUserProfile,
  saveUserProfile,
  loginWithGoogle as fbLoginGoogle,
  loginWithEmail as fbLoginEmail,
  signupWithEmail as fbSignupEmail,
  logoutUser as fbLogout,
  UserProfileData,
} from '../services/firebase';
import { platformSync } from '../services/platformSync';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfileData | null;
  loading: boolean;
  token: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfileData: (updates: Partial<UserProfileData>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const idToken = await getIdToken(currentUser);
          setToken(idToken);
          // Set in platformSync for server API requests
          platformSync.setAuthToken(idToken);

          // Fetch profile from Firestore
          let userProfile = await getUserProfile(currentUser.uid);
          if (!userProfile) {
            userProfile = {
              userId: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'NaviMate Driver',
              photoURL: currentUser.photoURL || '',
              preferredFuelType: 'PETROL',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            await saveUserProfile(userProfile);
          }
          setProfile(userProfile);
        } catch (err) {
          console.error('Error fetching user profile or token:', err);
        }
      } else {
        setToken(null);
        setProfile(null);
        platformSync.setAuthToken('demo_token');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      await fbLoginGoogle();
    } finally {
      setLoading(false);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await fbLoginEmail(email, pass);
    } finally {
      setLoading(false);
    }
  };

  const signupWithEmail = async (email: string, pass: string, name: string) => {
    setLoading(true);
    try {
      await fbSignupEmail(email, pass, name);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await fbLogout();
    } finally {
      setLoading(false);
    }
  };

  const updateProfileData = async (updates: Partial<UserProfileData>) => {
    if (!user || !profile) return;
    const updated: UserProfileData = {
      ...profile,
      ...updates,
      userId: user.uid,
      updatedAt: new Date().toISOString(),
    };
    await saveUserProfile(updated);
    setProfile(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        token,
        loginWithGoogle,
        loginWithEmail,
        signupWithEmail,
        logout,
        updateProfileData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
