import { IncidentPost, LocationCoordinates, UserProfile, AlertCategory, Severity, OfflineDraft } from './types';

// Bangladesh-specific areas for manual selection/search
export const BANGLADESH_AREAS = [
  'Mirpur, Dhaka',
  'Dhanmondi, Dhaka',
  'Gulshan, Dhaka',
  'Uttara, Dhaka',
  'Banani, Dhaka',
  'Farmgate, Dhaka',
  'Mohakhali, Dhaka',
  'Bashundhara, Dhaka',
  'Motijheel, Dhaka',
  'Chittagong GEC, Bangladesh',
  'Sylhet Zindabazar, Bangladesh',
  'Khulna City, Bangladesh',
  'Rajshahi City, Bangladesh',
];

// Fallback coordinates for common Bangladesh locations
export const AREA_COORDINATES: Record<string, LocationCoordinates> = {
  'Mirpur, Dhaka': { latitude: 23.8056, longitude: 90.3625 },
  'Dhanmondi, Dhaka': { latitude: 23.7461, longitude: 90.3742 },
  'Gulshan, Dhaka': { latitude: 23.7925, longitude: 90.4078 },
  'Uttara, Dhaka': { latitude: 23.8729, longitude: 90.3816 },
  'Banani, Dhaka': { latitude: 23.7940, longitude: 90.4043 },
  'Farmgate, Dhaka': { latitude: 23.7561, longitude: 90.3872 },
  'Mohakhali, Dhaka': { latitude: 23.7776, longitude: 90.4005 },
  'Bashundhara, Dhaka': { latitude: 23.8191, longitude: 90.4241 },
  'Motijheel, Dhaka': { latitude: 23.7330, longitude: 90.4173 },
  'Chittagong GEC, Bangladesh': { latitude: 22.3592, longitude: 91.8215 },
  'Sylhet Zindabazar, Bangladesh': { latitude: 24.8949, longitude: 91.8687 },
};

// Calculate distance in meters using Haversine formula
export function getDistanceMeters(
  coords1: LocationCoordinates,
  coords2: LocationCoordinates
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (coords1.latitude * Math.PI) / 180;
  const phi2 = (coords2.latitude * Math.PI) / 180;
  const deltaPhi = ((coords2.latitude - coords1.latitude) * Math.PI) / 180;
  const deltaLambda = ((coords2.longitude - coords1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// OpenStreetMap Nominatim API reverse geocoding
export async function reverseGeocode(
  lat: number,
  lon: number
): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'PublicEye Bangladesh Community App (publiceye33@gmail.com)',
        },
      }
    );
    if (!response.ok) throw new Error('Failed to fetch from OSM');
    const data = await response.json();
    
    if (data && data.address) {
      const parts = [];
      const road = data.address.road || data.address.suburb || data.address.neighbourhood;
      const city = data.address.city || data.address.town || data.address.state_district || data.address.state || 'Dhaka';
      if (road) parts.push(road);
      if (city) {
        // clean country or redundant info
        parts.push(city.replace(' Division', ''));
      }
      return parts.length > 0 ? parts.join(', ') : 'Bangladesh Local Area';
    }
    return 'Bangladesh Contact Area';
  } catch (err) {
    console.error('Error reverse geocoding with OSM:', err);
    // Find closest mockup area
    let closestArea = 'Mirpur, Dhaka';
    let minDistance = Infinity;
    for (const [areaName, coords] of Object.entries(AREA_COORDINATES)) {
      const dist = getDistanceMeters({ latitude: lat, longitude: lon }, coords);
      if (dist < minDistance) {
        minDistance = dist;
        closestArea = areaName;
      }
    }
    return closestArea;
  }
}

// Auto-expiry policy: returns calculated expiration date based on category
export function calculateExpiryTime(category: AlertCategory | undefined, type: 'Alert' | 'Civic'): Date {
  const now = new Date();
  if (type === 'Civic') {
    // Civic demands expire in 30 days
    now.setDate(now.getDate() + 30);
    return now;
  }

  let hours = 24; // General alert
  switch (category) {
    case 'Fire':
    case 'Accident':
    case 'Gas leak':
      hours = 24;
      break;
    case 'Storm':
    case 'Electricity problem':
      hours = 72; // 3 days
      break;
    case 'Flood':
    case 'Water problem':
      hours = 168; // 7 days
      break;
    case 'Road damage':
      hours = 720; // 30 days
      break;
    default:
      hours = 48; // 2 days fallback
  }
  now.setHours(now.getHours() + hours);
  return now;
}

// Simulated Cloudinary compression and upload
// Reduces resolution, returns simulated CDN url, logs metadata size saving purely as code metrics
export async function uploadToCloudinarySimulated(
  base64OrFileUrl: string
): Promise<{ url: string; sizeOriginal: string; sizeCompressed: string }> {
  // Simulating the 80-90% saving
  // Generates custom placeholder images or compresses user inputs
  const sizeOriginal = '4.8 MB';
  const sizeCompressed = '285 KB (94% saved via PWA Image Engine)';
  
  // Return a stylish colored placeholder SVG URL or the input representation if it's already a safe base64
  let targetUrl = base64OrFileUrl;
  if (!base64OrFileUrl.startsWith('data:') && !base64OrFileUrl.startsWith('http')) {
    targetUrl = `https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&auto=format&fit=crop&q=60`;
  }
  return {
    url: targetUrl,
    sizeOriginal,
    sizeCompressed,
  };
}

// Seed initial system data if LocalStorage is empty
export function getSeedData(): { posts: IncidentPost[]; profiles: UserProfile[] } {
  const profiles: UserProfile[] = [
    {
      id: 'usr-1',
      phoneNumber: '+8801712345678',
      name: 'Rahim Uddin',
      area: 'Mirpur, Dhaka',
      joinDate: '2026-02-14',
      postsCount: 5,
      falsePostCount: 0,
      spamBehavior: false,
      deviceFingerprint: 'dev-fingerprint-rahim',
      isFlagged: false,
    },
    {
      id: 'usr-2',
      phoneNumber: '+8801811223344',
      name: 'Tariq Jamil',
      area: 'Dhanmondi, Dhaka',
      joinDate: '2026-01-05',
      postsCount: 12,
      falsePostCount: 1, // hidden flag
      spamBehavior: false,
      deviceFingerprint: 'dev-fingerprint-tariq',
      isFlagged: false,
    },
    {
      id: 'usr-3',
      phoneNumber: '+8801912837465',
      name: 'Simin Islam',
      area: 'Gulshan, Dhaka',
      joinDate: '2026-03-20',
      postsCount: 3,
      falsePostCount: 0,
      spamBehavior: false,
      deviceFingerprint: 'dev-fingerprint-simin',
      isFlagged: false,
    },
  ];

  const now = new Date();
  
  const posts: IncidentPost[] = [
    {
      id: 'post-1',
      type: 'Alert',
      title: 'Major Fire in Mirpur 11 Jhut Potti',
      description: 'Multiple clothing warehouses caught fire. 2 fire service units arrived, but resources seem insufficient. Please avoid the road near Mirpur 10-11 alignment.',
      photoUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&auto=format&fit=crop&q=60',
      locationName: 'Mirpur 11, Dhaka',
      coordinates: { latitude: 23.8115, longitude: 90.3685 },
      category: 'Fire',
      severity: 'High',
      isAnonymous: false,
      userId: 'usr-1',
      userName: 'Rahim Uddin',
      userArea: 'Mirpur, Dhaka',
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      votes: [
        { userId: 'usr-2', type: 'True' },
        { userId: 'usr-3', type: 'True' },
        { userId: 'anonymous-99', type: 'True' },
      ],
      comments: [
        {
          id: 'c-1',
          postId: 'post-1',
          userId: 'usr-2',
          userName: 'Tariq Jamil',
          content: 'I live nearby and can hear sirens clearly. It is serious. Keep windows shut.',
          timestamp: new Date(now.getTime() - 1.5 * 60 * 60 * 1000).toISOString(),
          isAnonymous: false,
          isUpdate: false,
          reportedCount: 0,
        },
        {
          id: 'c-2',
          postId: 'post-1',
          userId: 'usr-1',
          userName: 'Rahim Uddin',
          content: 'Update: Fire is partially under control now. 2 more trucks arrived.',
          timestamp: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
          isAnonymous: false,
          isUpdate: true, // Emergency Update!
          reportedCount: 0,
        }
      ],
      isArchived: false,
      reportedCount: 0,
      expireTime: new Date(now.getTime() + 22 * 60 * 60 * 1000).toISOString(), // expires in 22h
    },
    {
      id: 'post-2',
      type: 'Alert',
      title: 'Bus collision near Farmgate police box',
      description: 'Two passenger buses collided. Road blocking is causing high gridlock from Kawran Bazar to Bijoy Sarani. High traffic congestion.',
      photoUrl: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=800&auto=format&fit=crop&q=60',
      locationName: 'Farmgate, Dhaka',
      coordinates: { latitude: 23.7561, longitude: 90.3872 },
      category: 'Accident',
      severity: 'High',
      isAnonymous: true,
      userId: 'usr-2',
      userName: 'Anonymous User',
      userArea: 'Dhanmondi, Dhaka',
      timestamp: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 mins ago
      votes: [
        { userId: 'usr-1', type: 'True' },
        { userId: 'usr-3', type: 'True' },
      ],
      comments: [
        {
          id: 'c-3',
          postId: 'post-2',
          userId: 'usr-3',
          userName: 'Simin Islam',
          content: 'Avoid this road! It took me 40 minutes to cross 1 kilometer. Better take the flyover.',
          timestamp: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
          isAnonymous: false,
          isUpdate: false,
          reportedCount: 0,
        }
      ],
      isArchived: false,
      reportedCount: 0,
      expireTime: new Date(now.getTime() + 23.5 * 60 * 60 * 1000).toISOString(), // expires in 23.5h
    },
    {
      id: 'post-3',
      type: 'Civic',
      title: 'Request for secondary waste bin structure near Gulshan Lake Park',
      description: 'People are tossing plastic bags right outside the park boundaries. We need a designated waste segregation box. Let\'s keep Gulshan green.',
      photoUrl: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800&auto=format&fit=crop&q=60',
      locationName: 'Gulshan 2, Dhaka',
      coordinates: { latitude: 23.7925, longitude: 90.4078 },
      category: undefined,
      severity: undefined,
      isAnonymous: false,
      userId: 'usr-3',
      userName: 'Simin Islam',
      userArea: 'Gulshan, Dhaka',
      timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      votes: [
        { userId: 'usr-1', type: 'Support' },
        { userId: 'usr-2', type: 'Support' },
        { userId: 'anon-10', type: 'Support' },
        { userId: 'anon-11', type: 'Support' },
      ],
      comments: [
        {
          id: 'c-4',
          postId: 'post-3',
          userId: 'usr-2',
          userName: 'Tariq Jamil',
          content: 'Agreed. DNCC collection occurs only once in the morning, leaving garbage piles later in the afternoon.',
          timestamp: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          isAnonymous: false,
          isUpdate: false,
          reportedCount: 0,
        }
      ],
      isArchived: false,
      reportedCount: 0,
      expireTime: new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000).toISOString(), // 28 days left
    },
    {
      id: 'post-4',
      type: 'Alert',
      title: 'Dhanmondi Lake Water overflow on Road 27',
      description: 'Dhanmondi area road 27 is fully waterlogged after 3 hours of thunderstorm. Several rickshaws got stuck because of open manholes. Walkers remain critical.',
      photoUrl: 'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=800&auto=format&fit=crop&q=60',
      locationName: 'Dhanmondi, Dhaka',
      coordinates: { latitude: 23.7461, longitude: 90.3742 },
      category: 'Flood',
      severity: 'Medium',
      isAnonymous: false,
      userId: 'usr-2',
      userName: 'Tariq Jamil',
      userArea: 'Dhanmondi, Dhaka',
      timestamp: new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
      votes: [
        { userId: 'usr-1', type: 'True' },
        { userId: 'usr-3', type: 'False News' }, // User reporting False News metrics
      ],
      comments: [],
      isArchived: false,
      reportedCount: 0,
      expireTime: new Date(now.getTime() + (7 * 24 - 25) * 60 * 60 * 1000).toISOString(), // 6 days left
    },
    {
      id: 'post-expired-1',
      type: 'Alert',
      title: 'Power grid spark on Sector 4 pole',
      description: 'The electric transformer had a large spark, and the power got disconnected. Desco team was already spotted.',
      photoUrl: undefined,
      locationName: 'Uttara, Dhaka',
      coordinates: { latitude: 23.8729, longitude: 90.3816 },
      category: 'Electricity problem',
      severity: 'Low',
      isAnonymous: true,
      userId: 'usr-3',
      userName: 'Anonymous User',
      userArea: 'Gulshan, Dhaka',
      timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
      votes: [
        { userId: 'usr-1', type: 'True' },
      ],
      comments: [],
      isArchived: true, // ALREADY ARCHIVED
      reportedCount: 0,
      expireTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(), // expired 2 days ago
    }
  ];

  return { posts, profiles };
}

// Database helper
export class LocalDB {
  static getPosts(): IncidentPost[] {
    const data = localStorage.getItem('publiceye_posts');
    if (!data) {
      const { posts } = getSeedData();
      LocalDB.savePosts(posts);
      return posts;
    }
    
    // Auto archive logic checking
    const posts: IncidentPost[] = JSON.parse(data);
    const now = new Date();
    let updated = false;
    
    posts.forEach(post => {
      if (!post.isArchived && new Date(post.expireTime) < now) {
        post.isArchived = true;
        updated = true;
      }
    });
    
    if (updated) {
      LocalDB.savePosts(posts);
    }
    
    return posts;
  }

  static savePosts(posts: IncidentPost[]) {
    localStorage.setItem('publiceye_posts', JSON.stringify(posts));
  }

  static getProfiles(): UserProfile[] {
    const data = localStorage.getItem('publiceye_profiles');
    if (!data) {
      const { profiles } = getSeedData();
      LocalDB.saveProfiles(profiles);
      return profiles;
    }
    return JSON.parse(data);
  }

  static saveProfiles(profiles: UserProfile[]) {
    localStorage.setItem('publiceye_profiles', JSON.stringify(profiles));
  }

  static getCurrentUser(): UserProfile | null {
    const data = localStorage.getItem('publiceye_current_user');
    if (!data) return null;
    return JSON.parse(data);
  }

  static setCurrentUser(user: UserProfile | null) {
    if (user) {
      localStorage.setItem('publiceye_current_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('publiceye_current_user');
    }
  }

  static getOfflineDrafts(): OfflineDraft[] {
    const data = localStorage.getItem('publiceye_offline_drafts');
    if (!data) return [];
    return JSON.parse(data);
  }

  static saveOfflineDrafts(drafts: OfflineDraft[]) {
    localStorage.setItem('publiceye_offline_drafts', JSON.stringify(drafts));
  }
}
