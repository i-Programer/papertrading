// src/types/window.d.ts
export {};

declare global {
  interface Window {
    Clerk?: {
      user?: {
        id: string;
      };
    };
  }
}