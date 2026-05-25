import React, { useState } from 'react';
import { IncidentPost, UserProfile, Comment } from '../types';
import { 
  ArrowLeft, MapPin, Clock, ThumbsUp, MessageSquare, AlertTriangle, 
  Send, Camera, EyeOff, CheckCircle2, XCircle, Info, Flame, Loader2, Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { uploadToCloudinarySimulated } from '../utils';

interface PostDetailViewProps {
  post: IncidentPost;
  currentUser: UserProfile | null;
  isOnline: boolean;
  onBack: () => void;
  onVote: (postId: string, type: 'True' | 'False News' | 'Unsure' | 'Support' | 'Not Priority') => void;
  onAddComment: (postId: string, content: string, fileUrl?: string, isUpdate?: boolean, isAnonymous?: boolean) => void;
  onReportPost: (postId: string) => void;
  onReportComment: (postId: string, commentId: string) => void;
}

export default function PostDetailView({
  post,
  currentUser,
  isOnline,
  onBack,
  onVote,
  onAddComment,
  onReportPost,
  onReportComment,
}: PostDetailViewProps) {
  const [commentText, setCommentText] = useState('');
  const [commentPhoto, setCommentPhoto] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isAnonymousComment, setIsAnonymousComment] = useState(false);
  const [isEmergencyUpdate, setIsEmergencyUpdate] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Count votes
  const trueVotes = post.votes.filter(v => v.type === 'True').length;
  const falseVotes = post.votes.filter(v => v.type === 'False News').length;
  const unsureVotes = post.votes.filter(v => v.type === 'Unsure').length;
  const supportVotes = post.votes.filter(v => v.type === 'Support').length;
  const notPriorityVotes = post.votes.filter(v => v.type === 'Not Priority').length;
  const totalVotes = post.votes.length;

  // Calculate percentages
  const truePercent = totalVotes > 0 ? Math.round((trueVotes / totalVotes) * 100) : 0;
  const falsePercent = totalVotes > 0 ? Math.round((falseVotes / totalVotes) * 100) : 0;
  const unsurePercent = totalVotes > 0 ? Math.round((unsureVotes / totalVotes) * 100) : 0;

  const supportPercent = totalVotes > 0 ? Math.round((supportVotes / totalVotes) * 100) : 0;
  const priorityPercent = totalVotes > 0 ? Math.round((notPriorityVotes / totalVotes) * 100) : 0;

  // Comment submit
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    onAddComment(
      post.id,
      commentText,
      commentPhoto || undefined,
      isEmergencyUpdate,
      isAnonymousComment
    );

    setCommentText('');
    setCommentPhoto(null);
    setIsEmergencyUpdate(false);
    
    setSuccessMsg('Comment posted successfully!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Convert uploaded comment attachment image
  const handleCommentPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsCompressing(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const result = await uploadToCloudinarySimulated(reader.result as string);
          setCommentPhoto(result.url);
        } catch (err) {
          console.error('Failed to attach comment photo', err);
        } finally {
          setIsCompressing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8" id="single-post-focus">
      
      {/* Back Button and Actions Topline */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 py-2 px-4 font-sans text-xs font-bold text-gray-700 transition"
          id="back-to-feed-button"
        >
          <ArrowLeft className="h-4 w-4 text-gray-500" />
          <span>Back to Feed</span>
        </button>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onReportPost(post.id)}
            className={`rounded-xl border border-red-100 bg-red-50 px-4 py-2 font-sans text-xs font-bold text-red-700 hover:bg-red-100 transition ${
              post.reportedCount > 0 ? 'bg-red-100 animate-pulse' : ''
            }`}
            id="report-single-post-action"
          >
            {post.reportedCount > 0 ? 'Flagged for Review' : 'Report Fake/Abusive Content'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Content Pane Left Columns */}
        <div className="lg:col-span-2 space-y-6">
          
          <article className="rounded-2xl border border-gray-150 bg-white p-6 sm:p-8 shadow-xs">
            
            {/* Context Categories Banner */}
            <div className="flex items-center justify-between mb-4">
              <span className={`inline-flex items-center space-x-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold ${
                post.type === 'Alert' ? 'bg-red-50 text-red-700 border-red-150' : 'bg-purple-50 text-purple-700 border-purple-150'
              }`}>
                {post.type === 'Alert' ? `${post.category} Alert` : 'Civic Community Demand'}
              </span>

              <span className="font-mono text-[11px] text-gray-400">
                {new Date(post.timestamp).toLocaleString()}
              </span>
            </div>

            <h1 className="font-sans font-extrabold text-2xl text-gray-950 tracking-tight leading-8" id="post-focus-title">
              {post.title}
            </h1>

            {/* Location display detail line */}
            <div className="mt-3 flex items-center space-x-2 text-gray-700 font-sans text-xs font-semibold py-2.5 border-y border-gray-100 mb-5">
              <MapPin className="h-4.5 w-4.5 text-red-600 shrink-0" />
              <span>{post.locationName}</span>
              {post.coordinates && (
                <span className="font-mono text-[9px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                  Lat: {post.coordinates.latitude.toFixed(4)}, Lon: {post.coordinates.longitude.toFixed(4)}
                </span>
              )}
            </div>

            {/* Poster Name Detail */}
            <div className="mb-6 flex items-center space-x-3">
              <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-gray-150 text-gray-650 font-sans font-extrabold text-sm uppercase">
                {post.userName.slice(0, 2)}
              </div>
              <div>
                <span className="font-sans text-xs font-bold text-gray-950">
                  {post.isAnonymous ? 'Anonymous Citizen' : post.userName}
                </span>
                <p className="font-sans text-[10px] text-gray-400">
                  Reg Area: {post.userArea} • Join Date: 2026 Bangladesh System
                </p>
              </div>
            </div>

            <p className="font-sans text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {post.description}
            </p>

            {/* Incident Photo display */}
            {post.photoUrl && (
              <div className="mt-6 rounded-2xl overflow-hidden border border-gray-100">
                <img
                  src={post.photoUrl}
                  alt={post.title}
                  referrerPolicy="no-referrer"
                  className="w-full object-cover max-h-[380px]"
                />
              </div>
            )}

            {/* Mandatory legal disclaimers */}
            <div className="mt-8 rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-2">
              <span className="font-mono text-[10px] uppercase font-extrabold text-amber-800 tracking-wider flex items-center space-x-1">
                <Info className="h-4 w-4" />
                <span>Security Notice & Community Disclaimer</span>
              </span>
              <p className="font-sans text-[11px] text-amber-900 leading-relaxed">
                This information is community-submitted and not officially verified by Bangladesh civil emergency bodies. Observers are cautioned to judge coordinates for themselves. Comply with standard personal safety guidelines before approaching High Severity events.
              </p>
            </div>

          </article>

          {/* Comment Stream Module */}
          <div className="space-y-4">
            <h3 className="font-sans font-extrabold text-base text-gray-950 flex items-center space-x-2">
              <MessageSquare className="h-5 w-5 text-gray-500" />
              <span>Comments Timeline ({post.comments.length})</span>
            </h3>

            {/* Leave a Comment Box */}
            <form onSubmit={handleCommentSubmit} className="rounded-2xl border border-gray-150 bg-white p-5 space-y-4 shadow-xs">
              
              {successMsg && (
                <div className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-150 rounded px-2.5 py-1">
                  {successMsg}
                </div>
              )}

              <textarea
                rows={3}
                placeholder="Share critical updates (such as 'Jam cleared' or 'Fire truck has arrived') or report supporting details..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 px-3.5 text-xs font-sans focus:border-red-500 focus:bg-white focus:outline-none"
                id="comment-text-field"
                required
              />

              {/* Advanced Comment Toggles: Anonymous, Event Update, Photo Option */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                
                <div className="flex flex-wrap items-center gap-3">
                  
                  {/* Photo attachment for Comment input representation */}
                  <label className="relative flex cursor-pointer items-center space-x-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 py-1.5 px-2.5 font-sans text-[10px] font-bold text-gray-600 transition">
                    <Camera className="h-3.5 w-3.5" />
                    <span>{commentPhoto ? 'Image Attached' : 'Attach Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCommentPhotoChange}
                      className="sr-only"
                    />
                  </label>

                  {/* Anonymous selector */}
                  <label className="inline-flex items-center space-x-1.5 cursor-pointer text-gray-600">
                    <input
                      type="checkbox"
                      checked={isAnonymousComment}
                      onChange={(e) => setIsAnonymousComment(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="font-sans text-[10px] font-extrabold flex items-center">
                      <EyeOff className="h-3 w-3 mr-1 text-gray-400" />
                      Post Anonymous
                    </span>
                  </label>

                  {/* Crucial Emergency status update toggle */}
                  {post.type === 'Alert' && (
                    <label className="inline-flex items-center space-x-1.5 cursor-pointer text-red-700">
                      <input
                        type="checkbox"
                        checked={isEmergencyUpdate}
                        onChange={(e) => setIsEmergencyUpdate(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500 bg-red-100"
                        id="emergency-update-checkbox"
                      />
                      <span className="font-sans text-[10px] font-extrabold flex items-center">
                        <Flame className="h-3.5 w-3.5 text-orange-500 mr-0.5 animate-pulse" />
                        Critial Situation Update
                      </span>
                    </label>
                  )}

                </div>

                <button
                  type="submit"
                  disabled={isCompressing || !isOnline}
                  className="inline-flex items-center justify-center space-x-1.5 rounded-xl bg-gray-950 hover:bg-gray-800 disabled:opacity-40 text-white font-sans text-xs font-bold py-2 px-4 transition"
                  id="submit-comment-button"
                >
                  {isCompressing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                      <span>Compressing...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Comment</span>
                    </>
                  )}
                </button>

              </div>

              {/* Comment attached photo preview */}
              {commentPhoto && (
                <div className="rounded-lg border border-teal-150 bg-teal-50/50 p-2 flex gap-2 w-fit">
                  <img src={commentPhoto} alt="Comment snapshot" referrerPolicy="no-referrer" className="h-8 w-8 rounded object-cover" />
                  <div className="text-[9px] text-teal-900 font-sans flex flex-col justify-center">
                    <span className="font-semibold text-teal-700">Attachment compressed successfully</span>
                    <button type="button" onClick={() => setCommentPhoto(null)} className="underline text-red-600 text-[8px] font-bold text-left">Remove</button>
                  </div>
                </div>
              )}

              {!isOnline && (
                <p className="text-[10px] text-amber-700 font-mono">
                  *Offline draft comment: Will queue and post when connection returns!
                </p>
              )}

            </form>

            {/* Comments Display Thread List */}
            <div className="space-y-3">
              {post.comments.length === 0 ? (
                <p className="text-center font-sans text-xs text-gray-400 py-6 border border-dashed border-gray-150 rounded-xl bg-white">
                  No registered responses yet. Write the first update!
                </p>
              ) : (
                post.comments.map((comment) => (
                  <div 
                    key={comment.id}
                    className={`rounded-xl border p-4 bg-white transition ${
                      comment.isUpdate 
                        ? 'border-orange-200 bg-orange-50/40 shadow-xs shadow-orange-100/50' 
                        : 'border-gray-150'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {comment.isUpdate && (
                          <span className="rounded bg-orange-600 px-1.5 py-0.5 font-sans text-[8px] font-extrabold uppercase tracking-wider text-white flex items-center mr-1">
                            ⚠️ EMERGENCY STATUS UPDATE
                          </span>
                        )}
                        <span className="font-sans text-xs font-bold text-gray-900">
                          {comment.isAnonymous ? 'Anonymous User' : comment.userName}
                        </span>
                        <span className="font-mono text-[9px] text-gray-400">
                          {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <button
                        onClick={() => onReportComment(post.id, comment.id)}
                        className={`font-sans text-[9px] font-bold ${
                          comment.reportedCount > 0 ? 'text-red-600 bg-red-50 px-1 py-0.5 rounded' : 'text-gray-400 hover:underline'
                        }`}
                      >
                        {comment.reportedCount > 0 ? 'Abuse Reported' : 'Report'}
                      </button>
                    </div>

                    <p className={`font-sans text-xs text-gray-700 leading-relaxed ${
                      comment.isUpdate ? 'font-bold text-gray-900' : ''
                    }`}>
                      {comment.content}
                    </p>

                    {comment.photoUrl && (
                      <div className="mt-2 text-left">
                        <img 
                          src={comment.photoUrl} 
                          alt="Comment visual attachment" 
                          referrerPolicy="no-referrer"
                          className="rounded-lg max-h-[140px] max-w-full object-cover border border-gray-150 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

          </div>

        </div>

        {/* Voting Analytics Right Column */}
        <div className="lg:col-span-1 space-y-6">
          
          <div className="rounded-2xl border border-gray-150 bg-white p-5 space-y-5 shadow-xs">
            
            <h3 className="font-sans font-extrabold text-sm text-gray-900 pb-3 border-b border-gray-150 tracking-wide uppercase font-mono">
              Citizen Verification
            </h3>

            {/* Voting Rules Reminder */}
            <p className="font-sans text-[11px] leading-relaxed text-gray-400">
              Each authenticated citizen gets exactly <span className="font-semibold text-gray-700">one vote</span> per topic. Votes act strictly as public safety references to help neighbors judge themselves.
            </p>

            {/* Emergency Alerts interactive voter */}
            {post.type === 'Alert' ? (
              <div className="space-y-4">
                
                <div className="space-y-2">
                  <span className="block font-mono text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                    Current Vote Percentages
                  </span>

                  {/* True Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-emerald-700 font-sans flex items-center">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        True Confirms
                      </span>
                      <span>{truePercent}% ({trueVotes})</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-emerald-600 h-full rounded-full transition-all duration-300" style={{ width: `${truePercent}%` }} />
                    </div>
                  </div>

                  {/* Fake Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-red-700 font-sans flex items-center">
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        False/Fake Reports
                      </span>
                      <span>{falsePercent}% ({falseVotes})</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-red-500 h-full rounded-full transition-all duration-300" style={{ width: `${falsePercent}%` }} />
                    </div>
                  </div>

                  {/* Unsure Bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
                      <span className="flex items-center">
                        <Clock className="h-3.5 w-3.5 mr-1 text-gray-400" />
                        Unsure Citizens
                      </span>
                      <span>{unsurePercent}% ({unsureVotes})</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-slate-400 h-full rounded-full transition-all duration-300" style={{ width: `${unsurePercent}%` }} />
                    </div>
                  </div>

                </div>

                <div className="border-t border-gray-100 pt-4 space-y-2 inline-block w-full" id="detailed-voters-pane">
                  <span className="block font-mono text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">
                    Cast Your Verification Ballot
                  </span>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => onVote(post.id, 'True')}
                      className="w-full flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 py-2.5 px-3.5 text-xs font-bold text-emerald-800 transition shadow-xs"
                      id="detail-vote-true"
                    >
                      <span className="flex items-center">
                        <CheckCircle2 className="h-4 w-4 mr-1 text-emerald-600" />
                        Confirm this is True
                      </span>
                      <span className="bg-emerald-200 text-emerald-900 px-1.5 py-0.5 rounded font-mono text-[9px]">{trueVotes}</span>
                    </button>

                    <button
                      onClick={() => onVote(post.id, 'False News')}
                      className="w-full flex items-center justify-between rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-100 py-2.5 px-3.5 text-xs font-bold text-red-800 transition shadow-xs"
                      id="detail-vote-fake"
                    >
                      <span className="flex items-center">
                        <XCircle className="h-4 w-4 mr-1 text-red-600" />
                        Flag as misinformation
                      </span>
                      <span className="bg-red-200 text-red-900 px-1.5 py-0.5 rounded font-mono text-[9px]">{falseVotes}</span>
                    </button>

                    <button
                      onClick={() => onVote(post.id, 'Unsure')}
                      className="w-full flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 py-2.5 px-3.5 text-xs font-semibold text-gray-600 transition shadow-xs"
                    >
                      <span>I am unsure of status</span>
                      <span className="bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-mono text-[9px]">{unsureVotes}</span>
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              /* Civic Demands Interactive Voter */
              <div className="space-y-4">
                
                <div className="space-y-2">
                  <span className="block font-mono text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                    Community Endorsements
                  </span>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-purple-700 font-sans flex items-center">
                        <ThumbsUp className="h-3.5 w-3.5 mr-1" />
                        Support Priority
                      </span>
                      <span>{supportVotes} votes</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
                      <span>Not Public Priority</span>
                      <span>{notPriorityVotes} votes</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4 space-y-2">
                  <span className="block font-mono text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">
                    Endorse Civic Demands
                  </span>

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => onVote(post.id, 'Support')}
                      className="w-full flex items-center justify-center space-x-2 rounded-xl bg-purple-600 hover:bg-purple-500 py-2.5 px-4 text-xs font-bold text-white transition shadow-sm shadow-purple-200"
                      id="detail-vote-support"
                    >
                      <ThumbsUp className="h-4 w-4 text-white" />
                      <span>Support Demand ({supportVotes})</span>
                    </button>

                    <button
                      onClick={() => onVote(post.id, 'Not Priority')}
                      className="w-full flex items-center justify-center space-x-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 py-2.5 px-4 text-xs font-semibold text-gray-500 transition"
                    >
                      <span>Not a Priority ({notPriorityVotes})</span>
                    </button>
                  </div>
                </div>

              </div>
            )}

            {/* Expiry Details Tracker */}
            <div className="border-t border-gray-150 pt-4 flex items-start space-x-2.5 text-[11px] font-sans text-gray-500 leading-normal">
              <Clock className="h-4 w-4 text-red-500 shrink-0" />
              <div>
                <span className="font-semibold text-gray-900 block">Incident Life Expiration System</span>
                <span className="mt-0.5 block">Estimated expiry: <strong>{new Date(post.expireTime).toLocaleDateString()}</strong></span>
                <span className="mt-0.5 block text-gray-400 leading-tight">After this date, the item archives silently to maintain an clutter-free emergency timeline. The community can vote to extend once archived.</span>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
