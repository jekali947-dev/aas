"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronLeft, Upload, MapPin, Phone, Loader2 } from "lucide-react"
import { isAddressSearchConfigured, reverseGeocode, searchAddress, type AddressSuggestion } from "@/lib/address-service"
import { doc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { uploadStoreLogo } from "@/lib/cloudinary"
import type { StoreInfo } from "@/lib/store-data"

interface StoreInfoPageProps {
  storeInfo: StoreInfo
  storeId: string
  onBack: () => void
  onSave: (info: StoreInfo) => void
}

export function StoreInfoPage({ storeInfo, storeId, onBack, onSave }: StoreInfoPageProps) {
  const [logo, setLogo] = useState(storeInfo.logo || "")
  const [name, setName] = useState(storeInfo.name || "")
  const [address, setAddress] = useState(storeInfo.address || "")
  const [addressCoords, setAddressCoords] = useState(storeInfo.storeLocation || null)
  const [addressPlaceId, setAddressPlaceId] = useState<string | null>(null)
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([])
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false)
  const [isAddressFocused, setIsAddressFocused] = useState(false)
  const [isSearchingAddress, setIsSearchingAddress] = useState(false)
  const [addressMessage, setAddressMessage] = useState<string | null>(null)
  const [phone, setPhone] = useState(storeInfo.phone || "")
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isAddressFocused) {
      setAddressSuggestions([])
      setShowAddressSuggestions(false)
      setAddressMessage(null)
      return
    }

    setShowAddressSuggestions(true)
    const query = address.trim()
    if (query.length < 3) {
      setAddressSuggestions([])
      setIsSearchingAddress(false)
      setAddressMessage(isAddressSearchConfigured ? null : "Address suggestions are unavailable right now, you can still type your address")
      return
    }
    if (!isAddressSearchConfigured) {
      setIsSearchingAddress(false)
      setAddressMessage("Address suggestions are unavailable right now, you can still type your address")
      return
    }

    setIsSearchingAddress(true)
    setAddressMessage(null)
    const timer = window.setTimeout(async () => {
      const results = await searchAddress(query)
      setAddressSuggestions(results)
      setIsSearchingAddress(false)
      setAddressMessage(results.length === 0 ? "No results" : null)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [address, isAddressFocused])

  const handleAddressSearch = (value: string) => {
    setAddress(value)
    setAddressCoords(null)
    setAddressPlaceId(null)
  }

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setAddressMessage("Location is not available in this browser. You can still type your address")
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
      setAddressMessage(positionError.code === 1 ? "Location permission was denied. You can still type your address" : positionError.code === 3 ? "Location request timed out. You can still type your address" : "We could not access your location. You can still type your address")
    }, { enableHighAccuracy: true, timeout: 10000 })
  }

  const handleSelectAddress = (suggestion: AddressSuggestion) => {
    setAddress(suggestion.fullAddress)
    setAddressCoords(suggestion.coordinates || null)
    setAddressPlaceId(suggestion.placeId || suggestion.id)
    setShowAddressSuggestions(false)
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
      // Show preview immediately
      const reader = new FileReader()
      reader.onload = (event) => {
        setLogo(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    setError(null)
    setIsSaving(true)

    try {
      let logoUrl = logo

      // Upload logo to Cloudinary if a new file was selected
      if (logoFile) {
        setIsUploading(true)
        try {
          logoUrl = await uploadStoreLogo(logoFile, storeId)
        } catch (uploadError) {
          setError("Failed to upload logo. Please try again.")
          setIsSaving(false)
          setIsUploading(false)
          return
        }
        setIsUploading(false)
      }

      // Save to Firestore
      await setDoc(doc(db, "stores", storeId), {
        logo: logoUrl,
        storeName: name.trim(),
        address: address.trim(),
        location: addressCoords ? { latitude: addressCoords.lat, longitude: addressCoords.lng } : null,
        addressPlaceId: addressPlaceId || null,
        phone: phone.trim(),
      }, { merge: true })

      onSave({
        logo: logoUrl,
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        storeLocation: addressCoords,
      })
    } catch (err) {
      console.error("Error saving store info:", err)
      setError("Failed to save store information. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Fixed Header */}
      <div className="bg-card px-4 pt-5 pb-4 shrink-0 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-card-foreground transition-colors hover:text-primary"
              aria-label="Go back"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold text-card-foreground">Store Information</h1>
          </div>
        </div>
      </div>

      {/* Scrollable Form Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hide">
        <div className="flex flex-col gap-6">
          {/* Error Message */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/50 rounded-xl p-3 text-destructive text-sm text-center">
              {error}
            </div>
          )}

          {/* Logo Upload */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isSaving}
              className="w-36 h-36 border-2 border-dashed border-border rounded-full flex flex-col items-center justify-center gap-2 bg-card hover:bg-accent/50 transition-colors overflow-hidden relative disabled:cursor-not-allowed"
            >
              {isUploading && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              )}
              {logo ? (
                <img
                  src={logo}
                  alt="Store logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  <span className="text-xs text-muted-foreground">Upload Logo</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
          </div>

          {/* Store Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Store Name
            </label>
            <input
              type="text"
              placeholder="Enter store name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-card border border-border rounded-xl text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {/* Address */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Address
            </label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Enter store address"
                value={address}
                onChange={(e) => handleAddressSearch(e.target.value)}
  onFocus={() => setIsAddressFocused(true)}
  onBlur={() => setTimeout(() => setIsAddressFocused(false), 200)}
                className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-xl text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
  />
  {(isSearchingAddress || addressMessage) && <p className="mt-1 text-xs text-muted-foreground">{isSearchingAddress ? "Searching…" : addressMessage}</p>}
  {showAddressSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-30 max-h-56 overflow-y-auto bg-card border border-border shadow-lg">
                  <button
                    type="button"
                    onPointerDown={(event) => { event.preventDefault(); handleUseCurrentLocation() }}
                    className="w-full text-left px-4 py-2 text-sm font-medium text-card-foreground hover:bg-accent transition-colors"
                  >
                    Use my current location
                  </button>
                  {addressSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onPointerDown={(event) => { event.preventDefault(); handleSelectAddress(suggestion) }}
                      className="w-full text-left px-4 py-2 text-sm text-card-foreground hover:bg-accent transition-colors"
                    >
                      <div className="font-medium">{suggestion.name}</div>
                      <div className="text-xs text-muted-foreground">{suggestion.fullAddress}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Phone Number */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="tel"
                placeholder="Enter phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-xl text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving || isUploading}
            className="w-full bg-primary text-primary-foreground rounded-xl py-4 font-semibold transition-all duration-200 active:scale-[0.98] hover:bg-primary/90 mt-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving || isUploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isUploading ? "Uploading..." : "Saving..."}
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
