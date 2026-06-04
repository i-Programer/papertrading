// src/app/register/[[...register]]/page.tsx
"use client";

import Topbar from "@/components/Topbar";
import { SignUp } from "@clerk/nextjs";

export default function RegisterPage() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <Topbar />
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Card container - consistent with login page */}
          <div className="bg-slate-800/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-slate-700">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <h1 className="text-white text-2xl font-bold tracking-tight">
                PaperTrade Terminal
              </h1>
              <p className="text-slate-400 text-sm mt-2">
                Create a new account to start trading
              </p>
            </div>

            <SignUp
              path="/register"
              appearance={{
                variables: {
                  // New properties (non-deprecated)
                  colorPrimary: "#3b82f6",        // Blue color for buttons
                  colorPrimaryForeground: "#ffffff", // Button text color
                  
                  colorBackground: "#1e293b",     // Card background (slate-800)
                  colorForeground: "#f1f5f9",     // Primary text color (white)
                  colorMutedForeground: "#94a3b8", // Secondary text color (light gray)
                  
                  colorInput: "#0f172a",          // Input background (slate-900)
                  colorInputForeground: "#f1f5f9", // Input text color (white)
                  
                  colorBorder: "#334155",         // Border color (slate-700)
                  colorDanger: "#ef4444",         // Error message color
                  colorSuccess: "#10b981",        // Success message color
                  borderRadius: "0.5rem",         // Border radius
                },
                elements: {
                  card: "shadow-none",             // Remove default shadow
                  header: "hidden",                // Hide default header
                  formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02]",
                  formFieldInput: "bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200",
                  formFieldLabel: "text-slate-300 font-medium mb-2",
                  footerActionLink: "text-blue-400 hover:text-blue-300 transition-colors duration-200",
                  socialButtonsBlockButton: "bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 rounded-xl transition-all duration-200",
                  dividerLine: "bg-slate-700",
                  dividerText: "text-slate-500",
                  form: "space-y-5",
                  rootBox: "w-full",
                },
                layout: {
                  socialButtonsPlacement: "bottom",
                  socialButtonsVariant: "blockButton",
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}