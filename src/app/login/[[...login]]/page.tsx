// src/app/login/[[...login]]/page.tsx
"use client";

import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#131722] flex items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col items-center">
        <h1 className="text-white text-xl font-bold mb-6 tracking-wide">
          Masuk ke PaperTrade Terminal
        </h1>
        
        {/* Tambahkan properti path agar Clerk tahu rute dasarnya */}
        <SignIn 
          path="/login"
          appearance={{
            variables: {
              colorPrimary: "#575e70",
              colorBackground: "#3f4b7a",
              colorInputBackground: "#8894b6",
              colorText: "#d1d4dc",
              colorTextSecondary: "#787b86",
            }
          }} 
        />
      </div>
    </div>
  );
}