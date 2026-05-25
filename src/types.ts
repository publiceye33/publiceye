export type Severity = 'High' | 'Medium' | 'Low';

export type AlertCategory =
  | 'Fire'
  | 'Accident'
  | 'Flood'
  | 'Storm'
  | 'Robbery/Crime'
  | 'Road damage'
  | 'Water problem'
  | 'Electricity problem'
  | 'Gas leak'
  | 'Other';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface UserProfile {
  id: string;
  phoneNumber: string;
  name: string;
  area: string;
  joinDate: string;
  postsCount: number;
  // silent backend tracking (hidden from UI)
  falsePostCount: number;
  spamBehavior: boolean;
  deviceFingerprint: string;
  isFlagged: boolean;
}

export interface Vote {
  userId: string;
  type: 'True' | 'False News' | 'Unsure' | 'Support' | 'Not Priority';
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  content: string;
  photoUrl?: string;
  timestamp: string;
  isAnonymous: boolean;
  isUpdate: boolean; // e.g. "Fire is now extinguished"
  reportedCount: number;
}

export interface IncidentPost {
  id: string;
  type: 'Alert' | 'Civic';
  title: string;
  description: string;
  photoUrl?: string;
  locationName: string; // e.g., "Mirpur 10, Dhaka"
  coordinates?: LocationCoordinates;
  category?: AlertCategory; // Only for alerts
  severity?: Severity; // Only for alerts
  isAnonymous: boolean;
  userId: string;
  userName: string;
  userArea: string;
  timestamp: string; // ISO string
  votes: Vote[];
  comments: Comment[];
  isArchived: boolean;
  reportedCount: number;
  expireTime: string; // ISO string
}

export interface OfflineDraft {
  id: string;
  type: 'Alert' | 'Civic';
  title: string;
  description: string;
  category?: AlertCategory;
  severity?: Severity;
  photoData?: string; // base64 representation for offline storage
  coordinates?: LocationCoordinates;
  isAnonymous: boolean;
  timestamp: string;
}

export interface AppState {
  currentUser: UserProfile | null;
  posts: IncidentPost[];
  offlineDrafts: OfflineDraft[];
  currentView: 'home' | 'login' | 'create' | 'post-detail' | 'profile' | 'archive' | 'admin';
  selectedPostId: string | null;
  selectedProfileId: string | null;
  selectedCategory: AlertCategory | 'All';
  selectedSeverity: Severity | 'All';
  selectedZone: string; // Bangladesh divisions/areas e.g., "Dhaka", "Chittagong", "Mirpur"
  searchQuery: string;
  sortBy: 'nearby' | 'recent';
}
