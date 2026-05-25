import React, { useState } from 'react';
import { IncidentPost, AlertCategory, Severity, LocationCoordinates } from '../types';
import { 
  AlertTriangle, Flame, Car, Droplets, CloudLightning, ShieldOff, 
  MapPin, Clock, ThumbsUp, MessageSquare, ShieldCheck, Share2, 
  Filter, Search, PlusCircle, Megaphone, CheckCircle2, XCircle, Info, Archive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getDistanceMeters } from '../utils';

interface FeedProps {
  posts: IncidentPost[];
  currentType: 'Alert' | 'Civic';
  onChangeType: (type: 'Alert' | 'Civic') => void;
  userLocation: LocationCoordinates | null;
  onNavigate: (view: 'home' | 'login' | 'create' | 'post-detail' | 'profile' | 'archive' | 'admin', targetId?: string) => void;
  onVote: (postId: string, type: 'True' | 'False News' | 'Unsure' | 'Support' | 'Not Priority') => void;
  onReport: (postId: string) => void;
}

const CATEGORY_ICONS: Record<AlertCategory, React.ReactNode> = {
  'Fire': <Flame className="h-4 w-4 text-orange-600" />,
  'Accident': <Car className="h-4 w-4 text-purple-600" />,
  'Flood': <Droplets className="h-4 w-4 text-blue-600" />,
  'Storm': <CloudLightning className="h-4 w-4 text-cyan-600" />,
  'Robbery/Crime': <ShieldOff className="h-4 w-4 text-slate-800" />,
  'Road damage': <AlertTriangle className="h-4 w-4 text-amber-700" />,
  'Water problem': <Droplets className="h-4 w-4 text-teal-600" />,
  'Electricity problem': <Flame className="h-4 w-4 text-yellow-600" />,
  'Gas leak': <AlertTriangle className="h-4 w-4 text-rose-600" />,
  'Other': <Info className="h-4 w-4 text-gray-600" />,
};

export default function Feed({
  posts,
  currentType,
  onChangeType,
  userLocation,
  onNavigate,
  onVote,
  onReport,
}: FeedProps) {
  const [search, setSearch] = useState('');
  const [selectedArea, setSelectedArea] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState<AlertCategory | 'All'>('All');
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | 'All'>('All');
  const [sortBy, setSortBy] = useState<'severity-distance' | 'recent'>('severity-distance');
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);

  // Active (non-archived) posts filter
  const activePosts = posts.filter(post => post.type === currentType && !post.isArchived);

  // Sorting and filtering algorithm
  const processedPosts = activePosts
    .filter(post => {
      const matchSearch = 
        post.title.toLowerCase().includes(search.toLowerCase()) ||
        post.description.toLowerCase().includes(search.toLowerCase()) ||
        post.locationName.toLowerCase().includes(search.toLowerCase());
      
      const matchArea = selectedArea === 'All' || post.locationName.toLowerCase().includes(selectedArea.toLowerCase());
      
      const matchCategory = 
        currentType === 'Civic' || 
        selectedCategory === 'All' || 
        post.category === selectedCategory;

      const matchSeverity = 
        currentType === 'Civic' || 
        selectedSeverity === 'All' || 
        post.severity === selectedSeverity;

      return matchSearch && matchArea && matchCategory && matchSeverity;
    })
    .sort((a, b) => {
      // Sort priority rule: Nearby + High Severity first, then Medium, then rest
      if (sortBy === 'severity-distance') {
        let distA = Infinity;
        let distB = Infinity;
        
        if (userLocation && a.coordinates && b.coordinates) {
          distA = getDistanceMeters(userLocation, a.coordinates);
          distB = getDistanceMeters(userLocation, b.coordinates);
        } else {
          // If no user location, pretend posts inside primary search areas are "nearby"
          if (selectedArea !== 'All') {
            distA = a.locationName.includes(selectedArea) ? 100 : 5000;
            distB = b.locationName.includes(selectedArea) ? 100 : 5000;
          }
        }

        // Emergency alerts weight
        const getAlertWeight = (post: IncidentPost) => {
          let score = 0;
          if (post.type === 'Alert') {
            if (post.severity === 'High') score += 10000;
            else if (post.severity === 'Medium') score += 5000;
            else score += 1000;
          }
          // Distance boost if nearby (within 5km)
          const dist = userLocation && post.coordinates ? getDistanceMeters(userLocation, post.coordinates) : 99999;
          if (dist < 3000) {
            score += 20000; // Large nearby multiplier
          }
          return score;
        };

        const weightA = getAlertWeight(a);
        const weightB = getAlertWeight(b);

        if (weightA !== weightB) {
          return weightB - weightA; // Higher weight first
        }
        
        // If weights equal, sort by distance
        if (distA !== distB && distA !== Infinity && distB !== Infinity) {
          return distA - distB;
        }
      }

      // Default fallback or 'recent' sort: newest post first
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

  const handleShare = (postId: string) => {
    const shareUrl = `${window.location.origin}/#/post/${postId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedPostId(postId);
    setTimeout(() => {
      setCopiedPostId(null);
    }, 2000);
  };

  const getSeverityBadgeClass = (severity: Severity) => {
    switch (severity) {
      case 'High':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Low':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      
      {/* Upper Navigation Tabs & Create Button Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-150 pb-5 mb-8 gap-4">
        <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => onChangeType('Alert')}
            className={`flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
              currentType === 'Alert'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            <span>Emergency Alerts</span>
          </button>
          <button
            onClick={() => onChangeType('Civic')}
            className={`flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-bold transition ${
              currentType === 'Civic'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Megaphone className="h-4 w-4" />
            <span>Civic Demands</span>
          </button>
        </div>

        <button
          onClick={() => onNavigate('create')}
          className="flex w-full sm:w-auto items-center justify-center space-x-2 rounded-xl bg-red-600 px-5 py-2.5 font-sans text-sm font-bold text-white shadow-md shadow-red-200 hover:bg-red-500 transition-all active:scale-95"
          id="report-incident-button"
        >
          <PlusCircle className="h-4.5 w-4.5" />
          <span>Report New Incident</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Filters Panel Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl border border-gray-150 bg-white p-5 space-y-5 shadow-xs">
            <h3 className="font-sans font-bold text-gray-950 flex items-center space-x-2 pb-3 border-b border-gray-150 text-sm tracking-wide uppercase font-mono">
              <Filter className="h-4 w-4 text-gray-500" />
              <span>Search & Filters</span>
            </h3>

            {/* Keyword Search */}
            <div className="space-y-1.5">
              <label className="block font-mono text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                Keyword Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="e.g. fire, road, Mirpur"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2 pl-9 pr-3 text-xs font-sans focus:border-red-500 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {/* Area Filter */}
            <div className="space-y-1.5 border-t border-gray-100 pt-3">
              <label className="block font-mono text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                Locality Area
              </label>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2 px-3 text-xs font-sans focus:border-red-500 focus:bg-white focus:outline-none"
              >
                <option value="All">All Bangladesh</option>
                <option value="Mirpur">Mirpur</option>
                <option value="Dhanmondi">Dhanmondi</option>
                <option value="Gulshan">Gulshan</option>
                <option value="Uttara">Uttara</option>
                <option value="Banani">Banani</option>
                <option value="Farmgate">Farmgate</option>
                <option value="Chittagong">Chittagong</option>
                <option value="Sylhet">Sylhet</option>
              </select>
            </div>

            {/* Alerts specific filters */}
            {currentType === 'Alert' && (
              <>
                {/* Category Filter */}
                <div className="space-y-1.5 border-t border-gray-100 pt-3">
                  <label className="block font-mono text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                    Alert Category
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as AlertCategory | 'All')}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2 px-3 text-xs font-sans focus:border-red-500 focus:bg-white focus:outline-none"
                  >
                    <option value="All">All Categories</option>
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

                {/* Severity Filter */}
                <div className="space-y-1.5 border-t border-gray-100 pt-3">
                  <label className="block font-mono text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                    Severity Level
                  </label>
                  <select
                    value={selectedSeverity}
                    onChange={(e) => setSelectedSeverity(e.target.value as Severity | 'All')}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2 px-3 text-xs font-sans focus:border-red-500 focus:bg-white focus:outline-none"
                  >
                    <option value="All">All Severities</option>
                    <option value="High">High Urgency (Red)</option>
                    <option value="Medium">Medium Status (Yellow)</option>
                    <option value="Low">Low Scale (Green)</option>
                  </select>
                </div>
              </>
            )}

            {/* Sorting Method */}
            <div className="space-y-1.5 border-t border-gray-100 pt-3">
              <label className="block font-mono text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                Ordering Rule
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSortBy('severity-distance')}
                  className={`rounded-lg py-1.5 text-center font-sans text-xs font-semibold border transition ${
                    sortBy === 'severity-distance'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-white border-gray-150 text-gray-500 hover:text-gray-900'
                  }`}
                  title="Rank nearby and high severity alert items first"
                >
                  Nearby Smart
                </button>
                <button
                  type="button"
                  onClick={() => setSortBy('recent')}
                  className={`rounded-lg py-1.5 text-center font-sans text-xs font-semibold border transition ${
                    sortBy === 'recent'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-white border-gray-150 text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Newest Feed
                </button>
              </div>
            </div>

            {/* GPS authorization status indicator */}
            <div className="border-t border-gray-100 pt-3 flex items-start space-x-2">
              <div className={`mt-0.5 h-2 w-2 rounded-full ${userLocation ? 'bg-emerald-500 animate-ping' : 'bg-gray-300'}`} />
              <div>
                <span className="font-sans text-[11px] font-semibold text-gray-600">
                  {userLocation ? 'GPS Tracking Active' : 'Relying on search filters'}
                </span>
                <p className="font-sans text-[9px] text-gray-400 leading-none mt-0.5">
                  Used for smart distance prioritization.
                </p>
              </div>
            </div>
            
          </div>

          {/* Legal Compliance Banner */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 space-y-2">
            <span className="font-mono text-[9px] uppercase font-bold text-blue-800 tracking-wider flex items-center space-x-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>DSA Legal Shield</span>
            </span>
            <p className="font-sans text-[11px] text-blue-900 leading-relaxed">
              Every reporting contains simulated device encryption. Spam behavior is silently flagged by authorities. Report fake content instantly.
            </p>
          </div>
        </div>

        {/* Home Feed List Area */}
        <div className="lg:col-span-3 space-y-6">
          
          <div className="flex items-center justify-between">
            <h2 className="font-sans font-extrabold text-lg text-gray-900">
              {currentType === 'Alert' ? 'Emergency Incident Feed' : 'Civic and Community Demands'}
              <span className="ml-2 font-mono text-xs font-semibold text-gray-400">
                ({processedPosts.length})
              </span>
            </h2>
          </div>

          {processedPosts.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-dashed border-gray-200 bg-white p-16 text-center"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50 text-gray-400">
                <Search className="h-8 w-8" />
              </div>
              <h3 className="font-sans font-bold text-gray-900 text-base">No Incidents Found</h3>
              <p className="mx-auto mt-2 max-w-sm font-sans text-sm text-gray-400">
                Adjust criteria, change your current location division, or create a brand new community notification profile coordinates!
              </p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {processedPosts.map((post) => {
                  
                  // Compute distance if location exists
                  let distanceStr = '';
                  if (userLocation && post.coordinates) {
                    const meters = getDistanceMeters(userLocation, post.coordinates);
                    distanceStr = meters < 1000 
                      ? `${Math.round(meters)}m away` 
                      : `${(meters / 1000).toFixed(1)}km away`;
                  }

                  // Count votes
                  const trueVotes = post.votes.filter(v => v.type === 'True').length;
                  const falseVotes = post.votes.filter(v => v.type === 'False News').length;
                  const unsureVotes = post.votes.filter(v => v.type === 'Unsure').length;
                  const supportVotes = post.votes.filter(v => v.type === 'Support').length;
                  const notPriorityVotes = post.votes.filter(v => v.type === 'Not Priority').length;
                  const totalVotes = post.votes.length;

                  return (
                    <motion.article
                      key={post.id}
                      layoutId={`post-layout-${post.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.25 }}
                      className="group relative rounded-2xl border border-gray-150 bg-white p-6 shadow-xs hover:shadow-md transition-all duration-300"
                      id={`post-card-${post.id}`}
                    >
                      
                      {/* Badge and severity indicators */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                        <div className="flex items-center space-x-2">
                          {post.type === 'Alert' && post.category ? (
                            <span className="inline-flex items-center space-x-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-bold text-gray-800">
                              {CATEGORY_ICONS[post.category]}
                              <span>{post.category}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1.5 rounded-lg border border-purple-100 bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-800">
                              <Megaphone className="h-3.5 w-3.5 text-purple-700" />
                              <span>Civic Demand</span>
                            </span>
                          )}

                          {post.type === 'Alert' && post.severity && (
                            <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-bold ${getSeverityBadgeClass(post.severity)}`}>
                              {post.severity} Urgency
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1.5 text-gray-400 font-mono text-[11px]">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{new Date(post.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>•</span>
                          <span>{new Date(post.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Title & Desc */}
                      <div className="cursor-pointer" onClick={() => onNavigate('post-detail', post.id)}>
                        <h3 className="font-sans font-bold text-lg text-gray-950 group-hover:text-red-600 transition tracking-tight">
                          {post.title}
                        </h3>
                        <p className="font-sans text-sm text-gray-600 leading-relaxed mt-2 line-clamp-2">
                          {post.description}
                        </p>
                      </div>

                      {/* Optional compressed photo view */}
                      {post.photoUrl && (
                        <div 
                          className="mt-4 overflow-hidden rounded-xl border border-gray-100 cursor-pointer"
                          onClick={() => onNavigate('post-detail', post.id)}
                        >
                          <img
                            src={post.photoUrl}
                            alt={post.title}
                            referrerPolicy="no-referrer"
                            className="aspect-[16/8] w-full object-cover transition duration-500 group-hover:scale-[1.01]"
                          />
                        </div>
                      )}

                      {/* Location display line */}
                      <div className="mt-4 flex flex-wrap items-center gap-3 py-3 border-y border-gray-100">
                        <div className="flex items-center space-x-1 font-sans text-xs font-semibold text-gray-700">
                          <MapPin className="h-4 w-4 text-red-500 shrink-0" />
                          <span>{post.locationName}</span>
                        </div>
                        {distanceStr && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[10px] font-bold text-gray-600">
                            {distanceStr}
                          </span>
                        )}
                        <span className="ml-auto font-sans text-xs text-gray-400">
                          By: <strong className="text-gray-600 font-semibold">{post.isAnonymous ? 'Anonymous User' : post.userName}</strong>
                        </span>
                      </div>

                      {/* Type-Specific Action Bars */}
                      <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        
                        {/* Vote Action Buttons */}
                        {post.type === 'Alert' ? (
                          <div className="flex flex-wrap items-center gap-1.5 bg-gray-50 p-1 rounded-xl w-fit border border-gray-150">
                            <button
                              onClick={(e) => { e.stopPropagation(); onVote(post.id, 'True'); }}
                              className="inline-flex items-center space-x-1 rounded-lg px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
                              title="Mark as Real/Confirmed Incident"
                              id={`vote-true-btn-${post.id}`}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              <span>True ({trueVotes})</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onVote(post.id, 'False News'); }}
                              className="inline-flex items-center space-x-1 rounded-lg px-2.5 py-1 text-xs font-bold text-red-800 hover:bg-red-100 transition"
                              title="Report as misinformation or fake post"
                              id={`vote-false-btn-${post.id}`}
                            >
                              <XCircle className="h-3.5 w-3.5 text-red-600" />
                              <span>Fake ({falseVotes})</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onVote(post.id, 'Unsure'); }}
                              className="inline-flex items-center space-x-1 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 hover:bg-slate-200 transition"
                              title="I am not sure of the current status"
                            >
                              <Clock className="h-3.5 w-3.5 text-slate-500" />
                              <span>Unsure ({unsureVotes})</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); onVote(post.id, 'Support'); }}
                              className="inline-flex items-center space-x-1.5 rounded-xl bg-purple-50 border border-purple-150 px-3.5 py-1.5 text-xs font-bold text-purple-800 hover:bg-purple-100 transition"
                              id={`vote-support-btn-${post.id}`}
                            >
                              <ThumbsUp className="h-3.5 w-3.5 text-purple-600" />
                              <span>Support Demand ({supportVotes})</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onVote(post.id, 'Not Priority'); }}
                              className="inline-flex items-center space-x-1.5 rounded-xl bg-gray-50 border border-gray-200 px-3.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition"
                            >
                              <span>Not Priority ({notPriorityVotes})</span>
                            </button>
                          </div>
                        )}

                        {/* Comments, Share, and Reports Actions */}
                        <div className="flex items-center justify-between sm:justify-start gap-3">
                          <button
                            onClick={() => onNavigate('post-detail', post.id)}
                            className="inline-flex items-center space-x-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition"
                          >
                            <MessageSquare className="h-4 w-4" />
                            <span>{post.comments.length} Comments</span>
                          </button>

                          <button
                            onClick={() => handleShare(post.id)}
                            className="inline-flex items-center space-x-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition"
                            title="Copy incident route coordinates link"
                          >
                            <Share2 className="h-4 w-4" />
                            <span>{copiedPostId === post.id ? 'Copied' : 'Share'}</span>
                          </button>

                          <button
                            onClick={() => onReport(post.id)}
                            className={`inline-flex items-center space-x-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-400 hover:bg-red-50 hover:text-red-700 transition ${
                              post.reportedCount > 0 ? 'text-red-500 bg-red-50' : ''
                            }`}
                            id={`report-post-btn-${post.id}`}
                          >
                            <span>Report</span>
                          </button>
                        </div>

                      </div>

                      {/* Safety Disclaimer */}
                      <p className="mt-3.5 font-sans text-[10px] italic text-gray-400">
                        *Community Statement: Auto-verified calculations and OpenStreet location maps. Not officially confirmed.
                      </p>

                    </motion.article>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
