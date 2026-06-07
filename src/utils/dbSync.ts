// src/utils/dbSync.ts
import { profileService } from "@/services/profileService";
import { useTradingStore } from "@/stores/useTradingStore";

export async function syncUserProfileToDB(clerkId: string, name: string, email: string) {
  try {
    await profileService.syncUserProfile(clerkId, name, email);
    console.log("Profile synced successfully");
  } catch (error) {
    console.error("Failed to sync profile:", error);
  }
}

export async function fetchUserPortfolioFromDB(clerkId: string) {
  try {
    const data = await profileService.fetchUserProfile(clerkId);
    return {
      cash: data.balance.cash,
      equity: data.balance.equity,
      positions: data.positions,
      tradeHistory: data.tradeHistory,
    };
  } catch (error) {
    console.error("Failed to fetch portfolio:", error);
    return {
      cash: 100000,
      equity: 100000,
      positions: [],
      tradeHistory: [],
    };
  }
}