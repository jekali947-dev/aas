// Address Service - Geoapify Autocomplete API integration
// The UI calls searchAddress() and doesn't need to know the implementation details

export interface AddressSuggestion {
  id: string
  name: string
  fullAddress: string
  placeId?: string
  coordinates?: {
    lat: number
    lng: number
  }
}

const GEOAPIFY_BASE_URL = "https://api.geoapify.com/v1/geocode/autocomplete"
const GEOAPIFY_API_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY || process.env.NEXT_PUBLIC_GEOAPIFY_KEY
export const isAddressSearchConfigured = Boolean(GEOAPIFY_API_KEY)

export async function reverseGeocode(lat: number, lng: number): Promise<AddressSuggestion | null> {
  if (!GEOAPIFY_API_KEY) return null
  try {
    const response = await fetch(`${GEOAPIFY_BASE_URL.replace("autocomplete", "reverse")}?lat=${lat}&lon=${lng}&format=json&apiKey=${GEOAPIFY_API_KEY}`)
    if (!response.ok) return null
    const result = (await response.json()).results?.[0]
    if (!result) return null
    return { id: result.place_id || `${lat},${lng}`, name: result.address_line1 || result.formatted || "", fullAddress: result.formatted || "", coordinates: { lat, lng } }
  } catch { return null }
}

// ============================================
// EXPORTED FUNCTION - UI CALLS THIS
// ============================================
export async function searchAddress(query: string): Promise<AddressSuggestion[]> {
  if (!query || query.length < 3) {
    return []
  }

  if (!GEOAPIFY_API_KEY) {
    console.error("Address search error: NEXT_PUBLIC_GEOAPIFY_API_KEY is not set")
    return []
  }

  try {
    const url = `${GEOAPIFY_BASE_URL}?text=${encodeURIComponent(query)}&apiKey=${GEOAPIFY_API_KEY}&limit=5&filter=countrycode:zm&format=json`
    const response = await fetch(url)

    if (!response.ok) {
      console.error("Address search error: Geoapify request failed", response.status)
      return []
    }

    const data = await response.json()
    const results: unknown[] = Array.isArray(data.results) ? data.results : []

    return results.map((raw, index) => {
      const result = raw as {
        place_id?: string
        address_line1?: string
        formatted?: string
        lat?: number
        lon?: number
      }
      return {
        id: result.place_id || index.toString(),
        placeId: result.place_id,
        name: result.address_line1 || result.formatted || "",
        fullAddress: result.formatted || "",
        coordinates: {
          lat: result.lat ?? 0,
          lng: result.lon ?? 0,
        },
      }
    })
  } catch (error) {
    console.error("Address search error:", error)
    return []
  }
}
