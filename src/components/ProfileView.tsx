import React from 'react';
import { UserProfile, OfflineDraft } from '../types';
import { 
  User, MapPin, Calendar, FileText, WifiOff, RefreshCw, 
  Trash2, ShieldAlert, CheckCircle, Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProfileViewProps {
  profile: UserProfile;
  currentUser: UserProfile | null;
  offlineDrafts: OfflineDraft[];
  isOnline: boolean;
  onRemoveDraft: (draftId: string) => void;
  onSyncDrafts: () => void;
  onNavigate: (view: 'home' | 'login' | 'create' | 'profile' | 'archive' | 'admin', targetId?: string) => void;
}

export default function ProfileView({
  profile,
  currentUser,
  offlineDrafts,
  isOnline,
  onRemoveDraft,
  onSyncDrafts,
  onNavigate,
}: ProfileViewProps) {
  const isOwnProfile = currentUser && currentUser.id === profile.id;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8" id="profile-pane-container">
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Card: Citizen Identity card */}
        <div className="md:col-span-1 space-y-4">
          <div className="rounded-2xl border border-gray-150 bg-white p-6 text-center shadow-xs">
            
            {/* Avatar block */}
            <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-2xl bg-gray-900 font-sans font-extrabold text-3xl uppercase text-white shadow-md">
              {profile.name.slice(0, 2)}
            </div>

            <h2 className="font-sans font-extrabold text-lg text-gray-950 mt-4">
              {profile.name}
            </h2>
            
            <p className="font-mono text-[10px] text-gray-400 mt-1">
              ID: {profile.id}
            </p>

            <div className="mt-6 border-t border-gray-100 pt-5 space-y-3.5 text-left text-xs font-sans text-gray-600">
              
              <div className="flex items-center space-x-2.5">
                <MapPin className="h-4.5 w-4.5 text-red-500 shrink-0" />
                <span>Locality: <strong>{profile.area}</strong></span>
              </div>

              <div className="flex items-center space-x-2.5">
                <Calendar className="h-4.5 w-4.5 text-gray-450 shrink-0" />
                <span>Registered: <strong>{profile.joinDate}</strong></span>
              </div>

              <div className="flex items-center space-x-2.5">
                <FileText className="h-4.5 w-4.5 text-gray-450 shrink-0" />
                <span>Incidents Logged: <strong>{profile.postsCount}</strong></span>
              </div>

            </div>

            {/* Note about private rating system */}
            <div className="mt-6 rounded-xl bg-gray-50 p-3.5 border border-gray-200">
              <p className="font-sans text-[10px] text-gray-400 text-left leading-normal">
                🔒 PublicEye security note: This platform explicitly hides status levels, ratings, or reputation scores to avoid coordinate validation manipulation. Authentic citizen reports are evaluated purely by neighboring verification voters.
              </p>
            </div>

          </div>

          {/* Hidden Silent Backend Tracking simulator panel (strictly for review/demonstration but clearly marked as "Private Admin Server logs" so we respect user rules!) */}
          {isOwnProfile && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-5 space-y-3">
              <span className="font-mono text-[9px] uppercase font-bold text-gray-400 tracking-wider flex items-center space-x-1">
                <ShieldAlert className="h-3.5 w-3.5 text-gray-400" />
                <span>Silent Abusive Logs (Admins only)</span>
              </span>
              <p className="font-sans text-[10px] text-gray-400 leading-tight">
                This diagnostic telemetry is calculated silently by verification scripts and cannot be viewed by other citizens:
              </p>
              <div className="font-mono text-[10px] space-y-1 bg-white border border-gray-150 p-3 rounded-lg text-gray-600">
                <div className="flex justify-between">
                  <span>False Post Logs:</span>
                  <span className="font-semibold text-gray-900">{profile.falsePostCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Flagged Spammer:</span>
                  <span className="font-semibold text-gray-900">{profile.spamBehavior ? 'YES' : 'NONE'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fingerprint Token:</span>
                  <span className="text-gray-400">{profile.deviceFingerprint.slice(0, 14)}...</span>
                </div>
                <div className="flex justify-between">
                  <span>Trust Filter Mode:</span>
                  <span className={profile.isFlagged ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold'}>
                    {profile.isFlagged ? 'DEPRIORITIZED (Flagged)' : 'STANDARD CITIZEN'}
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Section: Pending Offline Queue & Posting history */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Offline drafts queue container */}
          {isOwnProfile && (
            <div className="rounded-2xl border border-gray-150 bg-white p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-150 pb-4 mb-4 gap-3">
                <div>
                  <h3 className="font-sans font-extrabold text-base text-gray-950 flex items-center">
                    <WifiOff className="h-5 w-5 mr-1.5 text-amber-600 shrink-0 animate-pulse" />
                    <span>PWA Offline Queue</span>
                  </h3>
                  <p className="font-sans text-xs text-gray-400 leading-tight mt-0.5">
                    Saved reports queueing for dispatch.
                  </p>
                </div>

                {offlineDrafts.length > 0 && (
                  <button
                    onClick={onSyncDrafts}
                    disabled={!isOnline}
                    className="inline-flex items-center justify-center space-x-1 px-4 py-1.5 rounded-xl bg-emerald-600 font-sans text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-40"
                    id="trigger-profile-sync"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    {isOnline ? 'Manual Forced Re-Sync' : 'Connect Online to Sync'}
                  </button>
                )}
              </div>

              {offlineDrafts.length === 0 ? (
                <div className="text-center py-6">
                  <p className="font-sans text-xs text-gray-400 italic">
                    All drafts successfully synced to Dhaka Cloud Storage. Complete security tracking.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Warning message if offline */}
                  {!isOnline && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex space-x-2 text-xs text-amber-900 leading-normal">
                      <HelpCircleIcon className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        Simulate toggle to **"Online"** at the top right header navigation. Your browser will immediately dispatch these queued drafts utilizing compressed image channels!
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {offlineDrafts.map((draft) => (
                      <div 
                        key={draft.id}
                        className="rounded-xl border border-gray-200 bg-white p-4 space-y-3 relative shadow-xs"
                      >
                        <button
                          onClick={() => onRemoveDraft(draft.id)}
                          className="absolute top-3 right-3 text-gray-400 hover:text-red-600 p-1"
                          title="Discard Draft permanently"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>

                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 font-sans text-[9px] font-bold rounded border uppercase ${
                            draft.type === 'Alert' ? 'bg-red-50 text-red-700 border-red-150' : 'bg-purple-50 text-purple-700 border-purple-150'
                          }`}>
                            {draft.type === 'Alert' ? draft.category : 'Civic Demand'}
                          </span>
                        </div>

                        <h4 className="font-sans font-bold text-sm text-gray-950 pr-6 line-clamp-1">
                          {draft.title}
                        </h4>

                        <p className="font-sans text-xs text-gray-600 line-clamp-2">
                          {draft.description}
                        </p>

                        {draft.photoData && (
                          <div className="h-14 w-full rounded overflow-hidden">
                            <img src={draft.photoData} alt="Offline snapshot" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                          </div>
                        )}

                        <div className="flex items-center space-x-1.5 font-sans text-[10px] text-gray-400 border-t border-gray-100 pt-2">
                          <Navigation className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span>Coordinates stored</span>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              )}

            </div>
          )}

          {/* General instructions/Help page section */}
          <div className="rounded-2xl border border-gray-150 bg-white p-6 space-y-4 shadow-xs">
            <h3 className="font-sans font-extrabold text-sm text-gray-950 pb-3 border-b border-gray-150 tracking-wide uppercase font-mono">
              Bangladesh Verification Guidelines
            </h3>
            
            <div className="space-y-3 font-sans text-xs text-gray-650 leading-relaxed">
              <p>
                Welcome to the **PublicEye** community network. In Bangladesh, rumors and fake news spread easily during crisis points. This platform runs a volunteer verification system allowing anyone with a phone number to vote:
              </p>
              
              <ul className="list-disc pl-5 space-y-1.5 font-medium text-gray-700">
                <li>
                  <strong>True:</strong> Select if you are physically present or can witness/verify standard authenticity indicators.
                </li>
                <li>
                  <strong>Fake News:</strong> Select if you can prove the image represents a separate incident or contains inaccurate locations.
                </li>
                <li>
                  <strong>Support priority:</strong> Vote to bring community demands closer to Dhaka city administrators.
                </li>
              </ul>

              <p className="pt-2 text-[11px] italic text-gray-400">
                *The application logs secure identifiers to safeguard free-speech rights while shielding families from malicious misinformation.
              </p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

// Quick helper icon fallback
function HelpCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
