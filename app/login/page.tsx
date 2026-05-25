'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { ShieldCheck, Phone, Key, MapPin, Sparkles, AlertCircle, HelpCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { 
    user, 
    profile, 
    onboardingRequired, 
    sendVerificationCode, 
    verifyOtpCode, 
    completeOnboarding, 
    simulateLogin, 
    loading 
  } = useAuth();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'onboarding'>('phone');
  
  // Form values
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  
  // Feedback States
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [useSimulation, setUseSimulation] = useState(true); // Default to simulation for pristine iframe compatibility

  useEffect(() => {
    if (user && !onboardingRequired && !loading) {
      router.push('/');
    } else if (user && onboardingRequired) {
      setTimeout(() => setStep('onboarding'), 0);
    }
  }, [user, onboardingRequired, loading]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    // Normalize phone number format
    let formattedPhone = phoneNumber.trim();
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+880' + formattedPhone.slice(1);
      } else if (formattedPhone.startsWith('880')) {
        formattedPhone = '+' + formattedPhone;
      } else {
        formattedPhone = '+880' + formattedPhone;
      }
    }

    if (!/^\+8801[3-9]\d{8}$/.test(formattedPhone)) {
      setError("Please enter a valid Bangladesh phone number (e.g. 01711111111)");
      return;
    }

    if (useSimulation) {
      setAuthLoading(true);
      setTimeout(() => {
        setStep('otp');
        setInfo(`SIMULATION: An OTP has been simulated for phone number ${formattedPhone}. Enter any 6 digit code (e.g., 123456).`);
        setAuthLoading(false);
      }, 800);
      return;
    }

    // Real Firebase Auth flow
    setAuthLoading(true);
    try {
      const success = await sendVerificationCode(formattedPhone, 'recaptcha-anchor-area');
      if (success) {
        setStep('otp');
        setInfo(`A genuine verification code has been SMS texted to ${formattedPhone}. Please check your phone.`);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to send SMS code. This is common if Firebase billing or reCAPTCHA is not configured. We recommend using the 'Sandbox / Simulator' toggle.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (otpCode.length !== 6 || !/^\d+$/.test(otpCode)) {
      setError("Please enter a valid 6-digit number.");
      return;
    }

    setAuthLoading(true);
    try {
      if (useSimulation) {
        let cleanPhone = phoneNumber;
        if (!cleanPhone.startsWith('+')) {
          cleanPhone = cleanPhone.startsWith('0') ? '+880' + cleanPhone.slice(1) : '+880' + cleanPhone;
        }
        await simulateLogin(cleanPhone);
        // Login listener will trigger onboarding state or homepage redirect
      } else {
        await verifyOtpCode(otpCode);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Invalid validation code. Please double-check.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 3) {
      setError("Your name must be at least 3 characters long.");
      return;
    }
    if (area.trim().length < 3) {
      setError("Please specify your Area / Location (e.g. Mirpur, Banani, Chittagong).");
      return;
    }

    setAuthLoading(true);
    try {
      await completeOnboarding(name.trim(), area.trim());
      router.push('/');
    } catch (err: any) {
      console.error(err);
      setError("Failed to complete profile registration. Firestore permissions might be active.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleInstantDemoLogin = async () => {
    setError(null);
    setAuthLoading(true);
    try {
      await simulateLogin('+8801712345678', 'Hasan Mahmud', 'Mirpur 10, Dhaka');
      router.push('/');
    } catch (err) {
      setError("Demo simulation failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-900 border-t-rose-600 rounded-full animate-spin"></div>
          <p className="text-slate-600 text-sm font-medium">Checking authentication, please wait...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white font-black text-2xl shadow-md">
            P
          </div>
          <span className="font-heading font-extrabold text-2xl tracking-tight text-slate-900">
            PublicEye
          </span>
        </div>
        <h2 className="text-center text-3xl font-heading font-bold tracking-tight text-slate-950">
          {step === 'phone' && 'Join the Community'}
          {step === 'otp' && 'Enter Verification Code'}
          {step === 'onboarding' && 'Create Your Profile'}
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          {step === 'phone' && 'Secure community-initiated reporting for Bangladesh.'}
          {step === 'otp' && 'Enter the 6-digit authentication code.'}
          {step === 'onboarding' && 'We mandate real human identity to verify Bangladesh incidents.'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-md rounded-2xl border border-slate-200/80">
          
          {/* Top Info Banner */}
          {info && (
            <div className="mb-5 p-3.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs leading-relaxed flex gap-2">
              <Sparkles className="w-4 h-4 shrink-0 text-blue-500" />
              <div>{info}</div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-950 rounded-xl text-xs leading-relaxed flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <div>{error}</div>
            </div>
          )}

          {/* STEP 1: Phone input */}
          {step === 'phone' && (
            <form onSubmit={handleSendOtp} className="space-y-6" id="login-phone-form">
              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-semibold text-slate-900 mb-1.5">
                  Mobile Phone Number
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="h-5 h-5" />
                  </div>
                  <input
                    type="tel"
                    id="phoneNumber"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="01711111111 or +8801999..."
                    disabled={authLoading}
                    className="block w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-slate-950 focus:border-slate-950 text-slate-900placeholder-slate-400 font-medium"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Only mobile phone validation is accepted. One phone number = one unique account.
                </p>
              </div>

              {/* Mode Toggle (Real vs Sandbox) */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />
                    Sandbox / Simulator Mode
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setUseSimulation(!useSimulation);
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      useSimulation ? 'bg-rose-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        useSimulation ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                <span className="leading-relaxed scale-95 origin-top-left text-slate-500">
                  Allows instant testing right in the AI Studio iframe. Bypasses actual Google Recaptcha & global SMS fee limits.
                </span>
              </div>

              {/* invisible reCAPTCHA container for real auth */}
              <div id="recaptcha-anchor-area"></div>

              <div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-slate-950 hover:bg-slate-900 focus:outline-none transition-colors disabled:bg-slate-400"
                  id="button-send-otp"
                >
                  {authLoading ? 'Routing OTP...' : 'Send Verification OTP'}
                </button>
              </div>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-slate-400 text-xs uppercase font-mono">Or test instantly</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleInstantDemoLogin}
                  disabled={authLoading}
                  className="w-full py-3 px-4 rounded-xl border border-dashed border-rose-400 hover:bg-rose-50/50 text-slate-900 font-bold text-sm transition-all text-center flex items-center justify-center gap-2"
                  id="button-demo-login"
                >
                  <Sparkles className="w-4 h-4 text-rose-600 animate-pulse" />
                  Instant Sandbox Login as Hasan Mahmud
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: OTP Entry */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-6" id="login-otp-form">
              <div>
                <label htmlFor="otpCode" className="block text-sm font-semibold text-slate-900 mb-1.5">
                  6-Digit OTP Code
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Key className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    id="otpCode"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="123456"
                    disabled={authLoading}
                    className="block w-full pl-11 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-slate-950 focus:border-slate-950 text-slate-900 font-semibold tracking-widest text-center text-lg placeholder-slate-300"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('phone');
                    setError(null);
                    setInfo(null);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-900"
                >
                  Change phone number
                </button>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-slate-950 hover:bg-slate-900 focus:outline-none transition-colors disabled:bg-slate-400"
                  id="button-verify-otp"
                >
                  {authLoading ? 'Verifying...' : 'Verify & Continue'}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Onboarding Form */}
          {step === 'onboarding' && (
            <form onSubmit={handleCompleteOnboarding} className="space-y-6" id="onboarding-form">
              <div className="p-4 bg-amber-50 text-amber-950 rounded-2xl border border-amber-200 text-xs leading-relaxed mb-4">
                <div className="font-bold flex items-center gap-1.5 text-amber-900 mb-1">
                  <MapPin className="w-4 h-4 text-amber-600" />
                  Onboarding Bangladesh Profile
                </div>
                Your phone is validated! Complete profile onboarding setup to access nearby community feeds.
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-slate-900 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Hasan Mahmud or Sadia Islam"
                  disabled={authLoading}
                  className="block w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-slate-950 focus:border-slate-950 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label htmlFor="area" className="block text-sm font-semibold text-slate-900 mb-1">
                  Your Area / Location in Bangladesh
                </label>
                <input
                  type="text"
                  id="area"
                  required
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Mirpur 10, Dhaka or Shonadanga, Khulna"
                  disabled={authLoading}
                  className="block w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-slate-950 focus:border-slate-950 text-slate-900 font-medium"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  This location will determine your regional post category list.
                </p>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 focus:outline-none transition-colors disabled:bg-slate-400"
                  id="button-submit-onboarding"
                >
                  {authLoading ? 'Provisioning Profile...' : 'Complete & Launch'}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
