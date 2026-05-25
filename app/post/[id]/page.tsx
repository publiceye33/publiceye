'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/navbar';
import { useAuth } from '@/context/auth-context';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { 
  doc, 
  getDoc, 
  onSnapshot, 
  setDoc, 
  collection, 
  addDoc, 
  updateDoc, 
  increment,
  deleteDoc
} from 'firebase/firestore';
import { 
  MapPin, 
  Clock, 
  AlertTriangle, 
  Share2, 
  ArrowLeft, 
  ThumbsUp, 
  ThumbsDown, 
  HelpCircle, 
  MessageSquare, 
  Camera, 
  EyeOff, 
  CheckCircle, 
  ShieldAlert,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Trash2,
  Flag
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

interface CommentType {
  id: string;
  content: string;
  imageUrl?: string;
  isUpdate: boolean;
  isAnonymous: boolean;
  authorId: string;
  authorName: string;
  createdAt: any;
  reportsCount: number;
}

export default function PostDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile } = useAuth();
  
  const postId = params.id as string;

  // Primary States
  const [post, setPost] = useState<PostType | null>(null);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [userVote, setUserVote] = useState<string | null>(null);

  // Comments Input Form
  const [commentText, setCommentText] = useState('');
  const [commentImage, setCommentImage] = useState<File | null>(null);
  const [commentImagePreview, setCommentImagePreview] = useState<string | null>(null);
  const [commentAnonymous, setCommentAnonymous] = useState(false);
  const [commentUpdateStatus, setCommentUpdateStatus] = useState(false);

  // Loading / Action status states
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [votingLoading, setVotingLoading] = useState(false);
  const [flaggingLoading, setFlaggingLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [commentSuccess, setCommentSuccess] = useState(false);

  // Moderate reporting states
  const [reportType, setReportType] = useState<'post' | 'comment' | null>(null);
  const [reportedCommentId, setReportedCommentId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // MOCK fallback loader if Firestore isn't populated
  const loadMockFallback = () => {
    // Generate standard fallback
    const mockPost: PostType = {
      id: postId,
      title: "Clogged regional storm-drain flooding outer avenue grid",
      description: "Severe pool logging of rain water has completed blocked sector passage. Citizens cannot access transport routes. Flooding depth is approximately 1.5 feet and rising. Water drainage outlets are fully loaded with poly bags and solid waste. Locals have tried removing debris safely but needs official civic pumps.",
      imageUrl: "https://picsum.photos/seed/sewer_clog/800/600",
      latitude: 23.7508,
      longitude: 90.3923,
      locationName: "Mirpur 10, Dhaka",
      type: "alert",
      category: "Water problem",
      severity: "medium",
      isAnonymous: false,
      authorId: "user_hasan",
      authorName: "Hasan Mahmud",
      createdAt: { seconds: Date.now() / 1000 - 3600 },
      expiresAt: { seconds: Date.now() / 1000 + 48 * 3600 },
      isExpired: false,
      votesTrue: 12,
      votesFalse: 2,
      votesUnsure: 1,
      votesSupport: 0,
      votesNotPriority: 0,
      reportsCount: 0,
      isFlagged: false
    };

    const mockComments: CommentType[] = [
      {
        id: "comm_1",
        content: "I am at Mirpur 10 right now. Avoid the primary lane, water depth has breached engine filter heights here.",
        isUpdate: true,
        isAnonymous: false,
        authorId: "user_saad",
        authorName: "Saad Karim",
        createdAt: { seconds: Date.now() / 1000 - 1800 },
        reportsCount: 0
      },
      {
        id: "comm_2",
        content: "Report is accurate. I had to merge with detour lanes at Kazipara. Unsafe conditions for two-wheelers.",
        imageUrl: "https://picsum.photos/seed/kazipara_st/800/600",
        isUpdate: false,
        isAnonymous: true,
        authorId: "user_anon",
        authorName: "Anonymous User",
        createdAt: { seconds: Date.now() / 1000 - 2400 },
        reportsCount: 0
      }
    ];

    setPost(mockPost);
    setComments(mockComments);
    setLoading(false);
  };

  useEffect(() => {
    if (!postId) return;

    // Snapshot subscribers for Post details
    const postRef = doc(db, 'posts', postId);
    const unsubPost = onSnapshot(postRef, (docSnap) => {
      if (docSnap.exists()) {
        setPost({
          id: docSnap.id,
          ...docSnap.data()
        } as PostType);
      } else {
        // Doc not found or offline fallback
        loadMockFallback();
      }
      setLoading(false);
    }, (error) => {
      console.warn("Details loading error (likely rule block or offline). Loading fallback:", error);
      loadMockFallback();
    });

    // Snapshot subscriber for nested Post comments
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const unsubComments = onSnapshot(commentsRef, (snapshot) => {
      const fetched: CommentType[] = [];
      snapshot.forEach(cSnap => {
        fetched.push({
          id: cSnap.id,
          ...cSnap.data()
        } as CommentType);
      });
      // Sort comments by newest first
      fetched.sort((a, b) => {
        const tA = a.createdAt?.seconds || 0;
        const tB = b.createdAt?.seconds || 0;
        return tB - tA;
      });
      setComments(fetched);
    }, (e) => {
      console.warn("Unable to subscribe comments snap:", e);
    });

    // Check if user has already voted on this post
    if (user) {
      const voteDocRef = doc(db, 'posts', postId, 'votes', user.uid);
      getDoc(voteDocRef).then((voteSnap) => {
        if (voteSnap.exists()) {
          setUserVote(voteSnap.data().voteType);
        }
      }).catch(e => console.warn("Vote checklist skipped (acting guest/offline):", e));
    }

    return () => {
      unsubPost();
      unsubComments();
    };
  }, [postId, user]);

  // Handle local comment image selection
  const handleCommentImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCommentImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCommentImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload image to server proxy endpoint
  const uploadCommentImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/app/api/upload', { method: 'POST', body: formData });
    if (!res.ok) throw new Error("Image compression service offline");
    const json = await res.json();
    return json.url;
  };

  // Submit dynamic user voting
  const castVote = async (voteType: string) => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (votingLoading || !post) return;
    
    // Prevent duplicated identical votes
    if (userVote === voteType) return;

    setVotingLoading(true);
    setActionError(null);

    try {
      const path = `posts/${postId}/votes/${user.uid}`;
      const voteRef = doc(db, 'posts', postId, 'votes', user.uid);
      
      // Update fields based on incremental changes
      const postRef = doc(db, 'posts', postId);
      const incrementUpdates: Record<string, any> = {};

      const mapVoteField = (v: string): string => {
        if (v === 'true') return 'votesTrue';
        if (v === 'false') return 'votesFalse';
        if (v === 'unsure') return 'votesUnsure';
        if (v === 'support') return 'votesSupport';
        if (v === 'not_priority') return 'votesNotPriority';
        return '';
      };

      // If user had a previous vote, decrement that counter
      if (userVote) {
        const oldField = mapVoteField(userVote);
        if (oldField) incrementUpdates[oldField] = increment(-1);
      }

      // Increment new field counter
      const newField = mapVoteField(voteType);
      if (newField) incrementUpdates[newField] = increment(1);

      // Batch transaction update (emulated via promise chain for absolute compatibility)
      await setDoc(voteRef, {
        voteType,
        votedById: user.uid,
        createdAt: new Date()
      });

      await updateDoc(postRef, incrementUpdates);
      setUserVote(voteType);

    } catch (e) {
      console.error(e);
      setActionError("Failed to register your vote. Security limits or offline storage models might be blocking.");
    } finally {
      setVotingLoading(false);
    }
  };

  // Submit Comments
  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login');
      return;
    }

    if (commentText.trim().length === 0 || submittingComment) return;

    setSubmittingComment(true);
    setActionError(null);
    setCommentSuccess(false);

    try {
      let uploadedUrl = '';
      if (commentImage) {
        try {
          uploadedUrl = await uploadCommentImage(commentImage);
        } catch (uplErr) {
          console.warn("Comment image proxy uploaded failed, continuing empty image:", uplErr);
        }
      }

      const commentData = {
        content: commentText.trim(),
        isUpdate: commentUpdateStatus,
        isAnonymous: commentAnonymous,
        authorId: user.uid,
        authorName: commentAnonymous ? 'Anonymous User' : (profile?.name || 'Community Member'),
        createdAt: new Date(),
        reportsCount: 0,
        ...(uploadedUrl && { imageUrl: uploadedUrl })
      };

      const path = `posts/${postId}/comments`;
      await addDoc(collection(db, 'posts', postId, 'comments'), commentData);

      // Clean up inputs
      setCommentText('');
      setCommentImage(null);
      setCommentImagePreview(null);
      setCommentUpdateStatus(false);
      setCommentSuccess(true);
      setTimeout(() => setCommentSuccess(false), 2000);

    } catch (err) {
      console.error(err);
      setActionError("Comment storage service rejected submission. Please try offline drafts.");
    } finally {
      setSubmittingComment(false);
    }
  };

  // Trigger Abuse Report flow
  const fileAbuseReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/login');
      return;
    }
    if (!reportReason.trim() || flaggingLoading) return;

    setFlaggingLoading(true);
    setReportSuccess(false);

    try {
      const reportPayload = {
        targetType: reportType,
        targetId: reportType === 'post' ? postId : (reportedCommentId || ''),
        postId,
        reason: reportReason.trim(),
        reportedBy: user.uid,
        createdAt: new Date()
      };

      const path = 'reports';
      await addDoc(collection(db, 'reports'), reportPayload);

      // Increment reportsCount on document
      if (reportType === 'post') {
        const postRef = doc(db, 'posts', postId);
        await updateDoc(postRef, {
          reportsCount: increment(1)
        });
      } else if (reportType === 'comment' && reportedCommentId) {
        const commRef = doc(db, 'posts', postId, 'comments', reportedCommentId);
        await updateDoc(commRef, {
          reportsCount: increment(1)
        });
      }

      setReportSuccess(true);
      setReportReason('');
      setTimeout(() => {
        setShowReportModal(false);
        setReportSuccess(false);
      }, 1500);

    } catch (err) {
      console.error(err);
      alert("Verification server failed to file moderation ticket.");
    } finally {
      setFlaggingLoading(false);
    }
  };

  // Moderate Delete post (Admins only)
  const handleDeletePost = async () => {
    const verifyDelete = window.confirm("Are you positive you wish to remove this incident from PublicEye maps permanently?");
    if (!verifyDelete || !post) return;

    try {
      await deleteDoc(doc(db, 'posts', postId));
      router.push('/');
    } catch (error) {
      console.error("Admins delete post failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-900 border-t-rose-600 rounded-full animate-spin"></div>
          <p className="text-slate-600 text-sm font-semibold">Retrieving verify ticket details, please hold...</p>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Navbar />
        <div className="max-w-md mx-auto text-center py-20 px-4 space-y-4">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-2xl font-heading font-extrabold text-slate-900">Incident Ticket Not Found</h2>
          <p className="text-slate-500 text-sm leading-relaxed">The post may have been moderated, deleted, or you are experiencing transient offline boundaries.</p>
          <button onClick={() => router.push('/')} className="px-5 py-2 w-full bg-slate-950 hover:bg-slate-900 text-white font-bold text-sm rounded-xl">Back to Feed</button>
        </div>
      </div>
    );
  }

  const isAlert = post.type === 'alert';
  const isHighSev = isAlert && post.severity === 'high';
  const isMedSev = isAlert && post.severity === 'medium';

  // Compute validation score ratio
  const totalVotes = (post.votesTrue || 0) + (post.votesFalse || 0) + (post.votesUnsure || 0);
  const ratioTrue = totalVotes > 0 ? ((post.votesTrue || 0) / totalVotes) * 100 : 0;
  const ratioFalse = totalVotes > 0 ? ((post.votesFalse || 0) / totalVotes) * 100 : 0;

  // Render hidden Admin button if email matches or phone is simulated admin
  const isUserAdmin = profile?.flagged || user?.email === 'publiceye33@gmail.com' || (user && user.phoneNumber === '+8801700000000');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" id="incident-details-layout">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        {/* Back Link */}
        <button
          onClick={() => router.push('/')}
          className="mb-6 flex items-center gap-1.5 text-sm font-bold text-slate-550 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Feed
        </button>

        {/* DETAILS GRID LAYOUT */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden">
          
          {/* Top Banner (Disasters category displays differently) */}
          <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs mb-3 font-semibold">
                <span className="font-bold text-rose-600 uppercase tracking-widest font-mono text-[10px] block py-0.5 px-2 bg-rose-50 rounded-md">
                  {post.category || 'INSPECTION'}
                </span>
                <span className="text-slate-350 font-mono text-[10px] uppercase">
                  {post.type === 'alert' ? 'Active Emergency Log' : 'Public Improvement'}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-black tracking-tight text-slate-950 leading-tight">
                {post.title}
              </h1>
            </div>

            {/* Expire and Status box */}
            <div className="shrink-0 flex md:flex-col items-start gap-2 text-xs font-mono border-l border-slate-100 pl-4 md:text-left self-start">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase uppercase font-bold tracking-wider">Status Index</span>
                <span className="font-extrabold text-blue-600 font-sans mt-0.5 block">Active Map</span>
              </div>
              {isAlert && (
                <div className="md:mt-2">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Alarm Severity</span>
                  <span className={`font-extrabold text-[11px] uppercase ${isHighSev ? 'text-rose-600' : isMedSev ? 'text-amber-500' : 'text-emerald-600'}`}>
                    {post.severity} severity
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Incident Image Body details */}
          {post.imageUrl && (
            <div className="w-full h-[320px] sm:h-[420px] relative bg-slate-100">
              <img
                src={post.imageUrl}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Primary description panel */}
          <div className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Left Column Description */}
              <div className="md:col-span-2 space-y-5">
                <div>
                  <h3 className="font-heading font-bold text-base text-slate-900 mb-2">Description details</h3>
                  <p className="text-slate-650 text-base leading-relaxed whitespace-pre-wrap">
                    {post.description}
                  </p>
                </div>

                {/* OpenStreetMap and location tracker stats */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1 text-slate-600">
                    <p className="font-semibold text-slate-900">{post.locationName}</p>
                    <p className="font-mono text-[10px] text-slate-400">GPS GRID: {post.latitude.toFixed(5)}N, {post.longitude.toFixed(5)}E</p>
                  </div>
                </div>

                {/* Automatic Regulatory Compliance disclaimer */}
                <div className="p-3 bg-amber-50 text-amber-950 border border-amber-200 rounded-xl text-xs flex gap-2.5 leading-relaxed items-start">
                  <AlertTriangle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <span className="font-bold block text-amber-900 mb-0.5">Community Crowdsourced Disclaimer</span>
                    This safety notification is submitted directly by a community watcher on the ground. Values and details could represent live updates, and are not yet officially confirmed by regional administrative departments. Judge carefully.
                  </div>
                </div>

                {/* Admin controls hidden inside details */}
                {isUserAdmin && (
                  <div className="p-4 bg-red-50/50 border border-red-200 rounded-2xl flex items-center justify-between">
                    <span className="text-xs font-bold text-red-900 flex items-center gap-1.5 font-mono">
                      <ShieldAlert className="w-4 h-4 text-red-600" />
                      ADMIN PRIVILEGES ACTIVE
                    </span>
                    <button
                      onClick={handleDeletePost}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-extrabold flex items-center gap-1 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove Report
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column Validation Board */}
              <div className="md:col-span-1 space-y-6">
                
                {/* 1. VOTING CONSOLE MODULE (HIGH VISIBILITY INTERFACE) */}
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-4 shadow-inner" id="details-voting-panel">
                  <div className="text-center pb-2 border-b border-slate-200">
                    <h4 className="font-heading font-extrabold text-slate-950 text-sm">Community Validation Feed</h4>
                    <p className="text-[10px] text-slate-550 leading-tight">Click options below to report fact-checking details</p>
                  </div>

                  {actionError && (
                    <div className="p-2 bg-rose-100 text-rose-950 text-[10px] leading-tight rounded-lg">
                      {actionError}
                    </div>
                  )}

                  {isAlert ? (
                    /* Tab 1: Alert Voting Options (True, False, Unsure) */
                    <div className="space-y-3.5">
                      <div className="grid grid-cols-1 gap-2">
                        
                        <button
                          onClick={() => castVote('true')}
                          disabled={votingLoading}
                          className={`py-3.5 px-4 rounded-xl text-center text-xs font-extrabold flex items-center justify-between transition-all border ${
                            userVote === 'true'
                              ? 'bg-emerald-600 border-emerald-600 text-white ring-2 ring-emerald-300'
                              : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100/50'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <ThumbsUp className={`w-4 h-4 ${userVote === 'true' ? 'text-white' : 'text-emerald-600'}`} />
                            Incident is True
                          </span>
                          <span className="font-mono text-sm leading-none pl-3 font-bold">{post.votesTrue || 0}</span>
                        </button>

                        <button
                          onClick={() => castVote('false')}
                          disabled={votingLoading}
                          className={`py-3.5 px-4 rounded-xl text-center text-xs font-extrabold flex items-center justify-between transition-all border ${
                            userVote === 'false'
                              ? 'bg-rose-600 border-rose-600 text-white ring-2 ring-rose-300'
                              : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100/50'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <ThumbsDown className={`w-4 h-4 ${userVote === 'false' ? 'text-white' : 'text-rose-500'}`} />
                            False News (Spam)
                          </span>
                          <span className="font-mono text-sm leading-none pl-3 font-bold">{post.votesFalse || 0}</span>
                        </button>

                        <button
                          onClick={() => castVote('unsure')}
                          disabled={votingLoading}
                          className={`py-3 px-4 rounded-xl text-center text-xs font-bold flex items-center justify-between transition-all border ${
                            userVote === 'unsure'
                              ? 'bg-slate-600 border-slate-600 text-white ring-2 ring-slate-300'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-105'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <HelpCircle className="w-4 h-4" />
                            Unsure / Detached
                          </span>
                          <span className="font-mono text-sm leading-none pl-3 font-bold">{post.votesUnsure || 0}</span>
                        </button>
                      </div>

                      {/* Bar validation visual metrics */}
                      {totalVotes > 0 && (
                        <div className="space-y-1.5 pt-1 border-t border-slate-200/50">
                          <div className="flex justify-between text-[11px] font-mono text-slate-600">
                            <span>True: {Math.round(ratioTrue)}%</span>
                            <span>False: {Math.round(ratioFalse)}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden flex">
                            <div className="h-full bg-emerald-500" style={{ width: `${ratioTrue}%` }} />
                            <div className="h-full bg-rose-500" style={{ width: `${ratioFalse}%` }} />
                            <div className="h-full bg-slate-400" style={{ width: `${100 - ratioTrue - ratioFalse}%` }} />
                          </div>
                          <p className="text-[9px] text-slate-400 text-center font-mono leading-none pt-0.5">
                            Data is dynamic. Community votes once per post.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Tab 2: Civic Voting Options (Support, Not Priority) */
                    <div className="space-y-2.5">
                      <button
                        onClick={() => castVote('support')}
                        disabled={votingLoading}
                        className={`w-full py-4 px-4 rounded-2xl text-center text-xs font-bold flex items-center justify-between transition-all border ${
                          userVote === 'support'
                            ? 'bg-slate-900 border-slate-900 text-white ring-2 ring-slate-300'
                            : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-105'
                        }`}
                      >
                        <span className="flex items-center gap-2 font-extrabold">
                          <ThumbsUp className="w-4.5 h-4.5 text-blue-500" />
                          Support Demand
                        </span>
                        <span className="font-mono text-base font-extrabold leading-none pl-3">{post.votesSupport || 0}</span>
                      </button>

                      <button
                        onClick={() => castVote('not_priority')}
                        disabled={votingLoading}
                        className={`w-full py-3 px-4 rounded-2xl text-center text-xs font-semibold flex items-center justify-between transition-all border ${
                          userVote === 'not_priority'
                            ? 'bg-slate-500 border-slate-500 text-white ring-1 ring-slate-300'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <ThumbsDown className="w-3.5 h-3.5 text-slate-400" />
                          Not Priority
                        </span>
                        <span className="font-mono text-sm leading-none pl-3">{post.votesNotPriority || 0}</span>
                      </button>
                    </div>
                  )}
                  
                  {/* Global Report post button */}
                  <button
                    onClick={() => {
                      setReportType('post');
                      setShowReportModal(true);
                    }}
                    className="w-full mt-2 text-slate-450 hover:text-rose-600 text-xs font-semibold py-1.5 border border-dashed border-slate-200 rounded-xl transition-colors inline-flex items-center justify-center gap-1 hover:bg-rose-50"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    Report Abusive Incident
                  </button>

                </div>

                {/* Poster meta detail card */}
                <div className="p-4 rounded-2xl border border-slate-200/80 text-xs text-slate-500 space-y-3">
                  <div className="flex justify-between">
                    <span>Reported By</span>
                    <span className="font-bold text-slate-850">
                      {post.isAnonymous ? 'Anonymous' : (
                        <Link href={`/profile/${post.authorId}`} className="text-blue-600 hover:underline">
                          {post.authorName}
                        </Link>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date Filed</span>
                    <span className="font-mono">
                      {post.createdAt?.seconds 
                        ? new Date(post.createdAt.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'Local Sync'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Target Expiry</span>
                    <span className="font-mono font-semibold text-slate-700">
                      {post.expiresAt?.seconds 
                        ? new Date(post.expiresAt.seconds * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
                        : 'Unknown'
                      }
                    </span>
                  </div>
                </div>

              </div>

            </div>
          </div>

        </div>

        {/* COMMENTS AND COMMUNITY FEEDBACK ENGINE */}
        <section className="mt-12 space-y-6" id="post-comments-engine">
          <div className="pb-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-heading font-extrabold text-xl text-slate-950 tracking-tight flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-slate-600" />
              Progress Updates ({comments.length})
            </h2>
            <span className="text-xs font-mono text-slate-500">Newest timelines first</span>
          </div>

          {/* Comment submission form */}
          {user ? (
            <form onSubmit={submitComment} className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4" id="comment-form">
              {commentSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs font-bold rounded-xl flex items-center gap-1.5 animate-bounce">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  Update published successfully!
                </div>
              )}

              <div>
                <label htmlFor="commentText" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Write Progress Comment
                </label>
                <textarea
                  id="commentText"
                  required
                  rows={3}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="e.g. Hasan Mahmud reported fire has ceased. Local team arrived or need ambulance support..."
                  disabled={submittingComment}
                  className="block w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-slate-950 focus:border-slate-950 text-slate-900 text-sm placeholder-slate-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Visual attachments selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">Attach evidence path (optional)</label>
                  <div className="flex items-center gap-2">
                    <div className="relative border border-slate-200 rounded-xl px-3 py-2 text-xs flex items-center gap-1.5 text-slate-650 hover:bg-slate-50 pointer group max-w-[170px]">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCommentImageChange}
                        disabled={submittingComment}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <Camera className="w-4 h-4 text-slate-500 group-hover:text-slate-700" />
                      Add photo
                    </div>
                    {commentImagePreview && (
                      <span className="text-[10px] text-slate-500 max-w-[120px] truncate leading-none">Photo attached!</span>
                    )}
                  </div>
                </div>

                {/* Submitting switches: Anonymous commenting and update status */}
                <div className="flex flex-col sm:items-end justify-center gap-2">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 text-xs text-slate-705 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={commentAnonymous}
                        onChange={(e) => setCommentAnonymous(e.target.checked)}
                        disabled={submittingComment}
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-950"
                      />
                      Comment Anonymously
                    </label>

                    <label className="flex items-center gap-1.5 text-xs text-rose-705 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={commentUpdateStatus}
                        onChange={(e) => setCommentUpdateStatus(e.target.checked)}
                        disabled={submittingComment}
                        className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                      />
                      Official Progress Update?
                    </label>
                  </div>
                </div>
              </div>

              {commentImagePreview && (
                <div className="pt-2">
                  <div className="max-w-[140px] h-[90px] rounded-lg overflow-hidden border border-slate-200 relative">
                    <img src={commentImagePreview} alt="Comment Attachment Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setCommentImage(null);
                        setCommentImagePreview(null);
                      }}
                      className="absolute top-1 right-1 bg-slate-950/80 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              {/* Action trigger button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submittingComment || commentText.trim().length === 0}
                  className="px-6 py-2.5 bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm transition-transform active:scale-95 disabled:bg-slate-350"
                >
                  {submittingComment ? 'Sending update...' : 'Publish Update'}
                </button>
              </div>

            </form>
          ) : (
            <div className="p-5 text-center bg-slate-100 rounded-3xl border border-dashed border-slate-200">
              <p className="text-slate-600 text-xs mb-3 font-medium">You must be authenticated with mobile phone to post comment updates.</p>
              <Link href="/login" className="px-5 py-2.5 bg-slate-950 text-white hover:bg-slate-900 rounded-xl text-xs font-bold shadow-sm inline-block">Sign In with Phone</Link>
            </div>
          )}

          {/* LIST COMMENTS IN CHRONOLOGICAL ORDER */}
          <div className="space-y-4" id="post-comments-thread-list">
            {comments.length === 0 ? (
              <div className="py-12 bg-white text-center rounded-3xl border border-slate-200 text-slate-400 text-sm">
                No local updates reported yet. Be the first to comment!
              </div>
            ) : (
              comments.map((comm) => (
                <article 
                  key={comm.id} 
                  className={`p-5 rounded-2xl border ${
                    comm.isUpdate 
                      ? 'bg-rose-50/50 border-rose-200 ring-1 ring-rose-200' 
                      : 'bg-white border-slate-200/80'
                  }`}
                  id={`comment-card-${comm.id}`}
                >
                  {/* Meta user updates details */}
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={`text-[10px] uppercase font-bold tracking-wider font-mono mr-1 px-2 py-0.5 rounded ${
                        comm.isUpdate ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {comm.isUpdate ? 'Progress Status Alert' : 'Discussion'}
                      </span>
                      <span className="font-bold text-xs text-slate-800">
                        {comm.isAnonymous ? 'Anonymous User' : comm.authorName}
                      </span>
                      <span className="text-slate-300 scale-75">•</span>
                      <span className="text-slate-400 text-[10px] font-mono">
                        {comm.createdAt?.seconds 
                          ? new Date(comm.createdAt.seconds * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
                          : 'Linked'
                        }
                      </span>
                    </div>

                    {/* Report button */}
                    <button
                      onClick={() => {
                        setReportType('comment');
                        setReportedCommentId(comm.id);
                        setShowReportModal(true);
                      }}
                      className="text-slate-400 hover:text-rose-600 text-[10px] font-bold flex items-center gap-0.5"
                      title="Report Abuse"
                    >
                      <Flag className="w-3 h-3" />
                      Report
                    </button>
                  </div>

                  <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap pl-1.5">
                    {comm.content}
                  </p>

                  {comm.imageUrl && (
                    <div className="mt-3.2 pl-1.5 max-w-[280px] h-[180px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      <img src={comm.imageUrl} alt="User attachment evidence" className="w-full h-full object-cover" />
                    </div>
                  )}

                </article>
              ))
            )}
          </div>

        </section>
      </main>

      {/* ABUSE REPORTING DIALOG BOX (MODAL) */}
      {showReportModal && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 max-w-sm w-full animate-in fade-in zoom-in duration-150">
            
            <div className="flex items-center gap-2 text-rose-600 mb-3 pb-2 border-b border-slate-105">
              <ShieldAlert className="w-6 h-6 shrink-0 animate-bounce" />
              <h3 className="font-heading font-extrabold text-slate-950 text-base leading-none">Register Abuse Moderation</h3>
            </div>

            {reportSuccess ? (
              <div className="p-4 text-center space-y-2 py-8">
                <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="font-semibold text-slate-800 text-sm">Report Saved! Admin team has been notified.</p>
              </div>
            ) : (
              <form onSubmit={fileAbuseReport} className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  You are reporting a {reportType}. We take fake alerts, misinformation, and duplicate spam in Bangladesh incredibly seriously. Provide a justification.
                </p>

                <div>
                  <label htmlFor="reportReason" className="block text-xs font-bold text-slate-700 mb-1">Reason for Report</label>
                  <select
                    id="reportReason"
                    required
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="block w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:ring-slate-950"
                  >
                    <option value="">Select a reason...</option>
                    <option value="Fake / Rumor News: This incident never occurred">Fake news / Rumor</option>
                    <option value="Duplicate News: Another post has already registered this topic">Duplicate spam</option>
                    <option value="Spam / Advertisements: Trying to promote items or files">Commercial spam / Ad</option>
                    <option value="Abusive Language: Content holds offensive tags or text">Offensive/Abusive language</option>
                    <option value="Wrong Location: Geo markers are detached from actual spot">Inaccurate location coordinates</option>
                    <option value="Other">Other context issues</option>
                  </select>
                </div>

                <div className="flex gap-2 justify-end pt-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="px-3.5 py-2 hover:bg-slate-150 text-slate-600 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={flaggingLoading || !reportReason}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm"
                  >
                    {flaggingLoading ? 'Sending...' : 'File Moderation Claim'}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
