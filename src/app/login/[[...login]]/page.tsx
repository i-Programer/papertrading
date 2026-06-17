// src/app/login/[[...login]]/page.tsx
"use client";

import Topbar from "@/components/Topbar";
import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <Topbar />
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Card container - pakai background solid biar teksnya jelas */}
          <div className="bg-slate-800/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border border-slate-700">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h1 className="text-white text-2xl font-bold tracking-tight">
                PaperTrade Terminal
              </h1>
              <p className="text-slate-400 text-sm mt-2">
                Masuk untuk melanjutkan trading
              </p>
            </div>

            <SignIn
              path="/login"
              appearance={{
                variables: {
                  colorPrimary: "#3b82f6",        
                  colorPrimaryForeground: "#ffffff", 
                  
                  colorBackground: "#1e293b",     
                  colorForeground: "#f1f5f9",     
                  colorMutedForeground: "#94a3b8", 
                  
                  colorInput: "#0f172a",          
                  colorInputForeground: "#f1f5f9", 
                  
                  colorBorder: "#334155",         
                  colorDanger: "#ef4444",         
                  borderRadius: "0.5rem",         
                },
                elements: {
                  card: "shadow-none",             
                  header: "hidden",                
                  formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5",
                  formFieldInput: "border border-slate-700 focus:ring-2 focus:ring-blue-500",
                  formFieldLabel: "text-slate-300 font-medium",
                  footerActionLink: "text-blue-400 hover:text-blue-300",
                  socialButtonsBlockButton: "bg-slate-700 hover:bg-slate-600 text-white border border-slate-600",
                  dividerLine: "bg-slate-700",
                  dividerText: "text-slate-500",
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}