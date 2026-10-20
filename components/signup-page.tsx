"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Mail, Lock, Phone, Search, ChevronLeft, User, Store, MapPin } from "lucide-react"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { isAddressSearchConfigured, reverseGeocode, searchAddress, type AddressSuggestion } from "@/lib/address-service"
interface SignupPageProps {
  onSignupSuccess: (userData: {
    uid: string
    firstName: string
    surname: string
    storeName: string
    phone: string
    email: string
    address: string
    category: string
  }) => void
  onSignIn: () => void
}

function capitalizeWords(value: string): string {
  return value.split(" ").map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ")
}

const storeCategories = [
  { value: "food", label: "Food" },
  { value: "clothes", label: "Clothes" },
  { value: "hardware", label: "Hardware" },
  { value: "small_shop", label: "Small Shops" },
  { value: "market", label: "Soweto Market" },
]

export function SignupPage({ onSignupSuccess, onSignIn }: SignupPageProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1 fields
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Step 2 fields
  const [firstName, setFirstName] = useState("")
  const [surname, setSurname] = useState("")
  const [storeName, setStoreName] = useState("")
  const [category, setCategory] = useState("")
  const [address, setAddress] = useState("")
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([])
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false)
  const [isAddressFocused, setIsAddressFocused] = useState(false)
  const [isSearchingAddress, setIsSearchingAddress] = useState(false)
  const [addressSearchMessage, setAddressSearchMessage] = useState<string | null>(null)

  // Validation functions
  const validatePhone = useCallback((value: string) => {
    // Must be exactly 10 digits after +26
    return /^\d{10}$/.test(value)
  }, [])

  const validateEmail = useCallback((value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  }, [])

  const validatePassword = useCallback((value: string) => {
    // Min 8 chars, at least one uppercase, one lowercase
    return value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value)
  }, [])

  const validateStep1 = useCallback(() => {
    if (!validatePhone(phone)) {
      setError("Phone number must be exactly 10 digits")
      return false
    }
    if (!validateEmail(email)) {
      setError("Please enter a valid email address")
      return false
    }
    if (!validatePassword(password)) {
      setError("Password must be at least 8 characters with uppercase and lowercase letters")
      return false
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return false
    }
    return true
  }, [phone, email, password, confirmPassword, validatePhone, validateEmail, validatePassword])

  const isStep1Valid = validatePhone(phone) && validateEmail(email) && validatePassword(password) && password === confirmPassword

  const validateStep2 = useCallback(() => {
    if (firstName.length < 3) {
      setError("First name must be at least 3 characters")
      return false
    }
    if (surname.length < 3) {
      setError("Surname must be at least 3 characters")
      return false
    }
    if (storeName.length < 3) {
      setError("Store name must be at least 3 characters")
      return false
    }
    if (!category) {
      setError("Please select a store category")
      return false
    }
    if (!address) {
      setError("Please enter a store address")
      return false
    }
    return true
  }, [firstName, surname, storeName, category, address])

  const isStep2Valid = firstName.length >= 3 && surname.length >= 3 && storeName.length >= 3 && category.length > 0 && address.length > 0

  const handleContinue = useCallback(() => {
    setError(null)
    if (validateStep1()) {
      setStep(2)
    }
  }, [validateStep1])

  const handleBack = useCallback(() => {
    setError(null)
    setStep(1)
  }, [])

  useEffect(() => {
    if (!isAddressFocused) {
      setAddressSuggestions([])
      setShowAddressSuggestions(false)
      setAddressSearchMessage(null)
      return
    }

    setShowAddressSuggestions(true)
    const query = address.trim()
    if (query.length < 3) {
      setAddressSuggestions([])
      setIsSearchingAddress(false)
      setAddressSearchMessage(isAddressSearchConfigured ? null : "Address suggestions are unavailable right now, you can still type your address")
      return
    }
    if (!isAddressSearchConfigured) {
      setIsSearchingAddress(false)
      setAddressSearchMessage("Address suggestions are unavailable right now, you can still type your address")
      return
    }

    setIsSearchingAddress(true)
    setAddressSearchMessage(null)
    const timer = window.setTimeout(async () => {
      const results = await searchAddress(query)
      setAddressSuggestions(results)
      setIsSearchingAddress(false)
      setAddressSearchMessage(results.length === 0 ? "No matches, you can still type your address" : null)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [address, isAddressFocused])

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setAddressSearchMessage("Location is not available in this browser. You can still type your address")
      return
    }
    setIsSearchingAddress(true)
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const result = await reverseGeocode(coords.latitude, coords.longitude)
      setAddress(result?.fullAddress || `Pinned location (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`)
      setAddressCoords({ lat: coords.latitude, lng: coords.longitude })
      setIsSearchingAddress(false)
      setShowAddressSuggestions(false)
    }, (positionError) => {
      setIsSearchingAddress(false)
      setAddressSearchMessage(positionError.code === 1 ? "Location permission was denied. You can still type your address" : positionError.code === 3 ? "Location request timed out. You can still type your address" : "We could not access your location. You can still type your address")
    }, { enableHighAccuracy: true, timeout: 10000 })
  }, [])

  const handleAddressSearch = useCallback((query: string) => {
    setAddress(query)
    setAddressCoords(null)
  }, [])

  const handleSelectAddress = useCallback((suggestion: AddressSuggestion) => {
    setAddress(suggestion.fullAddress)
    setAddressCoords(suggestion.coordinates || null)
    setShowAddressSuggestions(false)
  }, [])

  const handleCreateAccount = useCallback(async () => {
    setError(null)
    if (!validateStep2()) return

    setIsLoading(true)

    const savedFirstName = capitalizeWords(firstName)
    const savedSurname = capitalizeWords(surname)
    const savedStoreName = capitalizeWords(storeName)

    try {
      // Create Firebase Auth account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const uid = userCredential.user.uid

      // Create Firestore document
      await setDoc(doc(db, "stores", uid), {
        firstName: savedFirstName,
        surname: savedSurname,
        storeName: savedStoreName,
        category,
        phone: `+26${phone}`,
        email,
        address,
        location: addressCoords ? {
          lat: addressCoords.lat,
          lng: addressCoords.lng,
        } : null,
        rating: 0,
        reviewCount: 0,
        createdAt: serverTimestamp(),
        // Future fields ready for expansion
        logo: "",
        openingHours: {
          monday: { open: "", close: "" },
          tuesday: { open: "", close: "" },
          wednesday: { open: "", close: "" },
          thursday: { open: "", close: "" },
          friday: { open: "", close: "" },
          saturday: { open: "", close: "" },
          sunday: { open: "", close: "" },
        },
        products: [],
        businessLicense: "",
        bankAccount: "",
      })

      // Success - pass user data to parent
      onSignupSuccess({
        uid,
        firstName: savedFirstName,
        surname: savedSurname,
        storeName: savedStoreName,
        phone: `+26${phone}`,
        email,
        address,
        category,
      })
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("email-already-in-use")) {
          setError("This email is already registered")
        } else if (err.message.includes("weak-password")) {
          setError("Password is too weak")
        } else {
          setError(err.message)
        }
      } else {
        setError("An error occurred. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }, [email, password, firstName, surname, storeName, category, phone, address, addressCoords, validateStep2, onSignupSuccess])

  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    videoRef.current?.play().catch(() => {})
  }, [])

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-black">
      {/* Background Video */}
      <video
        ref={videoRef}
        src="/videos/ale_droplets.mp4"
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
        {/* Glass Card - subtle blur to show water droplets */}
        <div
          className="w-full max-w-sm rounded-3xl p-6 shadow-2xl"
          style={{
            background: "rgba(255, 255, 255, 0.14)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            border: "1px solid rgba(255, 255, 255, 0.25)",
          }}
        >
          {step === 1 ? (
            /* Step 1 - Account Details */
            <div className="space-y-5">
              {/* Header */}
              <div className="text-center space-y-1">
                <h1 className="text-3xl font-bold text-white drop-shadow-lg">Welcome</h1>
                <p className="text-white/80 text-sm">Sign up to continue</p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-white text-sm text-center">
                  {error}
                </div>
              )}

              {/* Phone Field */}
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                }}
              >
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-lg">🇿🇲</span>
                  <span className="text-white font-medium">+26</span>
                  <div className="w-px h-5 bg-white/30" />
                </div>
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="flex-1 bg-transparent text-white placeholder:text-white/60 outline-none"
                />
              </div>

              {/* Email Field */}
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                }}
              >
                <Mail className="w-5 h-5 text-white/70" />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-transparent text-white placeholder:text-white/60 outline-none"
                />
              </div>

              {/* Password Field */}
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                }}
              >
                <Lock className="w-5 h-5 text-white/70" />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 bg-transparent text-white placeholder:text-white/60 outline-none"
                />
              </div>

              {/* Confirm Password Field */}
              <div
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                }}
              >
                <Lock className="w-5 h-5 text-white/70" />
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="flex-1 bg-transparent text-white placeholder:text-white/60 outline-none"
                />
              </div>

              {/* Continue Button */}
              <button
                onClick={handleContinue}
                disabled={!isStep1Valid}
                className="w-full py-3.5 rounded-xl font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: isStep1Valid
                    ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                    : "rgba(255, 255, 255, 0.2)",
                }}
              >
                Continue
              </button>

              {/* Sign In Link */}
              <div className="text-center pt-2">
                <span className="text-white/60 text-sm">Already have an account? </span>
                <button 
                  onClick={onSignIn}
                  className="text-white font-semibold text-sm hover:underline"
                >
                  Sign In
                </button>
              </div>
            </div>
          ) : (
            /* Step 2 - Store Information */
            <div className="space-y-4">
              {/* Header */}
              <div className="text-center space-y-1">
                <h1 className="text-2xl font-bold text-white drop-shadow-lg">Sign Up - Step 2</h1>
                <p className="text-white/80 text-sm">Complete your store details</p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-white text-sm text-center">
                  {error}
                </div>
              )}

              {/* First Name Field */}
              <div
                className="rounded-xl px-4 py-2"
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                }}
              >
                <label className="text-white/90 text-sm font-medium">First Name</label>
                <input
                  type="text"
                  placeholder="Enter your first name"
                  value={firstName}
                  onChange={(e) => setFirstName(capitalizeWords(e.target.value))}
                  className="w-full bg-transparent text-white placeholder:text-white/50 outline-none text-sm mt-1"
                />
              </div>

              {/* Surname Field */}
              <div
                className="rounded-xl px-4 py-2"
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                }}
              >
                <label className="text-white/90 text-sm font-medium">Surname</label>
                <input
                  type="text"
                  placeholder="Enter your surname"
                  value={surname}
                  onChange={(e) => setSurname(capitalizeWords(e.target.value))}
                  className="w-full bg-transparent text-white placeholder:text-white/50 outline-none text-sm mt-1"
                />
              </div>

              {/* Store Name Field */}
              <div
                className="rounded-xl px-4 py-2"
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                }}
              >
                <label className="text-white/90 text-sm font-medium">Store Name</label>
                <input
                  type="text"
                  placeholder="Enter your store name"
                  value={storeName}
                  onChange={(e) => setStoreName(capitalizeWords(e.target.value))}
                  className="w-full bg-transparent text-white placeholder:text-white/50 outline-none text-sm mt-1"
                />
              </div>

              {/* Store Category Field */}
              <div
                className="rounded-xl px-4 py-2"
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                }}
              >
                <label className="text-white/90 text-sm font-medium">Store Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-transparent text-white outline-none text-sm mt-1 appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 0 center",
                  }}
                >
                  <option value="" disabled className="text-gray-800">Select a category</option>
                  {storeCategories.map((cat) => (
                    <option key={cat.value} value={cat.value} className="text-gray-800">
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Store Address Field with Autocomplete */}
              <div className="relative">
                {isSearchingAddress && <p className="mb-1 text-xs text-muted-foreground">Searching addresses…</p>}
                <div
                  className="flex items-center gap-3 rounded-xl px-4 py-2"
                  style={{
                    background: "rgba(255, 255, 255, 0.2)",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
                  }}
                >
                  <div className="flex-1">
                    <label className="text-white/90 text-sm font-medium">Store Address</label>
                    <input
                      type="text"
                      placeholder="Search address..."
                      value={address}
                      onChange={(e) => handleAddressSearch(e.target.value)}
                      onFocus={() => setIsAddressFocused(true)}
                      onBlur={() => window.setTimeout(() => setIsAddressFocused(false), 200)}
                      className="w-full bg-transparent text-white placeholder:text-white/50 outline-none text-sm mt-1"
                    />
                  </div>
                  <Search className="w-5 h-5 text-white/70 shrink-0" />
                </div>

                {/* Address Suggestions Dropdown */}
                {addressSearchMessage && <p className="mt-1 text-xs text-muted-foreground">{addressSearchMessage}</p>}
                {showAddressSuggestions && (
                  <div
                    className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-30 max-h-56 overflow-y-auto"
                    style={{
                      background: "rgba(255, 255, 255, 0.95)",
                      border: "1px solid rgba(255, 255, 255, 0.5)",
                    }}
                  >
                    <button
                      type="button"
                      onPointerDown={(event) => { event.preventDefault(); handleUseCurrentLocation() }}
                      className="w-full text-left px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 transition-colors"
                    >
                      Use my current location
                    </button>
                    {addressSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onPointerDown={(event) => { event.preventDefault(); handleSelectAddress(suggestion) }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-800 hover:bg-gray-100 transition-colors"
                      >
                        <div className="font-medium">{suggestion.name}</div>
                        <div className="text-xs text-gray-500">{suggestion.fullAddress}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleBack}
                  className="flex-1 py-3 rounded-xl font-semibold text-white/90 transition-all duration-200"
                  style={{
                    background: "rgba(255, 255, 255, 0.25)",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleCreateAccount}
                  disabled={!isStep2Valid || isLoading}
                  className="flex-1 py-3 rounded-xl font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: isStep2Valid && !isLoading
                      ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                      : "rgba(255, 255, 255, 0.2)",
                  }}
                >
                  {isLoading ? "Creating..." : "Create Account"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
