// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// 1. Tentukan halaman mana saja yang BERSIFAT TERPROTEKSI (Wajib Login)
const isProtectedRoute = createRouteMatcher([
  "/portfolio(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  // 2. Jika user mencoba mengakses halaman terproteksi saat belum login, tendang ke login page
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Jalankan middleware untuk semua route, kecuali file statis (images, css, dll)
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Jalankan middleware untuk API dan TRPC routes
    '/(api|trpc)(.*)',
  ],
};