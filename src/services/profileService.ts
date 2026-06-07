// src/services/profileService.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface UserProfileData {
  profile: {
    id: string;
    name: string;
    email: string;
    cash: number;
    equity: number;
  } | null;
  balance: {
    cash: number;
    equity: number;
  };
  positions: any[];
  tradeHistory: any[];
}

export const profileService = {
  async fetchUserProfile(userId: string): Promise<UserProfileData> {
    const response = await fetch(`${API_BASE}/api/profile`, {
      headers: {
        "X-Clerk-User-Id": userId,
      },
    });
    
    if (!response.ok) {
      throw new Error("Failed to fetch profile");
    }
    
    return await response.json();
  },
  
  async syncUserProfile(userId: string, name: string, email: string): Promise<void> {
    const response = await fetch(`${API_BASE}/api/profile/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Clerk-User-Id": userId,
      },
      body: JSON.stringify({ name, email }),
    });
    
    if (!response.ok) {
      throw new Error("Failed to sync profile");
    }
  },
};