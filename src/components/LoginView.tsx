import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Phone, Lock, ChevronRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { signInWithPopup } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

interface LoginViewProps {
  onLoginSuccess: (user: UserProfile) => void;
  existingProfiles: UserProfile[];
}

export default function LoginView({ onLoginSuccess, existingProfiles }: LoginViewProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'signup'>('phone');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tempProfileName, setTempProfileName] = useState('');
  const [tempProfileArea, setTempProfileArea] = useState('Mirpur, Dhaka');
  const [googleUserId, setGoogleUserId] = useState<string | null>(null);

  // Sign in with Google Auth flow
  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      if (user) {
        // Query if profile document already exists in firestore
        const docRef = doc(db, 'profiles', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          onLoginSuccess(docSnap.data() as UserProfile);
        } else {
          // If no profile, save user id and skip to Step 3: signup
          setGoogleUserId(user.uid);
          setTempProfileName(user.displayName || '');
          setPhoneNumber(user.phoneNumber || '');
          setStep('signup');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  // Format and validate Bangladesh phone numbers
  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phoneNumber) {
      setError('Please input a valid phone number');
      return;
    }

    // Basic BD Phone validation
    const bdPhoneRegex = /^(?:\+880|0)?1[3-9]\d{8}$/;
    if (!bdPhoneRegex.test(phoneNumber.replace(/\s+/g, ''))) {
      setError('Please enter a valid Bangladesh phone number (e.g., +8801712345678 or 01712345678)');
      return;
    }

    setLoading(true);

    // Simulate Network dispatch of Firebase Phone Authenticator OTP
    setTimeout(() => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(code);
      setStep('otp');
      setLoading(false);
    }, 1200);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      if (otpCode === generatedOtp || otpCode === '123456') {
        const formattedPhone = phoneNumber.startsWith('+880') 
          ? phoneNumber 
          : phoneNumber.startsWith('0') 
            ? `+880${phoneNumber.slice(1)}` 
            : `+880${phoneNumber}`;

        // Look for corresponding profile in seed database
        const existing = existingProfiles.find(
          p => p.phoneNumber === formattedPhone
        );

        if (existing) {
          onLoginSuccess(existing);
        } else {
          // If no profile exists, go to initial Profile Signup screen
          setStep('signup');
        }
      } else {
        setError('Incorrect verification code. Please try again or use the generated code.');
      }
    }, 1000);
  };

  const handleCompleteSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempProfileName.trim()) {
      setError('Profile name is required');
      return;
    }

    const formattedPhone = phoneNumber.startsWith('+880') 
      ? phoneNumber 
      : phoneNumber.startsWith('0') 
        ? `+880${phoneNumber.slice(1)}` 
        : `+880${phoneNumber}`;

    const newProfile: UserProfile = {
      id: googleUserId || auth.currentUser?.uid || `usr-${Date.now()}`,
      phoneNumber: formattedPhone,
      name: tempProfileName,
      area: tempProfileArea,
      joinDate: new Date().toISOString().split('T')[0],
      postsCount: 0,
      falsePostCount: 0,
      spamBehavior: false,
      deviceFingerprint: `dev-fingerprint-${Math.random().toString(36).substring(7)}`,
      isFlagged: false,
    };

    onLoginSuccess(newProfile);
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12" id="login-container">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl border border-gray-150 bg-white p-8 shadow-sm"
      >
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
            <Phone className="h-6 w-6" />
          </div>
          <h2 className="font-sans font-bold text-2xl text-gray-950">
            {step === 'phone' && 'Phone Authentication'}
            {step === 'otp' && 'Verify Your Identity'}
            {step === 'signup' && 'Complete Your Profile'}
          </h2>
          <p className="font-sans text-sm text-gray-500 mt-2">
            {step === 'phone' && 'Access the PublicEye verification network securely via OTP.'}
            {step === 'otp' && `Secure verification token sent to mobile registration.`}
            {step === 'signup' && 'Provide your official display name and region inside Bangladesh.'}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 p-3.5 border border-red-150 text-xs font-medium text-red-700 flex items-center space-x-2 animate-shake">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Phone submission */}
        {step === 'phone' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="flex w-full items-center justify-center space-x-2.5 rounded-xl border border-gray-200 bg-white py-3 font-sans text-sm font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
              id="google-signin-btn"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
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
              <span>{loading ? 'Processing Auth...' : 'Sign in with Google Account'}</span>
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-gray-150"></div>
              <span className="flex-shrink mx-4 font-mono text-[10px] uppercase font-bold text-gray-400">or use SMS passcode</span>
              <div className="flex-grow border-t border-gray-150"></div>
            </div>

            <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block font-mono text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                Bangladesh Mobile Number
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-sans font-medium text-gray-400">
                  🇧🇩
                </span>
                <input
                  type="tel"
                  placeholder="01712345678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 pl-10 pr-4 font-sans text-sm focus:border-red-500 focus:bg-white focus:outline-none"
                  id="phone-input"
                  required
                />
              </div>
              <p className="mt-2 font-sans text-[11px] text-gray-400">
                Format: 11 digit Bangladesh mobile network string. Secure standard.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center space-x-2 rounded-xl bg-gray-900 py-3 font-sans text-sm font-bold text-white transition hover:bg-gray-800 disabled:opacity-50"
              id="get-otp-code-button"
            >
              {loading ? 'Requesting SDK Auth Token...' : 'Get One-Time Passcode'}
              <ChevronRight className="h-4 w-4" />
            </button>
          </form>
          </div>
        )}

        {/* STEP 2: OTP submission */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {/* Visual simulation SMS notification badge */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 mb-5">
              <span className="font-mono text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                🔔 Mock Firebase SMS Gateway
              </span>
              <p className="font-sans text-xs text-amber-900 mt-1">
                Verification request dispatched to <strong className="font-mono">{phoneNumber}</strong>.
              </p>
              <p className="font-sans text-xs text-amber-950 mt-1">
                Enter OTP: <span className="font-mono font-bold bg-amber-200 text-amber-950 px-1.5 py-0.5 rounded text-sm">{generatedOtp}</span>
              </p>
            </div>

            <div>
              <label className="block font-mono text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                Enter 6-Digit Verification PIN
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  maxLength={6}
                  placeholder="------"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 pl-10 pr-4 text-center font-mono text-lg font-bold tracking-widest focus:border-red-500 focus:bg-white focus:outline-none"
                  id="otp-input"
                  required
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="w-1/3 rounded-xl border border-gray-200 py-3 font-sans text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Change Phone
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-2/3 flex items-center justify-center space-x-2 rounded-xl bg-red-600 py-3 font-sans text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-50"
                id="submit-otp-button"
              >
                {loading ? 'Validating OTP...' : 'Confirm Sign In'}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Complete Signup details */}
        {step === 'signup' && (
          <form onSubmit={handleCompleteSignup} className="space-y-4">
            <div className="mb-4 rounded-xl border border-emerald-150 bg-emerald-50 text-emerald-900 p-3.5 text-xs flex space-x-2">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <span>
                Phone verified! Since this is a newly registered number inside the PublicEye network, please create your profile name.
              </span>
            </div>

            <div>
              <label className="block font-mono text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                Display Name (Bangla or English)
              </label>
              <input
                type="text"
                maxLength={40}
                placeholder="e.g. Shafiqul Alam"
                value={tempProfileName}
                onChange={(e) => setTempProfileName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 px-4 font-sans text-sm focus:border-red-500 focus:bg-white focus:outline-none"
                id="signup-name"
                required
              />
            </div>

            <div>
              <label className="block font-mono text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                Default Location / Zone
              </label>
              <select
                value={tempProfileArea}
                onChange={(e) => setTempProfileArea(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-3 px-4 font-sans text-sm focus:border-red-500 focus:bg-white focus:outline-none"
                id="signup-area"
              >
                <option value="Mirpur, Dhaka">Mirpur, Dhaka</option>
                <option value="Dhanmondi, Dhaka">Dhanmondi, Dhaka</option>
                <option value="Gulshan, Dhaka">Gulshan, Dhaka</option>
                <option value="Uttara, Dhaka">Uttara, Dhaka</option>
                <option value="Banani, Dhaka">Banani, Dhaka</option>
                <option value="Bashundhara, Dhaka">Bashundhara, Dhaka</option>
                <option value="Chittagong GEC, Bangladesh">Chittagong GEC, Bangladesh</option>
                <option value="Sylhet Zindabazar, Bangladesh">Sylhet Zindabazar, Bangladesh</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-600 py-3 font-sans text-sm font-bold text-white transition hover:bg-emerald-500"
              id="signup-save-button"
            >
              Initialize My PublicEye Account
            </button>
          </form>
        )}

        {/* Legal Disclaimer & Safety Notice */}
        <div className="mt-8 border-t border-gray-100 pt-4 text-center">
          <p className="font-sans text-[11px] leading-relaxed text-gray-400">
            For legal protection, your real-time incident activities comply with the Digital Security Act (DSA) guidelines. Fake report logs map fingerprint identifiers.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
