"use client"

import { useEffect, useRef } from "react"

interface WelcomePageProps {
  onSignIn: () => void
  onSignUp: () => void
}

export function WelcomePage({ onSignIn, onSignUp }: WelcomePageProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    videoRef.current?.play().catch(() => {})
  }, [])

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-black">
      {/* Background Video - warm rainy street scene */}
      <video
        ref={videoRef}
        src="/videos/bike_droplets.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        onError={(event) => console.warn("Background video failed to load", event.currentTarget.src)}
        className="absolute inset-0 z-0 size-full object-cover object-center"
      />

      {/* Content Container */}
      <div className="relative z-10 min-h-dvh flex items-center justify-center p-4">
        {/* Glass Card - warm tone with subtle blur */}
        <div 
          className="w-full max-w-sm rounded-3xl p-8 shadow-2xl"
          style={{
            background: "rgba(255, 255, 255, 0.14)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            border: "1px solid rgba(255, 255, 255, 0.25)",
          }}
        >
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white drop-shadow-lg">Welcome to</h1>
              <h2 className="text-3xl font-bold text-white drop-shadow-lg">Store Delivery Dashboard</h2>
              <p className="text-white/80 text-sm mt-2">Manage your deliveries with ease</p>
            </div>

            {/* Buttons */}
            <div className="space-y-3 pt-4">
              {/* Sign In Button - with gradient */}
              <button
                onClick={onSignIn}
                className="w-full py-4 rounded-xl font-semibold text-[#4a3728] transition-all duration-200 active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, rgba(255, 220, 180, 0.9) 0%, rgba(255, 200, 150, 0.85) 100%)",
                  border: "1px solid rgba(255, 255, 255, 0.4)",
                  boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
                }}
              >
                Sign In
              </button>

              {/* Sign Up Button - lighter with border */}
              <button
                onClick={onSignUp}
                className="w-full py-4 rounded-xl font-semibold text-[#4a3728] transition-all duration-200 active:scale-[0.98]"
                style={{
                  background: "rgba(255, 255, 255, 0.3)",
                  border: "1px solid rgba(255, 255, 255, 0.5)",
                  boxShadow: "0 4px 15px rgba(0, 0, 0, 0.05)",
                }}
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
