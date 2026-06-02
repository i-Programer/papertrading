// src/app/register/[[...register]]/page.tsx
"use client";

import { SignUp } from "@clerk/nextjs";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-[#131722] flex items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col items-center">
        <h1 className="text-white text-xl font-bold mb-6 tracking-wide">
          Daftar Akun PaperTrade Terminal
        </h1>
        
        {/* Menggunakan komponen SignUp bawaan Clerk */}
        <SignUp 
          path="/register"
          appearance={{
            variables: {
              colorPrimary: "#575e70",
              colorBackground: "#3f4b7a",
              colorInputBackground: "#8894b6",
              colorText: "#d1d4dc",
              colorTextSecondary: "#ffffff",
            }
          }} 
        />
      </div>
    </div>
  );
}