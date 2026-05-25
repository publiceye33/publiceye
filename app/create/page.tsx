'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import Navbar from '@/components/navbar';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where,
  updateDoc,
  doc
} from 'firebase/firestore';
import { 
  getDistanceInMeters, 
  reverseGeocode, 
  getCategoryExpiryHours, 
  offlineDrafts 
} from '@/lib/utils';
import { 
  AlertTriangle, 
  Layout, 
  Plus, 
  Camera, 
  MapPin, 
  Compass, 
  ShieldCheck, 
  EyeOff, 
  RefreshCw, 
  ArrowLeft, 
  Sparkles,
  Search,
  CheckCircle2,
  FileQuestion,
  Info
} from 'lucide-react';

interface DuplicateCandidate {
  id: string;
  title: string;
  category: string;
  locationName: string;
}

export default function CreatePostPage() {
  const router = useRouter();
  const { user, profile } = useAuth();

  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user]);

  // Form Fields State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [postType, setPostType] = useState<'alert' | 'civic'>('alert');
  const [category, setCategory] = useState('Fire');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [areaName, setAreaName] = useState('');
  
  // Geolocation states
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsSuccess, setGpsSuccess] = useState(false);

  // Urban/Rural toggle for duplicate radius checks as requested
  const [isUrban, setIsUrban] = useState(true);

  // File Upload states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Duplicate Check structures
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateCandidate | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // Global Action status
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const handleFetchLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setFormError('GPS Geolocation is not supported by your browser.');
      return;
    }

    setGpsLoading(true);
    setGpsSuccess(false);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        setGpsLoading(false);
        setGpsSuccess(true);

        // Convert coordinates to Bangladesh Area Name
        const resolvedName = await reverseGeocode(lat, lng);
        setAreaName(resolvedName);
      },
      (err) => {
        console.warn("GPS location fetching failed:", err);
        setGpsLoading(false);
        setGpsSuccess(false);
        setFormError('GPS coordinates permission rejected or timed out. You must enter the area name manually.');
        // Default coordinates if GPS fails
        setCoords({ lat: 23.777176, lng: 90.399452 }); // Mohakhali Dhaka
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Automatically fetch browser location on page load
  useEffect(() => {
    setTimeout(() => {
      handleFetchLocation();
    }, 0);
  }, []);

  // Handle local image picker & compression display
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Trigger secure Cloudinary server-proxy image upload
  const uploadImageToServer = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/app/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      throw new Error("Unable to compress and upload your photo");
    }

    const data = await res.json();
    return data.url;
  };

  // Perform immediate duplicate validation checks (within 30 mins)
  const performDuplicateCheck = async (): Promise<boolean> => {
    setCheckingDuplicates(true);
    const searchCategory = postType === 'alert' ? category : 'Civic';
    const activeCoords = coords || { lat: 23.7771, lng: 90.3994 };

    try {
      const postsRef = collection(db, 'posts');
      // Only pull active (not expired) matching type posts to evaluate proximity
      const q = query(
        postsRef, 
        where("type", "==", postType)
      );
      
      const snap = await getDocs(q);
      const nowMs = Date.now();
      const duplicateRadius = isUrban ? 200 : 1000; // 200 meters urban vs 1km rural

      let matchedPost: DuplicateCandidate | null = null;

      snap.forEach((docSnap) => {
        const p = docSnap.data();
        const postCreatedMs = p.createdAt?.seconds ? p.createdAt.seconds * 1000 : nowMs - 100000;
        
        // Check criteria 1: Time Window within 30 minutes
        const minutesDiff = Math.abs(nowMs - postCreatedMs) / (1000 * 60);

        if (minutesDiff <= 30) {
          // Check criteria 2: Same category
          const isSameCategory = postType === 'alert' ? (p.category === category) : true;

          if (isSameCategory) {
            // Check criteria 3: Geopromity distance validation (Haversine calculations)
            const distance = getDistanceInMeters(
              activeCoords.lat, 
              activeCoords.lng, 
              p.latitude || 23.77, 
              p.longitude || 90.39
            );

            if (distance <= duplicateRadius) {
              matchedPost = {
                id: docSnap.id,
                title: p.title,
                category: p.category || 'Civic',
                locationName: p.locationName
              };
            }
          }
        }
      });

      if (matchedPost) {
        setDuplicateMatch(matchedPost);
        setShowDuplicateModal(true);
        setCheckingDuplicates(false);
        return true; // Match found, do not post instantly
      }

    } catch (e) {
      console.warn("Deduplication lookup failed (acting offline/no documents):", e);
    }

    setCheckingDuplicates(false);
    return false; // No matches, proceed safe
  };

  // Handles duplicate merge option YES
  const handleMergeDuplicate = async () => {
    if (!duplicateMatch || !user) return;
    setSubmitting(true);
    setShowDuplicateModal(false);

    try {
      // Create user support vote on duplicateMatch.id to merge interest
      const voteDocRef = doc(db, 'posts', duplicateMatch.id, 'votes', user.uid);
      
      // Update validation score or demand count
      const isAlert = postType === 'alert';
      const postRef = doc(db, 'posts', duplicateMatch.id);

      // Save a vote to the duplicate post on snapshot subcollection
      await updateDoc(voteDocRef, {
        voteType: isAlert ? 'true' : 'support',
        votedById: user.uid,
        createdAt: new Date()
      });

      setFormSuccess("Thank you for confirming. You have joined the existing report timeline!");
      setTimeout(() => {
        router.push(`/post/${duplicateMatch.id}`);
      }, 1500);

    } catch (e) {
      console.error(e);
      setFormError("Failed to consolidate duplicate. Redirecting to feed.");
      setTimeout(() => router.push('/'), 1500);
    } finally {
      setSubmitting(false);
    }
  };

  // Handles form submit or offline cache
  const handleFormSubmit = async (e: React.FormEvent, forceCreate = false) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (title.trim().length < 8) {
      setFormError("The report title is too short. Please provide descriptive identifiers.");
      return;
    }
    if (description.trim().length < 15) {
      setFormError("The report details are too basic. Please offer more context.");
      return;
    }
    if (!areaName.trim()) {
      setFormError("Location name is mandatory. Please enter a valid area.");
      return;
    }

    // Trigger Deduplication check unless forced
    if (!forceCreate) {
      const matchFound = await performDuplicateCheck();
      if (matchFound) return; // Stop and display duplicate modal dialog box
    }

    setSubmitting(true);
    const activeCoords = coords || { lat: 23.7771, lng: 90.3994 };

    // OFFLINE STORAGE QUEUE CHECK
    if (!navigator.onLine) {
      offlineDrafts.saveDraft({
        title: title.trim(),
        description: description.trim(),
        type: postType,
        category: postType === 'alert' ? category : undefined,
        severity: postType === 'alert' ? severity : undefined,
        isAnonymous,
        latitude: activeCoords.lat,
        longitude: activeCoords.lng,
        locationName: areaName.trim(),
        localImageBase64: imagePreview || undefined // Cache local base64 preview offline
      });

      setFormSuccess("Offline Mode triggered. Your draft has been cached locally and will auto-submit when network completes.");
      setTimeout(() => {
        router.push('/');
      }, 2000);
      setSubmitting(false);
      return;
    }

    // ONLINE MODE: Real Firestore & Cloudinary uploads
    try {
      let finalImageUrl = '';

      if (imageFile) {
        setUploadLoading(true);
        try {
          finalImageUrl = await uploadImageToServer(imageFile);
        } catch (uploadError) {
          console.warn("Cloudinary Upload failed, proceeding empty image:", uploadError);
        }
        setUploadLoading(false);
      }

      // Compute automatic expiration hour countdown as requested
      const expHours = postType === 'alert' ? getCategoryExpiryHours(category) : 30 * 24; // Civic default is 30 days
      const expiresAtDate = new Date(Date.now() + expHours * 3600 * 1000);

      const postData = {
        title: title.trim(),
        description: description.trim(),
        latitude: activeCoords.lat,
        longitude: activeCoords.lng,
        locationName: areaName.trim(),
        type: postType,
        isAnonymous,
        authorId: user?.uid || 'guest',
        authorName: isAnonymous ? 'Anonymous User' : (profile?.name || 'Community Watcher'),
        createdAt: new Date(),
        expiresAt: expiresAtDate,
        isExpired: false,
        reportsCount: 0,
        isFlagged: false,
        ...(postType === 'alert' && { category, severity }),
        ...(finalImageUrl && { imageUrl: finalImageUrl }),
        // Counters
        votesTrue: 0,
        votesFalse: 0,
        votesUnsure: 0,
        votesSupport: 0,
        votesNotPriority: 0
      };

      const path = 'posts';
      const docRef = await addDoc(collection(db, path), postData);
      
      setFormSuccess("Thank you! Your report has been successfully registered on the PublicEye Bangladesh map.");
      setTimeout(() => {
        router.push(`/post/${docRef.id}`);
      }, 1500);

    } catch (e) {
      console.error(e);
      setFormError("Server reporting database failed. We have saved your work locally as a safe draft fallback.");
      offlineDrafts.saveDraft({
        title: title.trim(),
        description: description.trim(),
        type: postType,
        category: postType === 'alert' ? category : undefined,
        severity: postType === 'alert' ? severity : undefined,
        isAnonymous,
        latitude: activeCoords.lat,
        longitude: activeCoords.lng,
        locationName: areaName.trim(),
        localImageBase64: imagePreview || undefined
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        {/* Back navigation */}
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-1.5 text-sm font-bold text-slate-650 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Feed
        </button>

        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-md">
          <div className="border-b border-slate-100 pb-5 mb-6">
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-slate-950 tracking-tight">
              Create New Incident Report
            </h1>
            <p className="text-slate-500 text-sm mt-1 leading-relaxed">
              Verify accuracy. Misleading emergency reports risk account moderation.
            </p>
          </div>

          {/* Success Banner */}
          {formSuccess && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-2xl flex items-center gap-2.5 text-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="font-semibold">{formSuccess}</div>
            </div>
          )}

          {/* Error Banner */}
          {formError && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-950 rounded-2xl flex items-center gap-2.5 text-xs">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
              <div>{formError}</div>
            </div>
          )}

          <form onSubmit={(e) => handleFormSubmit(e)} className="space-y-6" id="incident-submission-form">
            
            {/* 1. Post Type Toggle */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-900 block">Report Classification</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPostType('alert')}
                  className={`p-3.5 rounded-2xl text-sm font-bold border transition-all text-left flex flex-col gap-1 ${
                    postType === 'alert'
                      ? 'bg-rose-50 border-rose-600 text-rose-950 ring-1 ring-rose-600'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-heading font-extrabold flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${postType === 'alert' ? 'bg-rose-500' : 'bg-slate-400'}`}></span>
                    Alert (Emergency)
                  </span>
                  <span className="text-[11px] text-slate-550 leading-tight font-medium">For urgent fires, accidents, gas leaks, crimes or utility breakages.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPostType('civic')}
                  className={`p-3.5 rounded-2xl text-sm font-bold border transition-all text-left flex flex-col gap-1 ${
                    postType === 'civic'
                      ? 'bg-slate-900 border-slate-900 text-white ring-1 ring-slate-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="font-heading font-extrabold flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${postType === 'civic' ? 'bg-slate-100' : 'bg-slate-400'}`}></span>
                    Civic Demand
                  </span>
                  <span className="text-[11px] text-slate-350 leading-tight font-medium">For civic demands like road repairs, broken waste dustbins or local park request.</span>
                </button>
              </div>
            </div>

            {/* 2. Direct Details Input */}
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-semibold text-slate-900 mb-1">
                  Report Title
                </label>
                <input
                  type="text"
                  id="title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Broken water mains flooding Road 12 sidewalk"
                  className="block w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-slate-950 focus:border-slate-950 text-slate-900 font-medium placeholder-slate-400"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-semibold text-slate-900 mb-1">
                  Full Details & Context
                </label>
                <textarea
                  id="description"
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide precise location landmarks, status updates, and instructions for neighbors..."
                  className="block w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-slate-950 focus:border-slate-950 text-slate-900 font-medium placeholder-slate-400"
                />
              </div>
            </div>

            {/* 3. Dropdowns (Alert Category and Severity) */}
            {postType === 'alert' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="category" className="block text-sm font-semibold text-slate-900 mb-1">
                    Emergency Category
                  </label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="block w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:ring-slate-950"
                  >
                    <option value="Fire">Fire Breakout</option>
                    <option value="Accident">Road Accident</option>
                    <option value="Flood">Rain Flooding</option>
                    <option value="Storm">Storm Damage</option>
                    <option value="Robbery/Crime">Crime / Theft</option>
                    <option value="Road damage">Civil Road Damage</option>
                    <option value="Water problem">Water / Drainage Clog</option>
                    <option value="Electricity problem">Power / Transformer Outage</option>
                    <option value="Gas leak">Gas Pipe Leakage</option>
                    <option value="Other">Other Emergency</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                    Live Severity Urgency
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'low', label: 'Low', color: 'border-emerald-200 hover:bg-emerald-50/50 text-emerald-800' },
                      { value: 'medium', label: 'Medium', color: 'border-amber-200 hover:bg-amber-50/55 text-amber-800' },
                      { value: 'high', label: 'High Urgent', color: 'border-rose-200 hover:bg-rose-50/55 text-rose-800 font-bold' },
                    ].map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => setSeverity(s.value as any)}
                        className={`py-2 rounded-xl border text-sm font-semibold text-center transition-all ${
                          severity === s.value
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : s.color + ' bg-white'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 4. Geography/Locator System */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-heading font-bold text-sm text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-rose-600" />
                  Live Geolocation Coordinates
                </span>
                <button
                  type="button"
                  onClick={handleFetchLocation}
                  disabled={gpsLoading}
                  className="text-xs font-bold text-rose-600 flex items-center gap-1 disabled:text-slate-400 py-1 px-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200"
                >
                  {gpsLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Compass className="w-3.5 h-3.5" />}
                  Grab Coords
                </button>
              </div>

              {coords ? (
                <div className="grid grid-cols-2 gap-4 text-xs font-mono text-slate-500 bg-white p-3 rounded-xl border border-slate-200">
                  <span>LATITUDE: <b>{coords.lat.toFixed(5)}</b></span>
                  <span>LONGITUDE: <b>{coords.lng.toFixed(5)}</b></span>
                </div>
              ) : (
                <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 leading-relaxed font-semibold">
                  Detecting GPS coordinates... Please allow location sandbox access when requested.
                </div>
              )}

              <div>
                <label htmlFor="areaName" className="block text-xs font-bold text-slate-650 mb-1">
                  Area / Zone Name (Auto-resolved via GPS)
                </label>
                <input
                  type="text"
                  id="areaName"
                  required
                  value={areaName}
                  onChange={(e) => setAreaName(e.target.value)}
                  placeholder="e.g. Mirpur 12, Section C, Dhaka"
                  className="block w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-900 placeholder-slate-400 font-semibold"
                />
              </div>

              {/* Deduplication Settings Toggle */}
              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-mono">DUP RADIUS: {isUrban ? '200M (URBAN)' : '1KM (RURAL)'}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">Urban Area?</span>
                  <button
                    type="button"
                    onClick={() => setIsUrban(!isUrban)}
                    className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out ${
                      isUrban ? 'bg-rose-500' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isUrban ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>
            </div>

            {/* 5. Image Upload */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-900 block">Upload Evidence image (optional)</label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-5 hover:bg-slate-50/50 transition-colors flex flex-col items-center justify-center text-center cursor-pointer relative group">
                  <input
                    type="file"
                    id="evidence-image-picker"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Camera className="w-8 h-8 text-slate-400 mb-2 group-hover:text-slate-600 transition-colors" />
                  <span className="text-xs font-bold text-slate-700 block">Click to select photo</span>
                  <span className="text-[10px] text-slate-400 mt-1 block">Cloudinary compresses layout automatically (~300KB)</span>
                </div>

                {imagePreview && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden relative max-h-[140px] bg-slate-50">
                    <img 
                      src={imagePreview} 
                      alt="Local Preview" 
                      className="w-full h-full object-cover" 
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      className="absolute top-2 right-2 bg-slate-950/80 text-white p-1 rounded-full text-xs font-bold font-mono hover:bg-rose-600"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 6. Anonymous toggle */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
              <div className="flex items-start gap-2.5">
                <EyeOff className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm font-bold text-slate-900 block">Report Anonymously</span>
                  <span className="text-[10px] text-slate-500 leading-tight block">Protects your profile identity. Stores device identifier fingerprint for moderation.</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAnonymous(!isAnonymous)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out ${
                  isAnonymous ? 'bg-slate-900' : 'bg-slate-300'
                }`}
              >
                <span className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isAnonymous ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Submit buttons */}
            <div>
              <button
                type="submit"
                disabled={submitting || checkingDuplicates || uploadLoading}
                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-2xl shadow-sm text-sm font-extrabold text-white bg-slate-950 hover:bg-slate-900 focus:outline-none transition-colors disabled:bg-slate-400"
                id="submit-report-button"
              >
                {checkingDuplicates ? 'Validating Duplicate Index...' : uploadLoading ? 'Compressing Evidence...' : submitting ? 'Broadcasting Alert...' : 'Broadcast to Maps'}
              </button>
            </div>

          </form>
        </div>
      </main>

      {/* DUP DEDUPLICATION MODAL INTERFACE */}
      {showDuplicateModal && duplicateMatch && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-6 sm:p-7 max-w-md w-full relative animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-amber-600 mb-4 pb-2 border-b border-slate-100">
              <FileQuestion className="w-8 h-8 shrink-0" />
              <div>
                <h3 className="font-heading font-extrabold text-lg text-slate-950 leading-tight">Duplicate Incident Detected</h3>
                <span className="text-[11px] text-slate-500 font-mono tracking-wide uppercase">Active timeline within 30 minutes</span>
              </div>
            </div>

            <p className="text-slate-600 text-sm leading-relaxed mb-4">
              An identical post categorized as <b className="text-rose-600">{duplicateMatch.category}</b> already exists in this specified area zone:
            </p>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 mb-5">
              <h4 className="font-bold text-slate-900 text-sm">{duplicateMatch.title}</h4>
              <span className="text-xs text-slate-500 flex items-center gap-1.5 mt-2">
                <MapPin className="w-3.5 h-3.5" />
                {duplicateMatch.locationName}
              </span>
            </div>

            <div className="font-heading font-bold text-slate-950 text-sm mb-5 text-center">
              Is this the same incident?
            </div>

            <div className="grid grid-cols-2 gap-3.1 mb-1">
              <button
                type="button"
                onClick={handleMergeDuplicate}
                className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition-colors text-center text-sm shadow-sm"
              >
                Yes, merge report
              </button>

              <button
                type="button"
                onClick={(e) => {
                  setShowDuplicateModal(false);
                  handleFormSubmit(e as any, true); // Forced create post
                }}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition-colors text-center text-sm"
              >
                No, post new
              </button>
            </div>
            
            <button
              type="button"
              onClick={() => setShowDuplicateModal(false)}
              className="mt-4 w-full text-center text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              Cancel submission
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
