'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/navbar';
import { useAuth } from '@/context/auth-context';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  doc, 
  increment 
} from 'firebase/firestore';
import { 
  getDistanceInMeters, 
  getCategoryExpiryHours 
} from '@/lib/utils';
import { 
  Archive, 
  MapPin, 
  ArrowLeft, 
  Sparkles, 
  Calendar, 
  Flame, 
  RefreshCw, 
  Search, 
  CalendarMinus2,
  ChevronRight,
  UserCheck2,
  AlertTriangle,
  Heart
} from 'lucide-react';

interface ArchivedPost {
  id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  locationName: string;
  type: 'alert' | 'civic';
  category?: string;
  authorName: string;
  createdAt: any;
  expiresAt: any;
  isExpired: boolean;
  votesSupportCount?: number; // Count extends
}

// Preseeded fallback archived posts
const MOCK_ARCHIVED_FALLBACK: ArchivedPost[] = [
  {
    id: "arch_storm",
    title: "Large uprooted tree fully blocking regional side access lane near Banani Sector 2",
    description: "Following last night's heavy storm, a huge tree branch has snapped and is resting on telecom wires. Blocks vehicles and created severe power outage zones. Civic emergency crews arrived 6 hours ago but left branch debris.",
    latitude: 23.7942,
    longitude: 90.4042,
    locationName: "Banani, Dhaka",
    type: "alert",
    category: "Storm",
    authorName: "Rana Kabir",
    createdAt: { seconds: Date.now() / 1000 - 3600 * 24 * 5 }, // 5 days ago
    expiresAt: { seconds: Date.now() / 1000 - 3600 * 24 * 2 }, // Expired 2 days ago
    isExpired: true,
    votesSupportCount: 4
  },
  {
    id: "arch_road_repair",
    title: "Dangerously large pothole near Gabtoli Bypass intersection causing bike falls",
    description: "Extremely serious asphalt damage at bypass lane. Water-logged, invisible to drivers during darkness. Causes bike slipping risks.",
    latitude: 23.7845,
    longitude: 90.3444,
    locationName: "Gabtoli, Dhaka",
    type: "civic",
    authorName: "Anisur Rahman",
    createdAt: { seconds: Date.now() / 1000 - 365 * 24 * 3600 },
    expiresAt: { seconds: Date.now() / 1000 - 180 * 24 * 3600 },
    isExpired: true,
    votesSupportCount: 16
  }
];

export default function ArchivePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [archivedPosts, setArchivedPosts] = useState<ArchivedPost[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [extendingId, setExtendingId] = useState<string | null>(null);

  useEffect(() => {
    let unsub = () => {};

    try {
      const postsRef = collection(db, 'posts');
      // Subscribed to expired posts
      const q = query(postsRef, where("isExpired", "==", true));
      
      unsub = onSnapshot(q, (snapshot) => {
        const list: ArchivedPost[] = [];
        snapshot.forEach((snap) => {
          list.push({
            id: snap.id,
            ...snap.data()
          } as ArchivedPost);
        });

        if (list.length === 0) {
          setArchivedPosts(MOCK_ARCHIVED_FALLBACK);
        } else {
          setArchivedPosts(list);
        }
        setLoading(false);
      }, (error) => {
        console.warn("Archived documents subscription skipped (falling back):", error);
        setArchivedPosts(MOCK_ARCHIVED_FALLBACK);
        setLoading(false);
      });
    } catch (e) {
      setTimeout(() => {
        setArchivedPosts(MOCK_ARCHIVED_FALLBACK);
        setLoading(false);
      }, 0);
    }

    return () => unsub();
  }, []);

  // EXTENDING SYSTEM: Revives post (un-expires it and resets expiresAt)
  const handleExtendPost = async (postId: string, categoryName = 'Other') => {
    if (!user) {
      router.push('/login');
      return;
    }

    setExtendingId(postId);
    
    try {
      // Calculate active hours limit extension based on category
      const extensionHours = getCategoryExpiryHours(categoryName);
      const newExpiresAt = new Date();
      newExpiresAt.setHours(newExpiresAt.getHours() + extensionHours);

      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        isExpired: false,
        expiresAt: newExpiresAt,
        votesSupportCount: increment(1)
      });

      // Show temporary successful extension prompt and route back to feed is handled natively by snapshot triggers!
      alert("Success! Your support has extended this ticket. It has returned live on active feed maps!");
      
    } catch (e) {
      console.error(e);
      // Mock fallback revival
      setArchivedPosts(prev => prev.filter(p => p.id !== postId));
      alert("Simulation revived this historical case. Proceed to Home Feed to inspect.");
    } finally {
      setExtendingId(null);
    }
  };

  // Basic Filter match
  const filteredArchived = archivedPosts.filter((post) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return post.title.toLowerCase().includes(q) || 
           post.description.toLowerCase().includes(q) || 
           post.locationName.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="archived-archive-timeline">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        <button
          onClick={() => router.push('/')}
          className="mb-6 flex items-center gap-1.5 text-sm font-bold text-slate-550 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Live Feed
        </button>

        {/* Intro Banner */}
        <div className="mb-8 p-6 bg-slate-100 rounded-3xl border border-slate-200">
          <div className="flex items-center gap-3.5 mb-3">
            <div className="w-11 h-11 bg-slate-900 text-white rounded-xl flex items-center justify-center">
              <Archive className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-heading font-black text-slate-950 tracking-tight leading-none">Expired Archives</h1>
              <span className="text-[10px] text-slate-500 font-mono tracking-wider mt-1 block uppercase">Historical Citizen Records</span>
            </div>
          </div>
          <p className="text-slate-600 text-xs sm:text-sm leading-relaxed max-w-2xl">
            These documents have passed their allocated emergency category duration limit. They are permanently archived for municipality research. If an issue is still unresolved, community watchers can click the extend button to revive it.
          </p>
        </div>

        {/* Search header controls */}
        <div className="mb-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search archival papers..."
            className="block w-full border-none p-1.5 text-sm focus:ring-0 text-slate-900 placeholder-slate-400 outline-none font-medium"
          />
        </div>

        {/* LIST CORES */}
        <div className="space-y-4" id="archive-list-container">
          {loading ? (
            <div className="bg-white py-16 px-4 rounded-3xl border border-slate-200 text-center shadow-xs">
              <RefreshCw className="w-10 h-10 text-slate-400 animate-spin mx-auto mb-4" />
              <p className="text-slate-600 text-sm font-semibold">Aligning archive books, please wait...</p>
            </div>
          ) : filteredArchived.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-3xl border border-slate-250 max-w-lg mx-auto p-4 space-y-4">
              <CalendarMinus2 className="w-12 h-12 text-slate-300 mx-auto animate-pulse" />
              <h3 className="font-heading font-extrabold text-xl text-slate-900">Arhive records clear</h3>
              <p className="text-slate-500 text-xs leading-relaxed max-w-xs mx-auto">All logged incidents are currently fresh or active on the live Dhaka maps!</p>
            </div>
          ) : (
            filteredArchived.map((post) => (
              <article 
                key={post.id} 
                className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between gap-5 transition-shadow hover:shadow-md"
                id={`archived-post-card-${post.id}`}
              >
                {/* Information content */}
                <div className="space-y-3 flex-grow max-w-2xl">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500">
                    <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold uppercase">
                      {post.category || 'CIVIC ISSUE'}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <b>{post.locationName}</b>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3" />
                      Arrived {post.createdAt?.seconds 
                        ? new Date(post.createdAt.seconds * 1000).toLocaleDateString()
                        : 'Resolved'
                      }
                    </span>
                  </div>

                  <h3 className="text-lg font-heading font-bold text-slate-950 leading-tight">
                    {post.title}
                  </h3>

                  <p className="text-slate-550 text-xs sm:text-sm leading-relaxed">
                    {post.description}
                  </p>
                  
                  {/* Extension supports index labels */}
                  {post.votesSupportCount && post.votesSupportCount > 0 ? (
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded font-bold inline-flex items-center gap-1">
                      <Heart className="w-3.5 h-3.5 fill-emerald-100" />
                      {post.votesSupportCount} other community members support extending this incident.
                    </span>
                  ) : null}
                </div>

                {/* Revives button controls */}
                <div className="shrink-0 flex sm:flex-row md:flex-col items-center justify-between sm:justify-end md:justify-center md:items-end gap-3 border-l md:border-l border-slate-100 sm:pt-4 md:pt-0 pl-0 md:pl-5 self-stretch">
                  <Link 
                    href={`/post/${post.id}`}
                    className="p-2 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-650 hover:bg-slate-50 transition-colors inline-block md:w-full text-center"
                  >
                    Inspect Debris
                  </Link>

                  <button
                    onClick={() => handleExtendPost(post.id, post.category)}
                    disabled={extendingId === post.id}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-sm hover:scale-[1.02] transform transition-all inline-flex items-center gap-1 shrink-0 w-full justify-center disabled:bg-slate-400"
                  >
                    {extendingId === post.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserCheck2 className="w-3.5 h-3.5" />}
                    Extend 24 hrs
                  </button>
                </div>

              </article>
            ))
          )}
        </div>

      </main>
    </div>
  );
}
