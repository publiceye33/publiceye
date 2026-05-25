'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/navbar';
import { useAuth } from '@/context/auth-context';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocs,
  addDoc,
  doc,
  writeBatch
} from 'firebase/firestore';
import { 
  getDistanceInMeters, 
  reverseGeocode, 
  getCategoryExpiryHours, 
  offlineDrafts, 
  OfflinePost 
} from '@/lib/utils';
import { 
  Flame, 
  MapPin, 
  AlertTriangle, 
  Filter, 
  Compass, 
  Clock, 
  Layers, 
  MessageSquare, 
  CheckCircle, 
  Users, 
  Sparkles, 
  Database,
  Search,
  WifiOff,
  RefreshCw,
  Archive,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Info
} from 'lucide-react';

interface PostType {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  latitude: number;
  longitude: number;
  locationName: string;
  type: 'alert' | 'civic';
  category?: string;
  severity?: 'low' | 'medium' | 'high';
  isAnonymous: boolean;
  authorId: string;
  authorName: string;
  createdAt: any; 
  expiresAt: any;
  isExpired: boolean;
  votesTrue: number;
  votesFalse: number;
  votesUnsure: number;
  votesSupport: number;
  votesNotPriority: number;
  reportsCount: number;
  isFlagged: boolean;
}

// Sample preseeded feed items in case Firestore is fresh, giving an incredibly responsive first impression
const MOCK_FALLBACK_POSTS: PostType[] = [
  {
    id: "fp_fire_mirpur",
    title: "Severe fire breakout at garbage pile near Mirpur 12 bus stand",
    description: "The garbage pile near Mirpur 12 stand suddenly caught fire. Dense toxic black smoke is accumulating. Locals are trying to control it using water buckets and sand. Fire department has been notified. Avoid this lane.",
    imageUrl: "https://picsum.photos/seed/dhaka_fire/800/600",
    latitude: 23.8223,
    longitude: 90.3654,
    locationName: "Mirpur 12, Dhaka",
    type: "alert",
    category: "Fire",
    severity: "high",
    isAnonymous: false,
    authorId: "user_hasan",
    authorName: "Hasan Mahmud",
    createdAt: { seconds: Date.now() / 1000 - 3600 }, // 1 hr ago
    expiresAt: { seconds: Date.now() / 1000 + 82800 }, // 23 hrs left
    isExpired: false,
    votesTrue: 18,
    votesFalse: 1,
    votesUnsure: 2,
    votesSupport: 0,
    votesNotPriority: 0,
    reportsCount: 0,
    isFlagged: false
  },
  {
    id: "fp_civic_dhanmondi",
    title: "Request for immediate dustbin placement and regular waste collection",
    description: "Trash is being dumped directly on the sidewalk of Dhanmondi Road 27, rendering walking impossible. We need proper municipality waste boxes here as soon as possible.",
    imageUrl: "https://picsum.photos/seed/waste_dhanmondi/800/600",
    latitude: 23.7508,
    longitude: 90.3703,
    locationName: "Dhanmondi, Dhaka",
    type: "civic",
    category: "Other",
    isAnonymous: true,
    authorId: "user_anonymous",
    authorName: "Anonymous User",
    createdAt: { seconds: Date.now() / 1000 - 18000 }, // 5 hrs ago
    expiresAt: { seconds: Date.now() / 1000 + 30 * 24 * 3600 }, // 30 days
    isExpired: false,
    votesTrue: 0,
    votesFalse: 0,
    votesUnsure: 0,
    votesSupport: 54,
    votesNotPriority: 2,
    reportsCount: 0,
    isFlagged: false
  },
  {
    id: "fp_water_uttara",
    title: "Serious water logging and clogged drainage",
    description: "After only an hour of rain, Sector 4 streets are completely submerged in knee-deep water. This is happening due to clogged drainage outlets near the primary school. Needs immediate cleaning.",
    latitude: 23.8583,
    longitude: 90.4012,
    locationName: "Sector 4, Uttara, Dhaka",
    type: "alert",
    category: "Water problem",
    severity: "medium",
    isAnonymous: false,
    authorId: "user_jamil",
    authorName: "Jamil Ahmed",
    createdAt: { seconds: Date.now() / 1000 - 43200 }, // 12 hrs ago
    expiresAt: { seconds: Date.now() / 1000 + 6 * 24 * 3600 }, // 6 days left
    isExpired: false,
    votesTrue: 9,
    votesFalse: 0,
    votesUnsure: 1,
    votesSupport: 0,
    votesNotPriority: 0,
    reportsCount: 0,
    isFlagged: false
  }
];

export default function HomeFeed() {
  const router = useRouter();
  const { user, profile } = useAuth();
  
  // Stable timestamp to prevent impure Date.now render blocks
  const [nowSecs] = useState(() => Date.now() / 1000);

  // Selected Section State
  const [activeTab, setActiveTab] = useState<'alert' | 'civic'>('alert');

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSeverity, setSelectedSeverity] = useState('All');
  const [timeFilter, setTimeFilter] = useState<'all' | '24h' | '3d' | '7d'>('all');
  const [selectedArea, setSelectedArea] = useState('All');

  // Core Data States
  const [posts, setPosts] = useState<PostType[]>([]);
  const [onlineStatus, setOnlineStatus] = useState(true);
  const [syncingDrafts, setSyncingDrafts] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const [fetchingPosts, setFetchingPosts] = useState(true);

  // GPS / Geolocation State
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocationName, setUserLocationName] = useState<string>('Detecting location...');
  const [gpsError, setGpsError] = useState<string | null>(null);

  // List of unique areas found in posts to feed the area filter
  const [areaList, setAreaList] = useState<string[]>([]);

  // Categories list
  const categories = [
    'All', 'Fire', 'Accident', 'Flood', 'Storm', 'Robbery/Crime', 
    'Road damage', 'Water problem', 'Electricity problem', 'Gas leak', 'Other'
  ];

  // Geolocation detector
  const detectUserLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser');
      setUserLocationName('Dhaka, Bangladesh');
      return;
    }

    setGpsError(null);
    setUserLocationName('Fetching GPS Coordinates...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserLocation({ lat, lng });
        
        // Convert to readable area name using OpenStreetMap Nominatim
        const areaName = await reverseGeocode(lat, lng);
        setUserLocationName(areaName);
      },
      (error) => {
        console.warn("GPS Detection Error:", error);
        setGpsError('GPS access denied. Enter location manually during posts.');
        // Set default coordinates to center of Dhaka (Dhaka GPO coords)
        setUserLocation({ lat: 23.7250, lng: 90.4070 });
        setUserLocationName('Dhaka Center, Bangladesh');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  };

  // Offline Sync trigger
  const triggerOfflineSync = async () => {
    const drafts = offlineDrafts.getDrafts();
    if (drafts.length === 0 || syncingDrafts || !navigator.onLine || !user) return;

    setSyncingDrafts(true);
    let successCount = 0;

    try {
      const batch = writeBatch(db);
      
      for (const draft of drafts) {
        // Upload draft to firestore
        const docRef = collection(db, 'posts');
        const firestoreDoc = {
          title: draft.title,
          description: draft.description,
          latitude: draft.latitude,
          longitude: draft.longitude,
          locationName: draft.locationName,
          type: draft.type,
          isAnonymous: draft.isAnonymous,
          authorId: user.uid,
          authorName: draft.isAnonymous ? 'Anonymous User' : (profile?.name || 'Community Member'),
          isExpired: false,
          createdAt: new Date(), // rule checks will validate
          expiresAt: new Date(Date.now() + getCategoryExpiryHours(draft.category || 'Other') * 3600 * 1000),
          reportsCount: 0,
          isFlagged: false,
          // Optional parameters
          ...(draft.category && { category: draft.category }),
          ...(draft.severity && { severity: draft.severity }),
          ...(draft.localImageBase64 && { imageUrl: draft.localImageBase64 }), // In full network mode, proxy server replaces base64
          // Counters
          votesTrue: 0,
          votesFalse: 0,
          votesUnsure: 0,
          votesSupport: 0,
          votesNotPriority: 0
        };

        await addDoc(docRef, firestoreDoc);
        offlineDrafts.removeDraft(draft.id);
        successCount++;
      }
      
      setDraftCount(offlineDrafts.getDrafts().length);
      console.log(`Successfully synced ${successCount} offline drafts to firestore.`);
    } catch (err) {
      console.error("Failed to sync offline posts:", err);
    } finally {
      setSyncingDrafts(false);
    }
  };

  useEffect(() => {
    setTimeout(() => detectUserLocation(), 0);

    // Check offline status
    const handleOnline = () => {
      setOnlineStatus(true);
      triggerOfflineSync();
    };
    const handleOffline = () => setOnlineStatus(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    setTimeout(() => {
      setOnlineStatus(navigator.onLine);
      setDraftCount(offlineDrafts.getDrafts().length);
    }, 0);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Automatically trigger sync if online when user details change
  useEffect(() => {
    if (user && onlineStatus) {
      setTimeout(() => triggerOfflineSync(), 0);
    }
  }, [user, onlineStatus]);

  // Firestore Snapshot Subscription
  useEffect(() => {
    let unsubscribe = () => {};

    try {
      const postsRef = collection(db, 'posts');
      // Subscribed to all active posts (not expired)
      const q = query(postsRef, where("isExpired", "==", false));
      
      unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedList: PostType[] = [];
        const uniqueAreas = new Set<string>();

        snapshot.forEach((doc) => {
          const data = doc.data();
          fetchedList.push({
            id: doc.id,
            ...data
          } as PostType);
          
          if (data.locationName) {
            // Pick the general municipality/area name (e.g. split by commas)
            const parts = data.locationName.split(',');
            const generalArea = parts[0]?.trim() || '';
            if (generalArea) uniqueAreas.add(generalArea);
          }
        });

        // Set unique area lists for filtering
        setAreaList(Array.from(uniqueAreas));

        // If no posts in firestore database, we augment with premium MOCK data to make page gorgeous
        if (fetchedList.length === 0) {
          setPosts(MOCK_FALLBACK_POSTS);
        } else {
          setPosts(fetchedList);
        }
        setFetchingPosts(false);
      }, (err) => {
        console.error("Firestore loading error (likely rule block before onboarding is done or offline):", err);
        // Fallback to high-quality mockup list for instant validation
        setPosts(MOCK_FALLBACK_POSTS);
        setFetchingPosts(false);
      });
    } catch (err) {
      console.warn("Unable to establish Live onSnapshot. Utilizing fallback content.");
      setTimeout(() => {
        setPosts(MOCK_FALLBACK_POSTS);
        setFetchingPosts(false);
      }, 0);
    }

    return () => unsubscribe();
  }, [user]);

  // CORE FILTERING & SORTING ALGORITHM
  // Rules:
  // Feed ordering:
  // 1. Nearby High Severity posts first (<15km)
  // 2. Nearby Medium Severity posts (<15km)
  // 3. Nearby Civic/Low alerts
  // 4. Distant alerts last
  const getFilteredAndSortedPosts = () => {
    let result = [...posts];

    // 1. Filter by Active Section TAB
    result = result.filter(post => post.type === activeTab);

    // 2. Search Box Filter
    if (searchQuery.trim() !== '') {
      const qs = searchQuery.toLowerCase();
      result = result.filter(post => 
        post.title.toLowerCase().includes(qs) || 
        post.description.toLowerCase().includes(qs) ||
        post.locationName.toLowerCase().includes(qs) ||
        (post.category && post.category.toLowerCase().includes(qs))
      );
    }

    // 3. Category Filter
    if (selectedCategory !== 'All') {
      result = result.filter(post => post.category === selectedCategory);
    }

    // 4. Severity Filter (Alerts only)
    if (activeTab === 'alert' && selectedSeverity !== 'All') {
      result = result.filter(post => post.severity === selectedSeverity.toLowerCase());
    }

    // 5. Area Filter
    if (selectedArea !== 'All') {
      result = result.filter(post => post.locationName.includes(selectedArea));
    }

    // 6. Time Filter
    if (timeFilter !== 'all') {
      const now = nowSecs;
      let threshold = 3600 * 24; // Default 24h
      if (timeFilter === '3d') threshold = 3600 * 24 * 3;
      if (timeFilter === '7d') threshold = 3600 * 24 * 7;

      result = result.filter(post => {
        const postSecs = post.createdAt?.seconds || nowSecs - 300;
        return (now - postSecs) < threshold;
      });
    }

    // 7. COMPLEX GEOPROXIMITY SORTING ENGINE
    // Rules: Nearby (defined as within 15km) High severity first, then Medium, then others
    result.sort((a, b) => {
      // Calculate distances if GPS is available
      let distA = Infinity;
      let distB = Infinity;

      if (userLocation) {
        distA = getDistanceInMeters(userLocation.lat, userLocation.lng, a.latitude, a.longitude);
        distB = getDistanceInMeters(userLocation.lat, userLocation.lng, b.latitude, b.longitude);
      }

      const isA_Nearby = distA <= 15000; // 15 km limit
      const isB_Nearby = distB <= 15000;

      // Type-based sorting
      if (activeTab === 'alert') {
        // High severity nearby goes absolute top
        const scoreA = (isA_Nearby ? 100 : 0) + (a.severity === 'high' ? 50 : a.severity === 'medium' ? 25 : 0);
        const scoreB = (isB_Nearby ? 100 : 0) + (b.severity === 'high' ? 50 : b.severity === 'medium' ? 25 : 0);
        
        if (scoreA !== scoreB) {
          return scoreB - scoreA; // Descending score
        }
      } else {
        // Civic Tab: sorting simply by Nearby first, followed by demand volume (votesSupport)
        if (isA_Nearby && !isB_Nearby) return -1;
        if (!isA_Nearby && isB_Nearby) return 1;
        
        // If both in similar distance bucket, sort by most supported
        const supportA = a.votesSupport || 0;
        const supportB = b.votesSupport || 0;
        if (supportA !== supportB) return supportB - supportA;
      }

      // Default fallback: Recency
      const timeSecsA = a.createdAt?.seconds || 0;
      const timeSecsB = b.createdAt?.seconds || 0;
      return timeSecsB - timeSecsA;
    });

    return result;
  };

  const processedPosts = getFilteredAndSortedPosts();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="home-feed-layout-container">
      <Navbar />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-grow w-full">
        
        {/* Offline Banner */}
        {!onlineStatus && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex items-center gap-3 shadow-sm animate-pulse">
            <WifiOff className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="flex-grow text-sm">
              <span className="font-bold">Operating Offline</span>. You can still review cached reports, and create new drafts. They will automatically sync when network returns.
            </div>
            {draftCount > 0 && (
              <span className="bg-amber-100 text-amber-800 text-xs font-mono font-bold px-2.5 py-1 rounded-full shrink-0">
                {draftCount} queued draft{draftCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* Sync loading */}
        {syncingDrafts && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-950 rounded-2xl flex items-center gap-3 animate-pulse">
            <RefreshCw className="w-5 h-5 text-rose-600 shrink-0 animate-spin" />
            <div className="text-sm font-semibold">Syncing offline reports with Bangladesh verification server...</div>
          </div>
        )}

        {/* Dynamic Location Banner */}
        <div className="mb-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-rose-600 shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-mono tracking-wider uppercase font-semibold leading-none">Your Location Basin Point</p>
              <h3 className="font-semibold text-slate-900 flex items-center gap-1.5 mt-1 leading-tight">
                <MapPin className="w-4 h-4 text-rose-500 fill-rose-100" />
                {userLocationName}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={detectUserLocation}
              className="px-3.5 py-2 hover:bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 transition-colors flex items-center gap-1.5"
              id="button-refresh-gps"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Recalibrate GPS
            </button>
            <Link
              href="/archive"
              className="px-3.5 py-2 hover:bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 transition-colors flex items-center gap-1.5"
              id="link-expired-archive"
            >
              <Archive className="w-3.5 h-3.5" />
              View Archive
            </Link>
          </div>
        </div>

        {/* Hero Headline Card */}
        <div className="mb-8 p-6 sm:p-8 bg-slate-900 rounded-3xl text-white relative overflow-hidden shadow-md">
          <div className="relative z-10 max-w-2xl">
            <span className="bg-rose-600 font-semibold font-mono tracking-wider text-[11px] uppercase text-white px-3 py-1 rounded-full mb-3 inline-block">
              Dhaka Launch Division
            </span>
            <h1 className="text-3xl sm:text-4xl font-heading font-black tracking-tight leading-tight">
              Self-Moderating Local Incident Registry
            </h1>
            <p className="text-slate-300 text-sm sm:text-base mt-2 leading-relaxed">
              Report accidents, fires, civic issues, and combat rumors in Bangladesh. Community votes dynamically separate facts from emergency fake news.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/create"
                className="bg-white hover:bg-slate-100 text-slate-950 font-bold text-sm px-5 py-2.5 rounded-xl transition-all shadow-sm active:scale-95 text-center shrink-0"
              >
                File an Incident Report
              </Link>
              {!user && (
                <Link
                  href="/login"
                  className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors text-center shrink-0"
                >
                  Join PublicEye
                </Link>
              )}
            </div>
          </div>
          <div className="absolute top-1/2 -right-12 -translate-y-1/2 opacity-10 pointer-events-none hidden lg:block">
            <AlertTriangle className="w-96 h-96" />
          </div>
        </div>

        {/* Search & Grid Controls layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* COLUMN 1: Search & Filters sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5" id="feed-filter-sidebar">
              <div className="flex items-center justify-between">
                <h4 className="font-heading font-bold text-slate-900 text-base flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-600" />
                  Feed Filters
                </h4>
                {(searchQuery || selectedCategory !== 'All' || selectedSeverity !== 'All' || timeFilter !== 'all' || selectedArea !== 'All') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                      setSelectedSeverity('All');
                      setTimeFilter('all');
                      setSelectedArea('All');
                    }}
                    className="text-[11px] font-bold text-rose-600 hover:underline"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Search input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500">Query Search</label>
                <div className="relative rounded-xl shadow-sm">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search keyword..."
                    className="block w-full pl-3 pr-9 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-slate-900 focus:border-slate-900 text-slate-900 placeholder-slate-400"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                </div>
              </div>

              {/* Category Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="block w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:ring-slate-900 focus:border-slate-900 text-slate-800"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Severity (Alerts only) */}
              {activeTab === 'alert' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 font-medium">Severity Level</label>
                  <div className="grid grid-cols-4 gap-1">
                    {['All', 'High', 'Medium', 'Low'].map((sev) => (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => setSelectedSeverity(sev)}
                        className={`text-xs font-medium py-2 rounded-lg border transition-colors ${
                          selectedSeverity === sev
                            ? 'bg-slate-900 text-white border-slate-900 font-bold'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Time Window Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500">Time Reported</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: 'Anytime', value: 'all' },
                    { label: 'Last 24 hrs', value: '24h' },
                    { label: 'Last 3 days', value: '3d' },
                    { label: 'Last 7 days', value: '7d' },
                  ].map((tf) => (
                    <button
                      key={tf.value}
                      type="button"
                      onClick={() => setTimeFilter(tf.value as any)}
                      className={`text-xs py-2 rounded-lg border text-center transition-colors ${
                        timeFilter === tf.value
                          ? 'bg-slate-900 text-white border-slate-900 font-bold'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Area selector */}
              {areaList.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">Filter by Area</label>
                  <select
                    value={selectedArea}
                    onChange={(e) => setSelectedArea(e.target.value)}
                    className="block w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:ring-slate-900"
                  >
                    <option value="All">All Bangladesh Areas</option>
                    {areaList.map(areaName => (
                      <option key={areaName} value={areaName}>{areaName}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center gap-2 text-[10px] text-slate-400 font-mono tracking-tight leading-normal">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                GPS proximity sorts: Nearby incidents within 15km prioritizing extreme values are loaded first.
              </div>

            </div>
          </div>

          {/* COLUMN 2: TAB Navigation & POST FEED */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* TAB PANELS TRIGGER */}
            <div className="bg-white p-1 rounded-2xl border border-slate-200/80 shadow-sm flex">
              <button
                onClick={() => {
                  setActiveTab('alert');
                  setSelectedSeverity('All');
                }}
                className={`flex-grow py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2.5 transition-all ${
                  activeTab === 'alert'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-55'
                }`}
                id="tab-alerts-trigger"
              >
                <Flame className="w-4 h-4" />
                Active Alerts (Emergency)
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${activeTab === 'alert' ? 'bg-rose-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {posts.filter(p => p.type === 'alert').length}
                </span>
              </button>
              
              <button
                onClick={() => {
                  setActiveTab('civic');
                  setSelectedSeverity('All');
                }}
                className={`flex-grow py-3.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2.5 transition-all ${
                  activeTab === 'civic'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-55'
                }`}
                id="tab-civic-demands-trigger"
              >
                <Users className="w-4 h-4" />
                Civic Demands (Improvement)
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${activeTab === 'civic' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {posts.filter(p => p.type === 'civic').length}
                </span>
              </button>
            </div>

            {/* FEED ITEMS CONTAINER */}
            <div className="space-y-6" id="post-feed-list">
              {fetchingPosts ? (
                <div className="bg-white py-16 px-4 rounded-3xl border border-slate-200 text-center shadow-sm">
                  <RefreshCw className="w-10 h-10 text-slate-400 animate-spin mx-auto mb-4" />
                  <p className="text-slate-600 font-semibold text-sm">Synchronizing live reports map, please hold...</p>
                </div>
              ) : processedPosts.length === 0 ? (
                <div className="bg-white py-16 px-4 rounded-3xl border border-slate-200 text-center shadow-sm max-w-xl mx-auto space-y-4">
                  <Layers className="w-12 h-12 text-slate-300 mx-auto" />
                  <h3 className="font-heading font-extrabold text-xl text-slate-900 tracking-tight">No Active Reports Found</h3>
                  <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
                    Try broadening your filters or be the first in your Bangladesh area to report an emergency or register a civic demand.
                  </p>
                  <Link
                    href="/create"
                    className="inline-block bg-slate-950 hover:bg-slate-900 text-white text-xs font-bold px-6 py-3 rounded-xl transition-transform active:scale-95 shadow-sm"
                  >
                    File First Report
                  </Link>
                </div>
              ) : (
                processedPosts.map((post) => {
                  // Post calculations
                  let distanceText = '';
                  let isNearby = false;
                  if (userLocation) {
                    const distMat = getDistanceInMeters(userLocation.lat, userLocation.lng, a_latitude(post.latitude), a_longitude(post.longitude));
                    isNearby = distMat <= 15000;
                    distanceText = distMat < 1000 ? `${Math.round(distMat)}m away` : `${(distMat/1000).toFixed(1)}km away`;
                  }

                  function a_latitude(lat: any) { return typeof lat === 'number' ? lat : 23.7; }
                  function a_longitude(lng: any) { return typeof lng === 'number' ? lng : 90.3; }

                  const isAlert = post.type === 'alert';
                  const isHighSev = isAlert && post.severity === 'high';
                  const isMedSev = isAlert && post.severity === 'medium';

                  // compute vote ratio if alerts
                  const totalAlertVotes = (post.votesTrue || 0) + (post.votesFalse || 0) + (post.votesUnsure || 0);
                  const percentTrue = totalAlertVotes > 0 ? Math.round(((post.votesTrue || 0) / totalAlertVotes) * 100) : 0;
                  const percentFalse = totalAlertVotes > 0 ? Math.round(((post.votesFalse || 0) / totalAlertVotes) * 100) : 0;

                  return (
                    <article 
                      key={post.id} 
                      className={`bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col md:flex-row transition-all hover:shadow-md ${
                        isHighSev ? 'ring-2 ring-rose-500' : ''
                      }`}
                      id={`post-card-${post.id}`}
                    >
                      {/* Left Block: Image */}
                      {post.imageUrl && (
                        <div className="md:w-1/3 min-h-[220px] max-h-[300px] relative shrink-0 bg-slate-100">
                          <img
                            src={post.imageUrl}
                            alt={post.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          
                          {/* Floating badges */}
                          {isAlert && (
                            <span className={`absolute top-4 left-4 font-mono font-bold text-[10px] tracking-wider uppercase px-3 py-1 rounded-full text-white shadow-sm ${
                              isHighSev ? 'bg-rose-600' : isMedSev ? 'bg-amber-500' : 'bg-emerald-600'
                            }`}>
                              {post.severity} severity
                            </span>
                          )}
                        </div>
                      )}

                      {/* Right Block: Core Content */}
                      <div className="p-6 sm:p-7 flex-grow flex flex-col justify-between">
                        <div>
                          {/* Meta line */}
                          <div className="flex flex-wrap items-center gap-y-2 gap-x-3 text-slate-500 text-xs mb-3 font-medium">
                            <span className="font-bold text-rose-600 uppercase tracking-widest font-mono text-[10px] block py-0.5 px-2 bg-rose-50 rounded-md">
                              {post.category || 'INSPECTION'}
                            </span>
                            
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span className="text-slate-800 font-semibold">{post.locationName}</span>
                            </span>

                            {distanceText && (
                              <span className={`font-mono px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                isNearby ? 'bg-slate-100 text-slate-800' : 'bg-slate-50 text-slate-500'
                              }`}>
                                {distanceText}
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <Link href={`/post/${post.id}`} className="block group mb-3">
                            <h3 className="text-xl font-heading font-extrabold text-slate-950 leading-tight group-hover:text-rose-600 transition-colors">
                              {post.title}
                            </h3>
                          </Link>

                          {/* Description */}
                          <p className="text-slate-600 text-sm leading-relaxed mb-4 line-clamp-3">
                            {post.description}
                          </p>
                        </div>

                        {/* Interactive dynamic footer representing Voting/Demands dashboard */}
                        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          
                          {/* Poster metadata */}
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-400">By</span>
                            <span className="font-semibold text-slate-700">
                              {post.isAnonymous ? 'Anonymous User' : post.authorName}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-400 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {post.createdAt?.seconds 
                                ? new Date(post.createdAt.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                                : 'Draft'
                              }
                            </span>
                          </div>

                          {/* Voting ratio output bar */}
                          <div className="flex items-center gap-3 shrink-0">
                            {isAlert ? (
                              /* Tab 1: Alert dynamic community evaluation progress */
                              <div className="flex flex-col gap-1 w-full max-w-[200px] sm:w-[170px]" title="Community Validation Indexes">
                                <div className="flex justify-between text-[11px] font-bold text-slate-700">
                                  <span className="text-emerald-700">True: {percentTrue}%</span>
                                  <span className="text-rose-700">False: {percentFalse}%</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden flex">
                                  <div 
                                    className="h-full bg-emerald-500" 
                                    style={{ width: `${percentTrue}%` }}
                                  />
                                  <div 
                                    className="h-full bg-rose-500" 
                                    style={{ width: `${percentFalse}%` }}
                                  />
                                  <div 
                                    className="h-full bg-slate-300" 
                                    style={{ width: `${100 - percentTrue - percentFalse}%` }}
                                  />
                                </div>
                                <span className="text-[9px] font-mono text-slate-400 text-right leading-none mt-1">
                                  {totalAlertVotes} validation votes
                                </span>
                              </div>
                            ) : (
                              /* Tab 2: Civic demands support score */
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                                  <ThumbsUp className="w-3.5 h-3.5 text-slate-400" />
                                  <b className="text-slate-900 font-extrabold">{post.votesSupport || 0}</b> supports
                                </span>
                              </div>
                            )}

                            {/* View details action button */}
                            <Link 
                              href={`/post/${post.id}`}
                              className="px-4 py-2 hover:bg-slate-900 bg-slate-100 text-slate-800 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                              id={`button-view-details-${post.id}`}
                            >
                              Details
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Link>

                          </div>

                        </div>

                        {/* Automatic PWA disclaimer warning as requested by regulatory guideline */}
                        <div className="mt-3.5 text-[9px] font-mono text-slate-400 border-t border-slate-50/50 pt-2 flex items-center gap-1 bg-slate-50/30 p-1.5 rounded-lg">
                          <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                          <span>Disclaimer: Submitted by citizens. Subject to verification.</span>
                        </div>

                      </div>
                    </article>
                  );
                })
              )}
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}
