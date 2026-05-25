import React, { useState, useEffect } from 'react';
import { IncidentPost, UserProfile, OfflineDraft, LocationCoordinates } from './types';
import { LocalDB, calculateExpiryTime, AREA_COORDINATES, getSeedData } from './utils';
import Header from './components/Header';
import Feed from './components/Feed';
import LoginView from './components/LoginView';
import CreatePostView from './components/CreatePostView';
import PostDetailView from './components/PostDetailView';
import ProfileView from './components/ProfileView';
import ArchiveView from './components/ArchiveView';
import AdminPanel from './components/AdminPanel';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Wifi, AlertTriangle } from 'lucide-react';

// Firebase Client SDK integrations
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, increment } from 'firebase/firestore';

export default function App() {
  // App primary States
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<IncidentPost[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [offlineDrafts, setOfflineDrafts] = useState<OfflineDraft[]>([]);
  
  // Simulated Networking Toggle (Super Interactive!)
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Router properties
  const [currentView, setCurrentView] = useState<'home' | 'login' | 'create' | 'post-detail' | 'profile' | 'archive' | 'admin'>('home');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [feedType, setFeedType] = useState<'Alert' | 'Civic'>('Alert');

  // GPS User location coordinates tracking
  const [userLocation, setUserLocation] = useState<LocationCoordinates | null>(null);

  // 1. Maintain Firebase Auth listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profileRef = doc(db, 'profiles', firebaseUser.uid);
          const snap = await getDoc(profileRef);
          if (snap.exists()) {
            const prof = snap.data() as UserProfile;
            setCurrentUser(prof);
            LocalDB.setCurrentUser(prof);
          } else {
            // New Google Login fallback default profile
            const defaultProf: UserProfile = {
              id: firebaseUser.uid,
              phoneNumber: firebaseUser.phoneNumber || '',
              name: firebaseUser.displayName || 'Citizen Volunteer',
              area: 'Mirpur, Dhaka',
              joinDate: new Date().toISOString().split('T')[0],
              postsCount: 0,
              falsePostCount: 0,
              spamBehavior: false,
              deviceFingerprint: `dev-fingerprint-${Math.random().toString(36).substring(7)}`,
              isFlagged: false,
            };
            try {
              await setDoc(profileRef, defaultProf);
              setCurrentUser(defaultProf);
              LocalDB.setCurrentUser(defaultProf);
            } catch (err) {
              handleFirestoreError(err, OperationType.CREATE, `profiles/${firebaseUser.uid}`);
            }
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `profiles/${firebaseUser.uid}`);
        }
      } else {
        setCurrentUser(null);
        LocalDB.setCurrentUser(null);
      }
    });

    return () => unsubAuth();
  }, []);

  // 2. Setup real-time listeners for Firestore Collections if Online
  useEffect(() => {
    if (!isOnline) return;

    // Real-time Profiles syncing
    const unsubProfiles = onSnapshot(collection(db, 'profiles'), (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach(d => {
        list.push(d.data() as UserProfile);
      });
      setProfiles(list);
      LocalDB.saveProfiles(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'profiles');
    });

    // Real-time Posts syncing
    const unsubPosts = onSnapshot(query(collection(db, 'posts'), orderBy('timestamp', 'desc')), async (snapshot) => {
      const list: IncidentPost[] = [];
      snapshot.forEach(d => {
        list.push(d.data() as IncidentPost);
      });

      // Seeding helper if online but firestore is empty
      if (snapshot.empty && list.length === 0) {
        const seed = getSeedData();
        try {
          for (const p of seed.profiles) {
            await setDoc(doc(db, 'profiles', p.id), p);
          }
          for (const postDoc of seed.posts) {
            await setDoc(doc(db, 'posts', postDoc.id), postDoc);
          }
        } catch (err) {
          console.error("Seeding failed on initialized boot:", err);
        }
        return;
      }

      setPosts(list);
      LocalDB.savePosts(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'posts');
    });

    return () => {
      unsubProfiles();
      unsubPosts();
    };
  }, [isOnline]);

  // Routing and tracking effect
  useEffect(() => {
    // 3. Obtain current GPS permission indicators silently on load
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        () => {
          console.warn('GPS signal blocked. Defaulting to Dhaka divisions coordinates.');
        }
      );
    }

    // 4. Setup Hash Router Initializer
    const handleHashRouter = () => {
      const hash = window.location.hash || '#/';
      if (hash === '#/' || hash === '') {
        setCurrentView('home');
      } else if (hash === '#/login') {
        setCurrentView('login');
      } else if (hash === '#/create') {
        setCurrentView('create');
      } else if (hash === '#/archive') {
        setCurrentView('archive');
      } else if (hash === '#/admin') {
        setCurrentView('admin');
      } else if (hash.startsWith('#/post/')) {
        const id = hash.replace('#/post/', '');
        setSelectedPostId(id);
        setCurrentView('post-detail');
      } else if (hash.startsWith('#/profile/')) {
        const id = hash.replace('#/profile/', '');
        setSelectedProfileId(id);
        setCurrentView('profile');
      }
    };

    window.addEventListener('hashchange', handleHashRouter);
    handleHashRouter(); // Trigger on mount

    return () => {
      window.removeEventListener('hashchange', handleHashRouter);
    };
  }, []);

  // Hash Navigation Dispatcher
  const navigateTo = (view: 'home' | 'login' | 'create' | 'post-detail' | 'profile' | 'archive' | 'admin', targetId?: string) => {
    if (view === 'home') {
      window.location.hash = '#/';
    } else if (view === 'login') {
      window.location.hash = '#/login';
    } else if (view === 'create') {
      window.location.hash = '#/create';
    } else if (view === 'archive') {
      window.location.hash = '#/archive';
    } else if (view === 'admin') {
      window.location.hash = '#/admin';
    } else if (view === 'post-detail' && targetId) {
      window.location.hash = `#/post/${targetId}`;
    } else if (view === 'profile' && targetId) {
      window.location.hash = `#/profile/${targetId}`;
    }
  };

  // Reconnection Auto-Sync Loop Trigger
  // Triggers immediate simulated compression-upload pipeline for all queues
  useEffect(() => {
    if (isOnline && offlineDrafts.length > 0) {
      setSyncToast(`Syncing ${offlineDrafts.length} buffered incident reports...`);
      
      setTimeout(async () => {
        let incrementor = 0;

        try {
          for (const draft of offlineDrafts) {
            const postExpiry = calculateExpiryTime(draft.category, draft.type);
            const postId = `post-${Date.now()}-${incrementor}`;
            
            const restoredPost: IncidentPost = {
              id: postId,
              type: draft.type,
              title: draft.title,
              description: draft.description,
              photoUrl: draft.photoData || undefined, // base64 representation recovered
              locationName: AREA_COORDINATES[currentUser?.area || ''] ? currentUser?.area || 'Dhaka' : 'Mirpur 10, Dhaka',
              coordinates: draft.coordinates || { latitude: 23.8103, longitude: 90.4125 },
              category: draft.category,
              severity: draft.severity,
              isAnonymous: draft.isAnonymous,
              userId: currentUser?.id || 'anonymous-user',
              userName: draft.isAnonymous ? 'Anonymous User' : (currentUser?.name || 'Citizen Volunteer'),
              userArea: currentUser?.area || 'Bangladesh Locality',
              timestamp: draft.timestamp,
              votes: [],
              comments: [],
              isArchived: false,
              reportedCount: 0,
              expireTime: postExpiry.toISOString(),
            };

            await setDoc(doc(db, 'posts', postId), restoredPost);
            incrementor++;
          }

          // Update profile post statistics
          if (currentUser) {
            const profileRef = doc(db, 'profiles', currentUser.id);
            const updated = { ...currentUser, postsCount: currentUser.postsCount + offlineDrafts.length };
            await setDoc(profileRef, updated);
            setCurrentUser(updated);
            LocalDB.setCurrentUser(updated);
          }

          // Wipe queue
          setOfflineDrafts([]);
          LocalDB.saveOfflineDrafts([]);
          setSyncToast('Reconnection sync complete! Local drafts synchronized with live database.');
          setTimeout(() => setSyncToast(null), 3000);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'posts/sync');
        }
      }, 2000);
    }
  }, [isOnline]);

  const handleToggleOnlineSimulated = () => {
    setIsOnline(prev => !prev);
  };

  // Auth logins
  const handleLoginSuccess = async (user: UserProfile) => {
    try {
      await setDoc(doc(db, 'profiles', user.id), user);
      setCurrentUser(user);
      LocalDB.setCurrentUser(user);
      navigateTo('home');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `profiles/${user.id}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      LocalDB.setCurrentUser(null);
      navigateTo('home');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Voting systems handlers
  const handleVote = async (postId: string, type: 'True' | 'False News' | 'Unsure' | 'Support' | 'Not Priority') => {
    if (!currentUser) {
      navigateTo('login');
      return;
    }

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    try {
      // Remove existing vote by this user
      const filteredVotes = post.votes.filter(v => v.userId !== currentUser.id);
      const newVote = { userId: currentUser.id, type };
      const updatedVotes = [...filteredVotes, newVote];

      // Anti-manipulation tracking rule checking
      // Silent false tracking: If a trusted poster post is voted "False News" by multiple voters, update poster profile counts
      if (type === 'False News') {
        const posterProfile = profiles.find(p => p.id === post.userId);
        if (posterProfile) {
          const newFalseCount = posterProfile.falsePostCount + 1;
          const autoSpamFlag = newFalseCount >= 2; // Flag after 2 fake claims!
          await updateDoc(doc(db, 'profiles', post.userId), {
            falsePostCount: newFalseCount,
            isFlagged: posterProfile.isFlagged || autoSpamFlag
          });
        }
      }

      await updateDoc(doc(db, 'posts', postId), { votes: updatedVotes });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${postId}`);
    }
  };

  // Adding comments with optional Emergency triggers
  const handleAddComment = async (
    postId: string, 
    content: string, 
    photoUrl?: string, 
    isUpdate?: boolean, 
    isAnonymous?: boolean
  ) => {
    if (!currentUser) {
      navigateTo('login');
      return;
    }

    const commentId = `comment-${Date.now()}`;
    const newComment = {
      id: commentId,
      postId,
      userId: currentUser.id,
      userName: isAnonymous ? 'Anonymous User' : currentUser.name,
      content,
      photoUrl: photoUrl || null,
      timestamp: new Date().toISOString(),
      isAnonymous: !!isAnonymous,
      isUpdate: !!isUpdate,
      reportedCount: 0,
    };

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    try {
      // 1. Write to nested comments array on parent post
      await updateDoc(doc(db, 'posts', postId), {
        comments: [...post.comments, newComment]
      });

      // 2. Dual-store inside standard Security-controlled comment subcollection
      await setDoc(doc(db, 'posts', postId, 'comments', commentId), newComment);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `posts/${postId}/comments/${commentId}`);
    }
  };

  // Reporting items (posts)
  const handleReportPost = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    try {
      await updateDoc(doc(db, 'posts', postId), {
        reportedCount: post.reportedCount + 1
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${postId}`);
    }
  };

  // Reporting items (comments)
  const handleReportComment = async (postId: string, commentId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    try {
      const updatedComments = post.comments.map(c => {
        if (c.id === commentId) {
          return { ...c, reportedCount: c.reportedCount + 1 };
        }
        return c;
      });

      // 1. Update comments in parent posts doc array
      await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });

      // 2. Update status in comments subcollection document
      await updateDoc(doc(db, 'posts', postId, 'comments', commentId), {
        reportedCount: increment(1)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${postId}/comments/${commentId}`);
    }
  };

  // Extending historical expiry boundary by 24h
  const handleExtendExpiry = async (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    try {
      const d = new Date(post.expireTime);
      d.setHours(d.getHours() + 24); // increment by 24 hours
      await updateDoc(doc(db, 'posts', postId), {
        expireTime: d.toISOString(),
        isArchived: false,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${postId}`);
    }
  };

  // Creation callback
  const handlePostCreated = async (post: IncidentPost | null, isDraft?: boolean) => {
    if (isDraft) {
      const storedDrafts = LocalDB.getOfflineDrafts();
      const newDrafts = [
        ...storedDrafts,
        {
          id: `draft-${Date.now()}`,
          type: feedType,
          title: 'Unsaved Incident Scene',
          description: 'Connection lapse pre-saved report data.',
          timestamp: new Date().toISOString()
        } as OfflineDraft
      ];
      LocalDB.saveOfflineDrafts(newDrafts);
      setOfflineDrafts(newDrafts);
      navigateTo('profile', currentUser?.id);
      return;
    }

    if (post) {
      try {
        await setDoc(doc(db, 'posts', post.id), post);
        
        // Update user profile counts
        if (currentUser) {
          const profileRef = doc(db, 'profiles', currentUser.id);
          const updatedUser = { ...currentUser, postsCount: currentUser.postsCount + 1 };
          await setDoc(profileRef, updatedUser);
          setCurrentUser(updatedUser);
          LocalDB.setCurrentUser(updatedUser);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `posts/${post.id}`);
      }
    }
  };

  // ADMIN OPERATIONS
  const handleDismissPostReports = async (postId: string) => {
    try {
      await updateDoc(doc(db, 'posts', postId), { reportedCount: 0 });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${postId}`);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deleteDoc(doc(db, 'posts', postId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `posts/${postId}`);
    }
  };

  const handleDismissCommentReports = async (postId: string, commentId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    try {
      const updatedComments = post.comments.map(c => {
        if (c.id === commentId) return { ...c, reportedCount: 0 };
        return c;
      });
      await updateDoc(doc(db, 'posts', postId), { comments: updatedComments });
      await updateDoc(doc(db, 'posts', postId, 'comments', commentId), { reportedCount: 0 });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${postId}/comments/${commentId}`);
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    try {
      const filteredComments = post.comments.filter(c => c.id !== commentId);
      await updateDoc(doc(db, 'posts', postId), { comments: filteredComments });
      await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `posts/${postId}/comments/${commentId}`);
    }
  };

  const handleToggleFlagProfile = async (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;

    try {
      await updateDoc(doc(db, 'profiles', profileId), { isFlagged: !profile.isFlagged });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `profiles/${profileId}`);
    }
  };

  const handleRemoveDraftPermanent = (draftId: string) => {
    const filtered = offlineDrafts.filter(d => d.id !== draftId);
    setOfflineDrafts(filtered);
    LocalDB.saveOfflineDrafts(filtered);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-gray-800" id="application-layout-root">
      
      {/* 1. Universal sticky header */}
      <Header
        currentUser={currentUser}
        currentView={currentView}
        onNavigate={navigateTo}
        isOnline={isOnline}
        onToggleOnline={handleToggleOnlineSimulated}
        onLogout={handleLogout}
        syncOfflineCount={offlineDrafts.length}
      />

      {/* 2. Interactive Auto Sync Notification Center */}
      <AnimatePresence>
        {syncToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-full bg-emerald-600 border border-emerald-500 px-6 py-2.5 text-xs font-bold text-white shadow-xl flex items-center space-x-2 animate-bounce"
            id="sync-toast-indicator"
          >
            <ShieldCheck className="h-4.5 w-4.5 text-white" />
            <span>{syncToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Central Router View Port */}
      <main className="flex-grow pb-16">
        {currentView === 'home' && (
          <Feed
            posts={posts}
            currentType={feedType}
            onChangeType={setFeedType}
            userLocation={userLocation}
            onNavigate={navigateTo}
            onVote={handleVote}
            onReport={handleReportPost}
          />
        )}

        {currentView === 'login' && (
          <LoginView
            onLoginSuccess={handleLoginSuccess}
            existingProfiles={profiles}
          />
        )}

        {currentView === 'create' && (
          <CreatePostView
            currentUser={currentUser}
            posts={posts}
            isOnline={isOnline}
            onPostCreated={handlePostCreated}
            onNavigate={navigateTo}
          />
        )}

        {currentView === 'post-detail' && selectedPostId && (
          (() => {
            const activePost = posts.find(p => p.id === selectedPostId);
            if (!activePost) {
              return (
                <div className="text-center py-16">
                  <AlertTriangle className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">Incident report not found or was removed by administrators.</p>
                  <button onClick={() => navigateTo('home')} className="mt-4 rounded-xl bg-gray-950 py-2 px-5 text-white text-xs font-bold">Return Home</button>
                </div>
              );
            }
            return (
              <PostDetailView
                post={activePost}
                currentUser={currentUser}
                isOnline={isOnline}
                onBack={() => navigateTo('home')}
                onVote={handleVote}
                onAddComment={handleAddComment}
                onReportPost={handleReportPost}
                onReportComment={handleReportComment}
              />
            );
          })()
        )}

        {currentView === 'profile' && selectedProfileId && (
          (() => {
            const profileToView = profiles.find(p => p.id === selectedProfileId);
            if (!profileToView) return <p className="text-center py-16 text-xs text-gray-400">Profile matches not indexed.</p>;
            return (
              <ProfileView
                profile={profileToView}
                currentUser={currentUser}
                offlineDrafts={offlineDrafts}
                isOnline={isOnline}
                onRemoveDraft={handleRemoveDraftPermanent}
                onSyncDrafts={() => setIsOnline(true)}
                onNavigate={navigateTo}
              />
            );
          })()
        )}

        {currentView === 'archive' && (
          <ArchiveView
            posts={posts}
            onNavigate={navigateTo}
            onExtendExpiry={handleExtendExpiry}
          />
        )}

        {currentView === 'admin' && (
          <AdminPanel
            posts={posts}
            profiles={profiles}
            onDismissPostReports={handleDismissPostReports}
            onDeletePost={handleDeletePost}
            onDismissCommentReports={handleDismissCommentReports}
            onDeleteComment={handleDeleteComment}
            onToggleFlagProfile={handleToggleFlagProfile}
          />
        )}
      </main>

      {/* 4. Human-centric styled PWA Bangladesh regulatory footer */}
      <footer className="w-full bg-white border-t border-gray-150 py-6 text-center">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-gray-400 gap-4">
          <p className="font-sans">
            © 2026 PublicEye Bangladesh Platform. Community-Administered OpenStreetMap Integrations.
          </p>
          <div className="flex justify-center space-x-4 font-semibold text-gray-500">
            <a href="#/" className="hover:underline">Home Feed</a>
            <a href="#/archive" className="hover:underline">Historical Archive</a>
            <a href="#/admin" className="hover:underline">Security desk</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
