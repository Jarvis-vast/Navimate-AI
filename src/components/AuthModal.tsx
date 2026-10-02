import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  X,
  LogIn,
  UserPlus,
  Mail,
  Lock,
  User as UserIcon,
  LogOut,
  CheckCircle,
  AlertCircle,
  Fuel,
  Sparkles,
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { user, profile, loading, loginWithGoogle, loginWithEmail, signupWithEmail, logout, updateProfileData } =
    useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'profile'>(user ? 'profile' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [preferredFuelType, setPreferredFuelType] = useState<'PETROL' | 'DIESEL' | 'EV' | 'HYBRID' | 'CNG'>('PETROL');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync mode if user state changes
  React.useEffect(() => {
    if (user && mode !== 'profile') {
      setMode('profile');
    } else if (!user && mode === 'profile') {
      setMode('signin');
    }
  }, [user]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
      setSuccess('Successfully signed in with Google!');
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.message || 'Google sign in failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signup') {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long.');
        }
        await signupWithEmail(email, password, displayName || email.split('@')[0]);
        setSuccess('Account created successfully!');
      } else {
        await loginWithEmail(email, password);
        setSuccess('Signed in successfully!');
      }

      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      let msg = err?.message || 'Authentication failed.';
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
        msg = 'Invalid email or password.';
      } else if (msg.includes('auth/email-already-in-use')) {
        msg = 'An account with this email already exists.';
      }
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await updateProfileData({
        displayName: displayName || profile?.displayName,
        preferredFuelType,
      });
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setIsSubmitting(true);
    try {
      await logout();
      setMode('signin');
      setSuccess('Logged out successfully.');
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err?.message || 'Logout failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {user ? 'Driver Account & Profile' : 'Sign in to NaviMate AI'}
              </h2>
              <p className="text-xs text-slate-400">
                {user ? user.email : 'Sync trips, vehicle intelligence & saved places'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle (if not logged in) */}
        {!user && (
          <div className="flex border-b border-slate-800 bg-slate-950/40 p-1">
            <button
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all ${
                mode === 'signin'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </button>
            <button
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all ${
                mode === 'signup'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" /> Create Account
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-500/50 flex items-start gap-2 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 flex items-start gap-2 text-xs text-emerald-200">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {user ? (
            /* Logged in Profile View */
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/20">
                  {profile?.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-white truncate">
                    {profile?.displayName || user.displayName || 'NaviMate Driver'}
                  </h3>
                  <p className="text-xs text-slate-400 truncate">{user.email}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Firebase Authenticated
                  </span>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Display Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                    <input
                      type="text"
                      defaultValue={profile?.displayName || ''}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Preferred Fuel / Power Type
                  </label>
                  <div className="relative">
                    <Fuel className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                    <select
                      value={preferredFuelType}
                      onChange={(e) => setPreferredFuelType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                    >
                      <option value="PETROL">Petrol (Gasoline)</option>
                      <option value="DIESEL">Diesel</option>
                      <option value="EV">Electric Vehicle (EV)</option>
                      <option value="HYBRID">Hybrid</option>
                      <option value="CNG">CNG</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
                >
                  Save Profile Changes
                </button>
              </form>

              <div className="pt-2 border-t border-slate-800">
                <button
                  onClick={handleLogout}
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-slate-800/80 hover:bg-rose-950/60 hover:text-rose-400 hover:border-rose-600/40 border border-slate-700/80 text-slate-300 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" /> Sign Out from Account
                </button>
              </div>
            </div>
          ) : (
            /* Auth Form (Sign In / Sign Up) */
            <div className="space-y-4">
              {/* Google One-Click Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-3 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3">
                <div className="h-px bg-slate-800 flex-1" />
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">
                  or email and password
                </span>
                <div className="h-px bg-slate-800 flex-1" />
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-3">
                {mode === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Alex Mercer"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="driver@example.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {isSubmitting ? (
                    'Processing...'
                  ) : mode === 'signup' ? (
                    <>
                      <UserPlus className="w-4 h-4" /> Create NaviMate Account
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" /> Sign In
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
