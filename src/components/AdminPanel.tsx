import React from 'react';
import { IncidentPost, UserProfile } from '../types';
import { 
  ShieldAlert, AlertTriangle, Users, Trash2, CheckCircle, 
  EyeOff, MapPin, Bone, Info, Check, CornerDownRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdminPanelProps {
  posts: IncidentPost[];
  profiles: UserProfile[];
  onDismissPostReports: (postId: string) => void;
  onDeletePost: (postId: string) => void;
  onDismissCommentReports: (postId: string, commentId: string) => void;
  onDeleteComment: (postId: string, commentId: string) => void;
  onToggleFlagProfile: (profileId: string) => void;
}

export default function AdminPanel({
  posts,
  profiles,
  onDismissPostReports,
  onDeletePost,
  onDismissCommentReports,
  onDeleteComment,
  onToggleFlagProfile,
}: AdminPanelProps) {
  // Extract reported posts
  const reportedPosts = posts.filter(post => post.reportedCount > 0);

  // Extract reported comments
  const reportedComments: { post: IncidentPost; comment: any }[] = [];
  posts.forEach(post => {
    post.comments.forEach(comment => {
      if (comment.reportedCount > 0) {
        reportedComments.push({ post, comment });
      }
    });
  });

  // Extract profiles of interest
  const questionableProfiles = profiles.filter(p => p.falsePostCount > 0 || p.isFlagged);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6" id="admin-panel-control">
      
      {/* Admin header banner */}
      <div className="mb-8 rounded-2xl bg-gray-950 p-6 sm:p-8 text-white shadow-md">
        <div className="flex items-center space-x-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-600">
            <ShieldAlert className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-sans font-extrabold text-xl tracking-tight text-white">
                Admin Security Desk
              </span>
              <span className="rounded bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-red-400 uppercase tracking-widest">
                Internal Mode
              </span>
            </div>
            <p className="font-sans text-xs text-gray-400 mt-1">
              Official DSA and privacy regulatory moderation board. Review reported community content, remove spam, and enforce security policies.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Reported Posts list Column */}
        <div className="lg:col-span-1 space-y-5">
          <div className="rounded-2xl border border-gray-150 bg-white p-5 space-y-4 shadow-xs">
            
            <h3 className="font-sans font-extrabold text-sm text-gray-950 pb-3 border-b border-gray-150 flex items-center justify-between">
              <span>Reported Incidents ({reportedPosts.length})</span>
              <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0" />
            </h3>

            {reportedPosts.length === 0 ? (
              <p className="text-center font-sans text-xs text-gray-400 py-6 italic">
                Clean audit! Zero active incident reports pending administrative review.
              </p>
            ) : (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {reportedPosts.map(post => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="rounded-xl border border-red-100 bg-red-50/20 p-4 space-y-3 relative"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-mono text-[9px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                          FLAGGED x{post.reportedCount}
                        </span>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => onDismissPostReports(post.id)}
                            className="bg-white hover:bg-emerald-50 text-emerald-700 p-1 border border-emerald-250 rounded transition"
                            title="Dismiss complaints"
                            id={`dismiss-post-${post.id}`}
                          >
                            <Check className="h-4.5 w-4.5 text-emerald-600" />
                          </button>
                          <button
                            onClick={() => onDeletePost(post.id)}
                            className="bg-white hover:bg-red-50 text-red-700 p-1 border border-red-250 rounded transition"
                            title="Delete Post permanently"
                            id={`delete-post-${post.id}`}
                          >
                            <Trash2 className="h-4.5 w-4.5 text-red-600" />
                          </button>
                        </div>
                      </div>

                      <h4 className="font-sans font-bold text-xs text-gray-950 pr-4">
                        {post.title}
                      </h4>
                      
                      <p className="font-sans text-[11px] text-gray-500 line-clamp-2">
                        {post.description}
                      </p>

                      <div className="font-mono text-[9px] text-gray-400 border-t border-gray-100 pt-2 flex justify-between">
                        <span>By: {post.userName}</span>
                        <span>{post.locationName}</span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

          </div>
        </div>

        {/* Reported Comments list Column */}
        <div className="lg:col-span-1 space-y-5">
          <div className="rounded-2xl border border-gray-150 bg-white p-5 space-y-4 shadow-xs">
            
            <h3 className="font-sans font-extrabold text-sm text-gray-950 pb-3 border-b border-gray-150 flex items-center justify-between">
              <span>Reported Comments ({reportedComments.length})</span>
              <AlertTriangle className="h-4.5 w-4.5 text-amber-500 shrink-0" />
            </h3>

            {reportedComments.length === 0 ? (
              <p className="text-center font-sans text-xs text-gray-400 py-6 italic">
                All citizen replies comply with standards. No active moderation flagged.
              </p>
            ) : (
              <div className="space-y-4">
                {reportedComments.map(({ post, comment }) => (
                  <div 
                    key={comment.id}
                    className="rounded-xl border border-red-100 bg-red-50/20 p-4 space-y-3 relative"
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-mono text-[9px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                        FLAGGED COMMENT x{comment.reportedCount}
                      </span>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => onDismissCommentReports(post.id, comment.id)}
                          className="bg-white hover:bg-emerald-50 text-emerald-700 p-1 index border border-emerald-250 rounded transition"
                          title="Authorize / Dismiss comment"
                        >
                          <Check className="h-4.5 w-4.5 text-emerald-600" />
                        </button>
                        <button
                          onClick={() => onDeleteComment(post.id, comment.id)}
                          className="bg-white hover:bg-red-50 text-red-700 p-1 index border border-red-250 rounded transition"
                          title="Delete comment permanently"
                        >
                          <Trash2 className="h-4.5 w-4.5 text-red-650" />
                        </button>
                      </div>
                    </div>

                    <p className="font-sans text-xs text-gray-800 italic leading-snug">
                      "{comment.content}"
                    </p>

                    <div className="font-sans text-[10px] text-gray-400 flex items-center">
                      <CornerDownRight className="h-3.5 w-3.5 mr-0.5 shrink-0" />
                      <span>On Post: <u>{post.title}</u></span>
                    </div>

                    <div className="font-mono text-[9px] text-gray-400 border-t border-gray-100 pt-2 flex justify-between">
                      <span>By: {comment.isAnonymous ? 'Anonymous' : comment.userName}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>

        {/* Questionable user profiles & Device Fingerprints x Spam profiles column */}
        <div className="lg:col-span-1 space-y-5">
          <div className="rounded-2xl border border-gray-150 bg-white p-5 space-y-4 shadow-xs">
            
            <h3 className="font-sans font-extrabold text-sm text-gray-950 pb-3 border-b border-gray-150 flex items-center justify-between">
              <span>Suspicious Accounts Matrix</span>
              <Users className="h-4.5 w-4.5 text-gray-500 shrink-0" />
            </h3>

            <p className="font-sans text-[11px] leading-relaxed text-gray-400">
              Citizens with false flags or reporting complaints undergo automatic silent reviews. Flagged profiles are **deprioritized**, sending their future alerts to the bottom of sorting matrices.
            </p>

            <div className="space-y-3.5">
              {profiles.map(profile => (
                <div 
                  key={profile.id}
                  className={`rounded-xl border p-4.5 space-y-3 relative transition ${
                    profile.isFlagged 
                      ? 'border-red-300 bg-red-50/10' 
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-sans font-bold text-xs text-gray-950">
                        {profile.name}
                      </h4>
                      <span className="font-mono text-[9px] text-gray-400">
                        {profile.phoneNumber}
                      </span>
                    </div>

                    <button
                      onClick={() => onToggleFlagProfile(profile.id)}
                      className={`rounded-lg px-2.5 py-1.5 font-sans text-[10px] font-bold transition border ${
                        profile.isFlagged
                          ? 'bg-red-600 text-white border-red-700 hover:bg-red-500'
                          : 'bg-white border-gray-250 text-gray-700 hover:bg-gray-50'
                      }`}
                      id={`flag-profile-${profile.id}`}
                    >
                      {profile.isFlagged ? 'Account Flagged (Lower Feed)' : 'Flag / Deprioritize'}
                    </button>
                  </div>

                  <div className="font-mono text-[10px] border-t border-gray-100 pt-2.5 space-y-1 text-gray-500">
                    <div className="flex justify-between">
                      <span>Device Fingerprint:</span>
                      <span className="text-gray-400 truncate max-w-[120px]">{profile.deviceFingerprint}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>False post flags:</span>
                      <span className={profile.falsePostCount > 0 ? 'text-red-600 font-bold' : ''}>
                        {profile.falsePostCount}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
