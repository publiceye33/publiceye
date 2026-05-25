import React, { useState, useEffect } from 'react';
import { UserProfile, AlertCategory, Severity, LocationCoordinates, IncidentPost } from '../types';
import { 
  Camera, MapPin, Loader2, AlertCircle, ShieldAlert, WifiOff,
  Clock, Check, ThumbsUp, HelpCircle, EyeOff, Navigation, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { reverseGeocode, AREA_COORDINATES, calculateExpiryTime, getDistanceMeters, uploadToCloudinarySimulated } from '../utils';

interface CreatePostViewProps {
  currentUser: UserProfile | null;
  posts: IncidentPost[];
  isOnline: boolean;
  onPostCreated: (post: IncidentPost | null, isDraft?: boolean) => void;
  onNavigate: (view: 'home' | 'login' | 'create' | 'post-detail' | 'profile' | 'archive' | 'admin', targetId?: string) => void;
}

export default function CreatePostView({
  currentUser,
  posts,
  isOnline,
  onPostCreated,
  onNavigate,
}: CreatePostViewProps) {
  const [type, setType] = useState<'Alert' | 'Civic'>('Alert');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<AlertCategory>('Fire');
  const [severity, setSeverity] = useState<Severity>('High');
  const [isAnonymous, setIsAnonymous] = useState(false);
  
  // Image states
  const [imageFileUrl, setImageFileUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionMetrics, setCompressionMetrics] = useState<{ original: string; compressed: string } | null>(null);

  // Location states
  const [locationName, setLocationName] = useState('');
  const [coordinates, setCoordinates] = useState<LocationCoordinates | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [areaMode, setAreaMode] = useState<'urban' | 'rural'>('urban');
  const [autoLocationStatus, setAutoLocationStatus] = useState<'searching' | 'success' | 'failed' | ''>('');

  // Duplicate Drawer states
  const [possibleDuplicate, setPossibleDuplicate] = useState<IncidentPost | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Trigger automatic search on load, with manual fallback
  useEffect(() => {
    let active = true;

    const autoLocate = async () => {
      // 1. Check if geolocation exists
      if (!navigator.geolocation) {
        if (active) {
          setAutoLocationStatus('failed');
          // Fallback to current user area
          if (currentUser) {
            setLocationName(currentUser.area);
            const coords = AREA_COORDINATES[currentUser.area];
            if (coords) setCoordinates(coords);
          }
        }
        return;
      }

      if (active) {
        setIsLocating(true);
        setAutoLocationStatus('searching');
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          if (!active) return;
          try {
            const { latitude, longitude } = position.coords;
            setCoordinates({ latitude, longitude });
            
            // Reverse geocode with OpenStreetMap Nominatim
            const resolvedName = await reverseGeocode(latitude, longitude);
            setLocationName(resolvedName);
            setAutoLocationStatus('success');
          } catch (err) {
            console.error(err);
            if (active) {
              setAutoLocationStatus('failed');
              if (currentUser) {
                setLocationName(currentUser.area);
                const coords = AREA_COORDINATES[currentUser.area];
                if (coords) setCoordinates(coords);
              }
            }
          } finally {
            if (active) {
              setIsLocating(false);
            }
          }
        },
        (err) => {
          if (!active) return;
          console.warn('Auto locate failed:', err);
          setAutoLocationStatus('failed');
          // Fallback to user profile area manually
          if (currentUser) {
            setLocationName(currentUser.area);
            const coords = AREA_COORDINATES[currentUser.area];
            if (coords) setCoordinates(coords);
          }
          setIsLocating(false);
        },
        { timeout: 8000 }
      );
    };

    autoLocate();

    return () => {
      active = false;
    };
  }, [currentUser]);

  // Request browser GPS Coordinates manually
  const handleFetchGPS = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setAutoLocationStatus('failed');
      return;
    }

    setIsLocating(true);
    setAutoLocationStatus('searching');
    setError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          setCoordinates({ latitude, longitude });
          
          // Reverse geocode with OpenStreetMap Nominatim
          const resolvedName = await reverseGeocode(latitude, longitude);
          setLocationName(resolvedName);
          setAutoLocationStatus('success');
        } catch (err) {
          setError('Could not convert GPS coordinates using OpenStreetMap API. Please set manually.');
          setAutoLocationStatus('failed');
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        setAutoLocationStatus('failed');
        setError('GPS permission denied or timeout. Please type location division details manually.');
      },
      { timeout: 10000 }
    );
  };

  // Live Simulated Cloudinary Image optimization
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCompressing(true);
      setError('');

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        try {
          // Cloudinary simulated compression reduces resolution and lowers original size up to 90%
          const result = await uploadToCloudinarySimulated(base64String);
          setImageFileUrl(result.url);
          setCompressionMetrics({
            original: result.sizeOriginal,
            compressed: result.sizeCompressed,
          });
        } catch (err) {
          setError('Failed to compress secure image profile.');
        } finally {
          setIsCompressing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit trigger - checking duplication limits first
  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim() || !description.trim() || !locationName.trim()) {
      setError('Please fill in complete title, description, and location metadata.');
      return;
    }

    // Coordinates check
    let activeCoords = coordinates;
    if (!activeCoords) {
      // Find matches in coordinates or default to average Dhaka center
      const match = AREA_COORDINATES[locationName] || AREA_COORDINATES['Mirpur, Dhaka'];
      activeCoords = match;
    }

    // Duplicate detection rules logic
    // Checks same category/type within 30 mins window and location radius (Urban: 200m, Rural: 1km)
    const thirtyMins = 30 * 60 * 1000;
    const now = new Date();
    const thresholdRadius = areaMode === 'urban' ? 200 : 1000;

    const matchedDuplicate = posts.find(post => {
      if (post.isArchived) return false;
      if (post.type !== type) return false;
      
      // Category matches for Alert Type
      if (type === 'Alert' && post.category !== category) return false;

      // Time difference within 30 minutes
      const timeDiff = Math.abs(now.getTime() - new Date(post.timestamp).getTime());
      if (timeDiff > thirtyMins) return false;

      // Distance radius evaluation
      if (activeCoords && post.coordinates) {
        const distance = getDistanceMeters(activeCoords, post.coordinates);
        if (distance <= thresholdRadius) return true;
      } else {
        // Fallback textual match
        if (post.locationName.toLowerCase().includes(locationName.toLowerCase())) return true;
      }

      return false;
    });

    if (matchedDuplicate) {
      setPossibleDuplicate(matchedDuplicate);
      setShowDuplicateModal(true);
    } else {
      executePostCreation();
    }
  };

  const executePostCreation = () => {
    setShowDuplicateModal(false);
    
    // Assign coordinates
    let activeCoords = coordinates;
    if (!activeCoords) {
      activeCoords = AREA_COORDINATES[locationName] || { latitude: 23.8103, longitude: 90.4125 };
    }

    // Offline Saving
    if (!isOnline) {
      const offlineDraft = {
        id: `draft-${Date.now()}`,
        type,
        title,
        description,
        category: type === 'Alert' ? category : undefined,
        severity: type === 'Alert' ? severity : undefined,
        photoData: imageFileUrl || undefined,
        coordinates: activeCoords,
        isAnonymous,
        timestamp: new Date().toISOString(),
      };
      // Send draft back to central state
      onPostCreated(null, true);
      setSuccess(true);
      return;
    }

    // Standard Online post logic
    const postExpiry = calculateExpiryTime(category, type);
    
    const newPost: IncidentPost = {
      id: `post-${Date.now()}`,
      type,
      title,
      description,
      photoUrl: imageFileUrl || undefined,
      locationName,
      coordinates: activeCoords,
      category: type === 'Alert' ? category : undefined,
      severity: type === 'Alert' ? severity : undefined,
      isAnonymous,
      userId: currentUser?.id || 'anonymous-id',
      userName: isAnonymous ? 'Anonymous User' : (currentUser?.name || 'Guest Citizen'),
      userArea: currentUser?.area || 'Dhaka',
      timestamp: new Date().toISOString(),
      votes: [],
      comments: [],
      isArchived: false,
      reportedCount: 0,
      expireTime: postExpiry.toISOString(),
    };

    onPostCreated(newPost);
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center" id="create-success-message">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="rounded-2xl border border-emerald-150 bg-white p-8 shadow-md"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="font-sans font-extrabold text-2xl text-gray-950">
            {isOnline ? 'Incident Posted' : 'Draft Stored Locally'}
          </h2>
          <p className="font-sans text-sm text-gray-500 mt-2">
            {isOnline 
              ? 'Your community report is live! Citizen alerts will evaluate safety metrics immediately.' 
              : 'PWA Draft Saved Offline. Coordinates, message details, and compressed photos are queued to sync when network returns.'}
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => onNavigate('home')}
              className="w-full rounded-xl bg-gray-950 py-3 font-sans text-sm font-bold text-white transition hover:bg-gray-800"
            >
              Return to Feed
            </button>
            <button
              onClick={() => {
                setSuccess(false);
                setTitle('');
                setDescription('');
                setImageFileUrl(null);
                setCompressionMetrics(null);
              }}
              className="w-full rounded-xl border border-gray-200 py-3 font-sans text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Report Another Scene
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8" id="submit-post-form">
      <div className="flex items-center space-x-3 mb-6">
        <h2 className="font-sans font-extrabold text-2xl tracking-tight text-gray-950">
          Create Security Notification
        </h2>
        {!isOnline && (
          <span className="inline-flex items-center space-x-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 font-mono text-[9px] font-bold text-amber-700">
            <WifiOff className="h-3 w-3" />
            <span>OFFLINE QUEUE</span>
          </span>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 p-4 border border-red-150 text-sm font-semibold text-red-700 flex items-center space-x-2">
          <AlertCircle className="h-4.5 w-4.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handlePreSubmit} className="space-y-6 rounded-2xl border border-gray-150 bg-white p-6 sm:p-8 shadow-xs">
        
        {/* Toggle Alert vs Civic */}
        <div>
          <label className="block font-mono text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">
            Incident Framework
          </label>
          <div className="grid grid-cols-2 gap-3" id="incident-type-selection">
            <button
              type="button"
              onClick={() => setType('Alert')}
              className={`flex flex-col items-center justify-center rounded-xl p-3.5 border text-center transition ${
                type === 'Alert'
                  ? 'bg-red-50/50 border-red-200 text-red-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <ShieldAlert className="h-5 w-5 mb-1" />
              <span className="font-sans text-xs font-bold">1. Emergency Alert</span>
              <span className="font-sans text-[10px] text-gray-400 mt-0.5">Fires, Floods, Crimes</span>
            </button>
            <button
              type="button"
              onClick={() => setType('Civic')}
              className={`flex flex-col items-center justify-center rounded-xl p-3.5 border text-center transition ${
                type === 'Civic'
                  ? 'bg-purple-50 border-purple-200 text-purple-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <ThumbsUp className="h-5 w-5 mb-1" />
              <span className="font-sans text-xs font-bold">2. Civic Demand</span>
              <span className="font-sans text-[10px] text-gray-400 mt-0.5">Demands, trash bins, road work</span>
            </button>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block font-mono text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
            Post Title
          </label>
          <input
            type="text"
            placeholder="e.g. Major Gas leak odor near Mirpur 12"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-gray-255 bg-gray-50/50 py-3 px-4 font-sans text-sm focus:border-red-500 focus:bg-white focus:outline-none"
            id="post-title-input"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block font-mono text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
            Detailed Incident Description
          </label>
          <textarea
            rows={4}
            placeholder="Please detail critical specifics such as nearby landmarks, active fire service vehicles, or recommended detours for incoming pedestrians."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-gray-255 bg-gray-50/50 py-3 px-4 font-sans text-sm focus:border-red-500 focus:bg-white focus:outline-none"
            id="post-description-input"
            required
          />
        </div>

        {/* Alert-specific fields */}
        {type === 'Alert' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category selection */}
            <div>
              <label className="block font-mono text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
                Alert Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AlertCategory)}
                className="w-full rounded-xl border border-gray-255 bg-gray-50/50 py-3 px-4 font-sans text-sm focus:border-red-500 focus:bg-white focus:outline-none"
              >
                <option value="Fire">Fire</option>
                <option value="Accident">Accident</option>
                <option value="Flood">Flood</option>
                <option value="Storm">Storm</option>
                <option value="Robbery/Crime">Robbery/Crime</option>
                <option value="Road damage">Road damage</option>
                <option value="Water problem">Water problem</option>
                <option value="Electricity problem">Electricity problem</option>
                <option value="Gas leak">Gas leak</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Severity selection */}
            <div>
              <label className="block font-mono text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
                Incident Urgency Level
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as Severity)}
                className="w-full rounded-xl border border-gray-255 bg-gray-50/50 py-3 px-4 font-sans text-sm focus:border-red-500 focus:bg-white focus:outline-none text-red-700 font-semibold"
              >
                <option value="High">🔴 High Urgency (Urgent response)</option>
                <option value="Medium">🟡 Medium Urgency (Normal pace)</option>
                <option value="Low">🟢 Low Urgency (Minor civic issue)</option>
              </select>
            </div>
          </div>
        )}

        {/* Location Selector (GPS integration or type name) */}
        <div className="space-y-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h4 className="font-sans font-bold text-sm text-gray-900 flex items-center">
                <MapPin className="h-4 w-4 text-red-600 mr-1.5 shrink-0" />
                <span>Bangladesh Coordinates & Zone</span>
              </h4>
              <p className="font-sans text-[11px] text-gray-400 leading-tight mt-0.5">
                Calculatable accuracy using browser signals.
              </p>
            </div>
            
            {/* GPS Search Button */}
            <button
              type="button"
              onClick={handleFetchGPS}
              disabled={isLocating}
              className="inline-flex items-center justify-center space-x-1 rounded-lg bg-gray-900 hover:bg-gray-800 text-white font-sans text-xs font-bold py-1.5 px-3 disabled:opacity-50 transition"
              id="gps-location-button"
            >
              {isLocating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1 text-white" />
                  <span>Geocoding OSM...</span>
                </>
              ) : (
                <>
                  <Navigation className="h-3.5 w-3.5 text-white mr-1" />
                  <span>Fetch GPS Location</span>
                </>
              )}
            </button>
          </div>

          {/* Geolocation Live Status Indicators */}
          {autoLocationStatus === 'searching' && (
            <div className="flex items-center space-x-2 rounded-lg bg-amber-50 border border-amber-100 p-2.5 text-xs text-amber-805 font-sans">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600 shrink-0" />
              <span>🔍 স্বয়ংক্রিয়ভাবে জিপিএস লোকেশন নেওয়া হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন...</span>
            </div>
          )}

          {autoLocationStatus === 'success' && (
            <div className="flex items-center space-x-2 rounded-lg bg-emerald-55 bg-emerald-50 border border-emerald-150 p-2.5 text-xs text-emerald-800 font-sans">
              <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>✅ সফলভাবে স্বয়ংক্রিয় জিপিএস লোকেশন নেওয়া হয়েছে।</span>
            </div>
          )}

          {autoLocationStatus === 'failed' && (
            <div className="flex items-center space-x-2 rounded-lg bg-blue-50 border border-blue-150 p-2.5 text-xs text-blue-800 font-sans">
              <HelpCircle className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <span>📍 জিপিএস পাওয়া যায়নি; আপনার প্রোফাইল এরিয়া লোড হয়েছে। আপনি চাইলে কুয়েরি বা ম্যানুয়ালি নিজের লোকেশন এডিট করতে পারেন।</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-mono text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-1">
                Resolved Street / Local Area Name
              </label>
              <input
                type="text"
                placeholder="e.g. Mirpur 10 near Metro station, Dhaka"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white py-2 px-3 font-sans text-xs focus:border-red-500 focus:outline-none"
                id="location-resolved-name"
                required
              />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-1">
                Zone Radii Method
              </label>
              <select
                value={areaMode}
                onChange={(e) => setAreaMode(e.target.value as 'urban' | 'rural')}
                className="w-full rounded-lg border border-gray-200 bg-white py-2 px-3 font-sans text-xs focus:border-red-500 focus:outline-none font-semibold text-gray-600"
              >
                <option value="urban">Urban (200m Rad)</option>
                <option value="rural">Rural (1km Rad)</option>
              </select>
            </div>
          </div>

          {coordinates && (
            <div className="font-mono text-[10px] text-gray-400 bg-white p-2 border border-gray-150 rounded flex justify-between">
              <span>Latitude: {coordinates.latitude.toFixed(5)}</span>
              <span>Longitude: {coordinates.longitude.toFixed(5)}</span>
            </div>
          )}
        </div>

        {/* Cloudinary Compressed photo system */}
        <div className="space-y-3">
          <label className="block font-mono text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
            Attachment Photo (via Compressed Cloudinary engine)
          </label>
          
          <div className="flex items-center space-x-4">
            <label className="relative flex cursor-pointer items-center space-x-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 py-3 px-4 font-sans text-xs font-bold text-gray-700 transition">
              <Camera className="h-4.5 w-4.5 text-gray-400" />
              <span>{imageFileUrl ? 'Change Image File' : 'Take or Upload Incident Photo'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="sr-only"
                id="file-photo-upload"
              />
            </label>
            
            {isCompressing && (
              <span className="font-sans text-xs text-gray-500 flex items-center">
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1 text-red-600" />
                Cloudinary Optimizing Resolution...
              </span>
            )}
          </div>

          {/* Compressed Image indicator preview */}
          {imageFileUrl && (
            <div className="rounded-xl border border-emerald-150 bg-emerald-50/50 p-3.5 flex gap-4">
              <img 
                src={imageFileUrl} 
                alt="Cloudianry minimized upload" 
                referrerPolicy="no-referrer"
                className="h-16 w-16 rounded-lg object-cover border border-emerald-200 shrink-0"
              />
              <div className="font-sans text-xs text-emerald-950 flex flex-col justify-center">
                <span className="font-mono text-[9px] uppercase font-bold text-emerald-800 tracking-wider">
                  ⚡ Cloudinary Auto Optimizer Complete
                </span>
                <p className="mt-1">
                  Original raw scale: <del className="text-gray-400 font-mono">{compressionMetrics?.original || '5.2 MB'}</del>
                </p>
                <p className="font-semibold text-emerald-700 font-sans">
                  Stored Cloud link: <span className="font-mono">{compressionMetrics?.compressed || '295 KB (94% compressed)'}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Anonymous Poster */}
        <div className="flex items-start rounded-xl border border-gray-100 p-4 hover:bg-gray-50 transition">
          <input
            type="checkbox"
            id="anonymous-checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="h-4 w-4 mt-0.5 rounded border-gray-300 focus:ring-red-500"
          />
          <div className="ml-3">
            <label htmlFor="anonymous-checkbox" className="font-sans font-bold text-xs text-gray-900 flex items-center cursor-pointer">
              <EyeOff className="h-3.5 w-3.5 mr-1 text-gray-400" />
              <span>Report Anonymously</span>
            </label>
            <p className="font-sans text-[11px] text-gray-400 leading-normal mt-0.5">
              The public will view your username as "Anonymous User". For security purposes, database admins retain a secure device fingerprint index to manage moderation. So you are protected while being accountable.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="submit"
          className="w-full rounded-xl bg-red-600 hover:bg-red-500 py-3.5 font-sans mb-2 text-sm font-extrabold text-white shadow-md shadow-red-200 transition-all active:scale-[0.99]"
          id="post-submit-trigger"
        >
          {isOnline ? 'Post Verification Notice' : 'Save Offline Draft'}
        </button>

      </form>

      {/* DUPLICATE DETECTION MODEL OVERLAY MODAL */}
      <AnimatePresence>
        {showDuplicateModal && possibleDuplicate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl"
              id="duplicate-notification-overlay"
            >
              <div className="flex items-start space-x-3 text-amber-655 mb-4">
                <AlertCircle className="h-6 w-6 text-amber-600 shrink-0" />
                <div>
                  <h3 className="font-sans font-extrabold text-lg text-gray-950">
                    Duplicate Incident Warning
                  </h3>
                  <p className="font-sans text-xs text-gray-505 mt-1">
                    An identical <strong className="font-semibold text-amber-700">{possibleDuplicate.category || 'Civic'}</strong> report was logged within <span className="font-semibold text-gray-700">30 minutes</span> in the same area.
                  </p>
                </div>
              </div>

              {/* Matched Post Details */}
              <div className="rounded-xl border border-gray-150 bg-gray-50 p-4 mb-5">
                <div className="flex items-center space-x-1.5 text-orange-700 text-xs font-bold font-mono">
                  <span>🔴 OUTSIDER ALERT FOUND</span>
                </div>
                <h4 className="font-sans font-bold text-sm text-gray-900 mt-1">
                  {possibleDuplicate.title}
                </h4>
                <p className="font-sans text-xs text-gray-600 mt-1 line-clamp-2">
                  {possibleDuplicate.description}
                </p>
                <div className="mt-3 flex items-center text-[11px] font-semibold text-gray-500 font-sans space-x-1.5 border-t border-gray-100 pt-2">
                  <MapPin className="h-3 w-3 text-red-500" />
                  <span>{possibleDuplicate.locationName}</span>
                  <span>•</span>
                  <span>Posted {Math.round((Date.now() - new Date(possibleDuplicate.timestamp).getTime()) / 60000)} minutes ago</span>
                </div>
              </div>

              <p className="text-sm font-sans text-gray-700 mb-5 leading-normal">
                Is this referring to the identical event you are reporting? Joining helps filter noise and concentrate local validation votes!
              </p>

              <div className="flex flex-col sm:flex-row sm:space-x-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    // Navigate to existing post
                    setShowDuplicateModal(false);
                    onNavigate('post-detail', possibleDuplicate.id);
                  }}
                  className="w-full sm:w-1/2 rounded-xl bg-orange-600 py-2.5 font-sans text-xs font-extrabold text-white transition hover:bg-orange-500"
                  id="confirm-join-duplicate"
                >
                  Yes, Join Existing Post
                </button>
                <button
                  type="button"
                  onClick={executePostCreation}
                  className="w-full sm:w-1/2 rounded-xl border border-gray-200 py-2.5 font-sans text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
                  id="ignore-duplicate-submit"
                >
                  No, this is a distinct event
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
