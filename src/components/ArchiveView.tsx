import React, { useState } from 'react';
import { IncidentPost, AlertCategory } from '../types';
import { 
  Archive, Clock, MapPin, CheckCircle2, XCircle, RefreshCcw, 
  Search, ArrowRight, HelpCircle, CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ArchiveViewProps {
  posts: IncidentPost[];
  onNavigate: (view: 'home' | 'login' | 'create' | 'post-detail' | 'profile' | 'archive' | 'admin', targetId?: string) => void;
  onExtendExpiry: (postId: string) => void;
}

export default function ArchiveView({
  posts,
  onNavigate,
  onExtendExpiry,
}: ArchiveViewProps) {
  const [search, setSearch] = useState('');
  const [successPostId, setSuccessPostId] = useState<string | null>(null);

  // Filter archived posts
  const archivedPosts = posts.filter(
    post => post.isArchived && 
    (post.title.toLowerCase().includes(search.toLowerCase()) || 
     post.locationName.toLowerCase().includes(search.toLowerCase()))
  );

  const handleTriggerExtend = (postId: string) => {
    onExtendExpiry(postId);
    setSuccessPostId(postId);
    setTimeout(() => {
      setSuccessPostId(null);
    }, 2500);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6" id="archive-pane">
      
      {/* Intro info box */}
      <div className="mb-8 rounded-2xl border border-gray-150 bg-white p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="font-sans font-extrabold text-2xl text-gray-950 flex items-center">
              <Archive className="h-6 w-6 text-gray-600 mr-2 shrink-0" />
              <span>Historical Archive</span>
            </h2>
            <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">
              {archivedPosts.length} post(s)
            </span>
          </div>
          <p className="font-sans text-sm text-gray-400 mt-2 max-w-xl">
            Incidents expire automatically past their emergency response timelines (e.g., 24 hours for fires/accidents, 3 days for storms). Archived statuses remain saved for auditing and verification analysis.
          </p>
        </div>

        {/* Quick Search */}
        <div className="relative w-full md:w-80 shrink-0">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search archived files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 pl-10 pr-4 text-xs font-sans focus:border-red-500 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {archivedPosts.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
              <HelpCircle className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="font-sans font-bold text-gray-900 mt-2">No Archived Entries</h3>
              <p className="font-sans text-xs text-gray-400 mt-1">
                Active incidents are still displaying live inside the primary community dashboard feed. Look back when timelines lapse!
              </p>
            </div>
          ) : (
            archivedPosts.map((post) => {
              
              // Count status
              const trueVotes = post.votes.filter(v => v.type === 'True').length;
              const falseVotes = post.votes.filter(v => v.type === 'False News').length;

              return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="rounded-xl border border-gray-150 bg-gray-50/50 p-5 flex flex-col justify-between shadow-xs hover:shadow-sm hover:bg-white transition duration-200"
                  id={`archived-post-${post.id}`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-block rounded bg-gray-150 px-2 py-0.5 font-mono text-[9px] font-bold text-gray-600 uppercase">
                        {post.category || 'Civic'}
                      </span>
                      <span className="font-mono text-[10px] text-gray-400 flex items-center">
                        <Clock className="h-3 w-3 mr-0.5" />
                        Expired
                      </span>
                    </div>

                    <h3 className="font-sans font-bold text-sm text-gray-900 line-clamp-2">
                      {post.title}
                    </h3>

                    <p className="font-sans text-xs text-gray-500 line-clamp-3 leading-relaxed">
                      {post.description}
                    </p>

                    {/* Geolocation Tag */}
                    <div className="flex items-center space-x-1 font-sans text-[11px] text-gray-500">
                      <MapPin className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      <span>{post.locationName}</span>
                    </div>

                    {/* Vote Summary badges */}
                    <div className="flex items-center space-x-3 text-[11px] font-semibold border-t border-gray-100 pt-3">
                      <span className="text-emerald-700 flex items-center">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        True: {trueVotes}
                      </span>
                      <span className="text-red-750 flex items-center">
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Fake: {falseVotes}
                      </span>
                      <span className="text-gray-450">
                        Comments: {post.comments.length}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar: View and Extend Expiry */}
                  <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => onNavigate('post-detail', post.id)}
                      className="inline-flex items-center text-xs font-bold text-gray-900 hover:text-red-600 transition"
                    >
                      <span>Audit Logs</span>
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </button>

                    {successPostId === post.id ? (
                      <span className="rounded bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[10px] font-bold text-emerald-700 flex items-center animate-pulse">
                        <CheckCircle className="h-3.5 w-3.5 mr-1" />
                        Shifted to Feed!
                      </span>
                    ) : (
                      <button
                        onClick={() => handleTriggerExtend(post.id)}
                        className="inline-flex items-center space-x-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 py-1 px-2.5 font-sans text-[11px] font-bold text-gray-700 transition"
                        title="Add 24 hours and restore to active main feed"
                        id={`extend-btn-${post.id}`}
                      >
                        <RefreshCcw className="h-3 w-3 mr-1 text-gray-500" />
                        <span>Extend Expiry</span>
                      </button>
                    )}
                  </div>

                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
