// src/types/window.d.ts
export {};

declare global {
  interface Window {
    Clerk?: {
      user?: {
        id: string;
        fullName?: string;
        primaryEmailAddress?: {
          emailAddress: string;
        };
      };
      open?: (options?: { afterSignInUrl?: string; afterSignUpUrl?: string }) => void;
    };
  }
}