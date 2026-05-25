import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Haversine formula to compute great-circle distance between two coordinates in meters
export function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
}

// Expire hours mapping based on category as requested
export function getCategoryExpiryHours(category: string): number {
  const norm = category.toLowerCase();
  
  if (norm.includes('fire')) return 24;
  if (norm.includes('accident')) return 24;
  if (norm.includes('gas leak') || norm.includes('gas')) return 24;
  
  if (norm.includes('storm')) return 3 * 24; // 3 days
  if (norm.includes('electricity') || norm.includes('power')) return 3 * 24; // 3 days
  
  if (norm.includes('flood')) return 7 * 24; // 7 days
  if (norm.includes('water')) return 7 * 24; // 7 days
  
  if (norm.includes('road')) return 30 * 24; // 30 days
  
  return 72; // Default 3 days for other categories
}

// OpenStreetMap Nominatim reverse geocoder to fetch Dhaka/Bangladesh area names
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
      {
        headers: {
          'User-Agent': 'PublicEye-Bangladesh-Community-Incident-Platform/1.0'
        }
      }
    );
    if (!response.ok) throw new Error("OSM reverse request failed");
    
    const data = await response.json();
    if (data.address) {
      const address = data.address;
      const sub = address.suburb || address.neighbourhood || address.residential || address.village || address.city_district || "";
      const city = address.city || address.town || address.state || "";
      
      const parts = [sub, city].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : data.display_name || "Unknown Area, Bangladesh";
    }
    return data.display_name || "Unknown Area, Bangladesh";
  } catch (err) {
    console.error("Nominatim Reverse Geocoding Error:", err);
    return "Dhaka, Bangladesh";
  }
}

// Interfaces for local drafts
export interface OfflinePost {
  id: string;
  title: string;
  description: string;
  type: 'alert' | 'civic';
  category?: string;
  severity?: 'low' | 'medium' | 'high';
  isAnonymous: boolean;
  latitude: number;
  longitude: number;
  locationName: string;
  createdAtStr: string;
  localImageBase64?: string; // Cache base64 locally if uploaded offline
}

// Offline drafts localStorage controller
export const offlineDrafts = {
  getDrafts(): OfflinePost[] {
    if (typeof window === 'undefined') return [];
    const drafts = localStorage.getItem('publiceye_offline_drafts');
    return drafts ? JSON.parse(drafts) : [];
  },

  saveDraft(post: Omit<OfflinePost, 'id' | 'createdAtStr'> & { id?: string }) {
    if (typeof window === 'undefined') return;
    const drafts = this.getDrafts();
    const newDraft: OfflinePost = {
      ...post,
      id: post.id || `draft_${Math.random().toString(36).substring(2, 9)}`,
      createdAtStr: new Date().toISOString()
    };
    drafts.push(newDraft);
    localStorage.setItem('publiceye_offline_drafts', JSON.stringify(drafts));
  },

  removeDraft(id: string) {
    if (typeof window === 'undefined') return;
    const drafts = this.getDrafts().filter(d => d.id !== id);
    localStorage.setItem('publiceye_offline_drafts', JSON.stringify(drafts));
  },

  clear() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('publiceye_offline_drafts');
  }
};
