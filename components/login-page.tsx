"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Mail, Lock, Bike } from "lucide-react"
import { signInWithEmailAndPassword } from "firebase/auth"
import { auth } from "@/lib/firebase"

interface LoginPageProps {
  onLoginSuccess: () => void
  onSignUp: () => void
}

export function LoginPage({ onLoginSuccess, onSignUp }: LoginPageProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    videoRef.current?.play().catch(() => {})
  }, [])

  const handleSignIn = useCallback(async () => {
    if (!email || !password) {
      setError("Please enter both email and password")
      return
    }

    setError(null)
    setIsLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email, password)
      onLoginSuccess()
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("user-not-found")) {
          setError("No account found with this email")
        } else if (err.message.includes("wrong-password") || err.message.includes("invalid-credential")) {
          setError("Incorrect password")
        } else if (err.message.includes("invalid-email")) {
          setError("Invalid email address")
        } else if (err.message.includes("too-many-requests")) {
          setError("Too many attempts. Please try again later")
        } else {
          setError("Login failed. Please try again.")
        }
      } else {
        setError("An error occurred. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }, [email, password, onLoginSuccess])

  const isFormValid = email.length > 0 && password.length > 0

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-black">
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
        {/* Glass Card - dark blue with subtle blur */}
        <div 
          className="w-full max-w-sm rounded-3xl p-6 shadow-2xl"
          style={{
            background: "rgba(255, 255, 255, 0.14)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            border: "1px solid rgba(255, 255, 255, 0.25)",
          }}
        >
          <div className="space-y-5">
            {/* Delivery Icon */}
            <div className="flex justify-center">
              <div className="p-3 rounded-full bg-white/10">
                <Bike className="w-10 h-10 text-white" />
              </div>
            </div>

            {/* Header */}
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white">Welcome Back</h1>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-white text-sm text-center">
                {error}
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-white/90 text-sm font-medium">
                <Mail className="w-4 h-4" />
                Email Address
              </label>
              <div 
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                }}
              >
                <Mail className="w-5 h-5 text-white/50" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-transparent text-white placeholder:text-white/50 outline-none"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-white/90 text-sm font-medium">
                <Lock className="w-4 h-4" />
                Password
              </label>
              <div 
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                }}
              >
                <Lock className="w-5 h-5 text-white/50" />
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 bg-transparent text-white placeholder:text-white/50 outline-none"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Forgot Password */}
            <div className="text-right">
              <button className="text-white/70 text-sm hover:text-white transition-colors">
                Forgot Password?
              </button>
            </div>

            {/* Sign In Button */}
            <button
              onClick={handleSignIn}
              disabled={!isFormValid || isLoading}
              className="w-full py-3.5 rounded-full font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              style={{
                background: isFormValid && !isLoading
                  ? "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
                  : "rgba(59, 130, 246, 0.5)",
                boxShadow: isFormValid && !isLoading ? "0 4px 15px rgba(59, 130, 246, 0.4)" : "none",
              }}
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </button>

            {/* Sign Up Link */}
            <div className="text-center">
              <span className="text-white/60 text-sm">{"Don't have an account? "}</span>
              <button 
                onClick={onSignUp}
                className="text-white font-semibold text-sm hover:underline"
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
