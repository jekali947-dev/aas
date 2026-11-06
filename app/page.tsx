"use client"

import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { onAuthStateChanged, signOut, type User } from "firebase/auth"
import { doc, collection, getDocs, deleteDoc, onSnapshot, type DocumentSnapshot } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { WelcomePage } from "@/components/welcome-page"
import { LoginPage } from "@/components/login-page"
import { SignupPage } from "@/components/signup-page"
import { DashboardPage } from "@/components/dashboard-page"
import { OrdersPage } from "@/components/orders-page"
import { NotificationsPage } from "@/components/notifications-page"
import { SettingsPage } from "@/components/settings-page"
import { ProductsPage } from "@/components/products-page"
import { AddProductPage } from "@/components/add-product-page"
import { OpeningHoursPage } from "@/components/opening-hours-page"
import { StoreInfoPage } from "@/components/store-info-page"
import { PendingOrdersPage } from "@/components/pending-orders-page"
import { DriverAssignedPage } from "@/components/driver-assigned-page"
import { PaymentsPage } from "@/components/payments-page"
import { BottomNavigation } from "@/components/bottom-navigation"
import { OrderPopupPanel } from "@/components/order-popup-panel"
import { useRealtimeOrders } from "@/hooks/use-realtime-orders"
import { placeholderStoreData } from "@/lib/store-data"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import { CallProvider } from "@/contexts/call-context"
import { CallOverlay } from "@/components/call-overlay"
import { StoreCallButton } from "@/components/store-call-button"
import { NativeCallsBoot } from "@/components/native-calls-boot"
import { useBackGuard } from "@/hooks/use-back-guard"
import type { StoreData, Product, OpeningHour, StoreInfo } from "@/lib/store-data"

type AuthPage = "welcome" | "login" | "signup"

export default function MerchantApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [authPage, setAuthPage] = useState<AuthPage>("welcome")
  const [activePage, setActivePage] = useState("dashboard")
  const [storeData, setStoreData] = useState<StoreData>(placeholderStoreData)
  const [direction, setDirection] = useState<"left" | "right">("right")
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const storeListenerRef = useRef<(() => void) | null>(null)

  // Real-time orders from Firestore
  const {
    pendingOrders,
    acceptedOrders,
    completedOrders,
    allOrders,
    todayOrders,
    pendingOrderForPopup,
    dismissPopup,
    handleStatusUpdate,
    lastCancellation,
  } = useRealtimeOrders(currentUserId)
  const { toast } = useToast()
  const [popupHidden, setPopupHidden] = useState(false)
  useBackGuard(activePage, setActivePage, !popupHidden, () => setPopupHidden(false), isAuthenticated, Boolean(pendingOrderForPopup))

  useEffect(() => {
    if (!lastCancellation) return
    toast({
      title: `Order #${lastCancellation.orderId} was cancelled`,
      description: `The customer cancelled this order.${lastCancellation.reason ? ` Reason: ${lastCancellation.reason}` : ""}`,
      duration: 8000,
    })
    if (pendingOrderForPopup?.id === lastCancellation.id || pendingOrderForPopup?.orderId === lastCancellation.orderId) {
      dismissPopup()
    }
  }, [lastCancellation, pendingOrderForPopup, dismissPopup, toast])

  const pageOrder = ["dashboard", "orders", "notifications", "payments", "settings"]

  // Fetch store data from Firestore with retry logic
  const fetchStoreData = useCallback(async (uid: string, retryCount = 0) => {
    const MAX_RETRIES = 3
    const RETRY_DELAY = 2000

    try {
      const storeDoc = await new Promise<DocumentSnapshot>((resolve, reject) => {
        const listener = onSnapshot(
          doc(db, "stores", uid),
          (snapshot) => {
            resolve(snapshot)
          },
          reject,
        )
        storeListenerRef.current = listener
      })
      if (storeDoc.exists()) {
        const data = storeDoc.data()
        
        // Fetch products from subcollection
        const productsSnapshot = await getDocs(collection(db, "stores", uid, "products"))
        const productsFromFirestore: Product[] = productsSnapshot.docs.map((docSnap) => {
          const productData = docSnap.data()
          return {
            id: docSnap.id,
            name: productData.name || "",
            price: productData.price || 0,
            stock: productData.stockQuantity || 0,
            category: productData.category || "",
  imageUrls: Array.isArray(productData.imageUrls) ? productData.imageUrls : Array.isArray(productData.images) ? productData.images : undefined,
  images: Array.isArray(productData.images) ? productData.images : Array.isArray(productData.imageUrls) ? productData.imageUrls : undefined,
  foodCategory: productData.foodCategory || undefined,
  categoryKey: productData.categoryKey || undefined,
            unit: productData.unit || "item",
            description: productData.description || "",
            image: productData.imageUrl || "/images/placeholder.jpg",
            available: productData.availability ?? true,
          }
        })

        // Convert opening hours from object to array format if needed
        let openingHoursArray = placeholderStoreData.openingHours
        if (data.openingHours && typeof data.openingHours === "object" && !Array.isArray(data.openingHours)) {
          const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
          openingHoursArray = days.map((day) => {
            const dayKey = day.toLowerCase()
            const hourData = data.openingHours[dayKey]
            return {
              day,
              isOpen: hourData?.open && hourData?.close ? true : false,
              openTime: hourData?.open || "09:00",
              closeTime: hourData?.close || "17:00",
            }
          })
        } else if (Array.isArray(data.openingHours) && data.openingHours.length > 0) {
          openingHoursArray = data.openingHours
        }

        // Set store data from Firestore - Firestore is the source of truth
        setStoreData({
          ...placeholderStoreData,
          storeName: data.storeName || placeholderStoreData.storeName,
          storeCategory: data.category || "food",
          // Rating and review count are ALWAYS loaded from the Firestore store doc.
          // They are written by the backend rating endpoint, never calculated from orders.
          customerRating: typeof data.rating === "number" ? data.rating : 0,
          totalReviews: typeof data.reviewCount === "number" ? data.reviewCount : 0,
          storeInfo: {
            name: data.storeName || "",
            address: data.address || "",
            phone: data.phone || "",
            logo: data.logo || "",
            storeLocation: data.location || null,
          },
          openingHours: openingHoursArray,
          products: productsFromFirestore, // Always use Firestore products (empty array is valid)
          storeStatus: placeholderStoreData.storeStatus,
          storeStatusManualOverride: false,
        })
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error("Error fetching store data:", errorMessage)
      
      // Retry on offline/network errors
      if (retryCount < MAX_RETRIES && (
        errorMessage.includes("offline") || 
        errorMessage.includes("network") ||
        errorMessage.includes("Failed to get document")
      )) {
        console.log(`Retrying fetch in ${RETRY_DELAY}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`)
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
        return fetchStoreData(uid, retryCount + 1)
      }
      
      // If all retries failed, still allow the user to continue with placeholder data
      // They can refresh to retry later
    }
  }, [])

  // Check authentication state on mount and handle persistence
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        // User is logged in - fetch their store data from Firestore
        setCurrentUserId(user.uid)
        await fetchStoreData(user.uid)
        setIsAuthenticated(true)
        setAuthPage("welcome")
      } else {
        // User is not logged in
        setCurrentUserId(null)
        setPopupHidden(false)
        setIsAuthenticated(false)
        setAuthPage("welcome")
        // Reset store data to placeholder
        setStoreData(placeholderStoreData)
      }
      setIsLoading(false)
    })

    return () => {
      unsubscribe()
      storeListenerRef.current?.()
      storeListenerRef.current = null
    }
  }, [fetchStoreData])

  // Handle successful signup
  const handleSignupSuccess = useCallback((userData: {
    uid: string
    firstName: string
    surname: string
    storeName: string
    phone: string
    email: string
    address: string
    category: string
  }) => {
    // Update store data with user's info
    setCurrentUserId(userData.uid)
    setStoreData((prev) => ({
      ...prev,
      storeName: userData.storeName,
      storeInfo: {
        ...prev.storeInfo,
        name: userData.storeName,
        address: userData.address,
        phone: userData.phone,
      },
    }))
    setIsAuthenticated(true)
  }, [])

  // Handle successful login
  const handleLoginSuccess = useCallback(() => {
    // Auth state change listener will handle fetching data
    setIsAuthenticated(true)
  }, [])

  // Check if store should be open based on opening hours
  const checkStoreOpenStatus = useCallback(() => {
    if (storeData.storeStatusManualOverride) return // Don't auto-update if manual override is active

    const now = new Date()
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    const currentDay = dayNames[now.getDay()]
    const currentHour = storeData.openingHours.find((h) => h.day === currentDay)

    if (!currentHour || !currentHour.isOpen) {
      setStoreData((prev) => ({ ...prev, storeStatus: false }))
      return
    }

    const [openH, openM] = currentHour.openTime.split(":").map(Number)
    const [closeH, closeM] = currentHour.closeTime.split(":").map(Number)
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const openMinutes = openH * 60 + openM
    const closeMinutes = closeH * 60 + closeM

    const isWithinHours = currentMinutes >= openMinutes && currentMinutes < closeMinutes
    setStoreData((prev) => ({ ...prev, storeStatus: isWithinHours }))
  }, [storeData.openingHours, storeData.storeStatusManualOverride])

  // Check store status on mount and when opening hours change
  useEffect(() => {
    if (isAuthenticated) {
      checkStoreOpenStatus()
      const interval = setInterval(checkStoreOpenStatus, 60000) // Check every minute
      return () => clearInterval(interval)
    }
  }, [isAuthenticated, checkStoreOpenStatus])

  const handleNavigate = useCallback(
    (page: string) => {
      const currentIdx = pageOrder.indexOf(activePage)
      const nextIdx = pageOrder.indexOf(page)
      if (nextIdx !== -1 && currentIdx !== -1) {
        setDirection(nextIdx >= currentIdx ? "right" : "left")
      } else {
        setDirection("right")
      }
      setActivePage(page)
    },
    [activePage]
  )

  const handleToggleStatus = useCallback(() => {
    setStoreData((prev) => ({
      ...prev,
      storeStatus: !prev.storeStatus,
      storeStatusManualOverride: true, // Enable manual override when toggled
    }))
  }, [])

  const driverTrackingOrderRef = useRef<string | null>(null)
  useEffect(() => {
    if (!isAuthenticated || activePage !== "dashboard" || pendingOrderForPopup || driverTrackingOrderRef.current) return
    const trackedOrder = allOrders.find((order) => order.driverStatus === "assigned" || (order.status === "at_store" && order.driverStatus === "at_store"))
    if (trackedOrder) {
      driverTrackingOrderRef.current = trackedOrder.id
      setActivePage("driverAssigned")
    }
  }, [activePage, allOrders, isAuthenticated, pendingOrderForPopup])
  useEffect(() => {
    if (!isAuthenticated) driverTrackingOrderRef.current = null
  }, [isAuthenticated])

  const latestPending = useMemo(() => pendingOrders[0] ?? null, [pendingOrders])
  const latestPayment = useMemo(() => allOrders.find((order) => ["accepted", "ready_for_pickup", "at_store", "picked_up", "delivered", "completed"].includes(order.status)) ?? null, [allOrders])
  const latestDriver = useMemo(() => allOrders.find((order) => Boolean(order.driverSnapshot && order.driverStatus)) ?? null, [allOrders])
  const notificationKey = currentUserId ? `wee-notifications:${currentUserId}` : null
  const [viewedNotificationIds, setViewedNotificationIds] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!notificationKey) { setViewedNotificationIds({}); return }
    try { setViewedNotificationIds(JSON.parse(localStorage.getItem(notificationKey) || "{}")) } catch { setViewedNotificationIds({}) }
  }, [notificationKey])

  const markCategoryViewed = useCallback((category: string, orderId?: string) => {
    if (!notificationKey || !orderId) return
    setViewedNotificationIds((prev) => {
      const next = { ...prev, [category]: orderId }
      localStorage.setItem(notificationKey, JSON.stringify(next))
      return next
    })
  }, [notificationKey])

  const handleMarkAllRead = useCallback(() => {
    if (!notificationKey) return
    const next = { new_order: latestPending?.id || "none", payment_captured: latestPayment?.id || "none", driver_assigned: latestDriver?.id || "none" }
    localStorage.setItem(notificationKey, JSON.stringify(next))
    setViewedNotificationIds(next)
  }, [notificationKey, latestPending, latestPayment, latestDriver])

  const unreadCategories = {
    new_order: Boolean(latestPending && viewedNotificationIds.new_order !== latestPending.id),
    payment_captured: Boolean(latestPayment && viewedNotificationIds.payment_captured !== latestPayment.id),
    driver_assigned: Boolean(latestDriver && viewedNotificationIds.driver_assigned !== latestDriver.id),
  }
  const unreadCount = Object.values(unreadCategories).filter(Boolean).length

  const handleLogout = useCallback(async () => {
    if (pendingOrderForPopup && !window.confirm("You have an order waiting. Log out anyway?")) return
    try {
      await signOut(auth)
      setPopupHidden(false)
      setIsAuthenticated(false)
      setAuthPage("welcome")
      setActivePage("dashboard")
      setStoreData(placeholderStoreData)
    } catch (error) {
      console.error("Logout error:", error)
    }
  }, [])

  // Settings navigation handlers
  const handleSettingsNavigate = useCallback((page: string) => {
    setDirection("right")
    setActivePage(page)
  }, [])

  // Product handlers
  const handleEditProduct = useCallback((product: Product) => {
    setEditingProduct(product)
    setActivePage("addProduct")
  }, [])

  const handleDeleteProduct = useCallback((productId: string) => {
    setStoreData((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== productId),
    }))
  }, [])

  const handleToggleProductAvailability = useCallback((productId: string) => {
    setStoreData((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === productId ? { ...p, available: !p.available } : p
      ),
    }))
  }, [])

  const handleSaveProduct = useCallback(
    (product: Omit<Product, "id"> & { id?: string }) => {
      if (product.id) {
        // Check if product exists - update or add
        setStoreData((prev) => {
          const existingIndex = prev.products.findIndex((p) => p.id === product.id)
          if (existingIndex !== -1) {
            // Update existing product
            return {
              ...prev,
              products: prev.products.map((p) =>
                p.id === product.id ? { ...p, ...product } as Product : p
              ),
            }
          } else {
            // Add new product with provided ID (from Firestore)
            return {
              ...prev,
              products: [...prev.products, product as Product],
            }
          }
        })
      }
      setEditingProduct(null)
      setActivePage("products")
    },
    []
  )

  // Opening hours handler
  const handleSaveOpeningHours = useCallback((hours: OpeningHour[]) => {
    setStoreData((prev) => ({
      ...prev,
      openingHours: hours,
      storeStatusManualOverride: false, // Reset manual override when hours are saved
    }))
    setActivePage("settings")
  }, [])

  // Store info handler
  const handleSaveStoreInfo = useCallback((info: StoreInfo) => {
    setStoreData((prev) => ({
      ...prev,
      storeInfo: info,
      storeName: info.name || prev.storeName,
    }))
    setActivePage("settings")
  }, [])

  const handleBack = useCallback(() => {
    setDirection("left")
    if (activePage === "addProduct") {
      setEditingProduct(null)
      setActivePage("products")
    } else if (["products", "openingHours", "storeInfo"].includes(activePage)) {
      setActivePage("settings")
    } else {
      setActivePage("dashboard")
    }
  }, [activePage])

  // Determine if bottom nav should be hidden
  const hideBottomNav = ["products", "addProduct", "openingHours", "storeInfo", "pendingOrders", "driverAssigned", "payments"].includes(activePage)

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-dvh w-full bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  // Show authentication flow if not authenticated
  if (!isAuthenticated) {
    if (authPage === "welcome") {
      return (
        <WelcomePage 
          onSignIn={() => setAuthPage("login")} 
          onSignUp={() => setAuthPage("signup")} 
        />
      )
    }
    
    if (authPage === "login") {
      return (
        <LoginPage 
          onLoginSuccess={handleLoginSuccess}
          onSignUp={() => setAuthPage("signup")}
        />
      )
    }
    
    if (authPage === "signup") {
      return (
        <SignupPage 
          onSignupSuccess={handleSignupSuccess}
          onSignIn={() => setAuthPage("login")}
        />
      )
    }
  }

  // Show main dashboard app
  return (
    <CallProvider>
      <div className="flex flex-col h-dvh w-full max-w-[1200px] mx-auto bg-background">
        <Toaster />
        <CallOverlay />
        <NativeCallsBoot onOpenOrders={() => setActivePage("orders")} />
      {/* Global Order Popup Panel */}
      {pendingOrderForPopup && (
        <OrderPopupPanel
          order={pendingOrderForPopup}
          onClose={dismissPopup}
          onStatusUpdate={handleStatusUpdate}
          hidden={popupHidden}
          onHiddenChange={setPopupHidden}
        />
      )}
      {/* Page Content */}
      <div className="flex-1 overflow-hidden relative">
        <div
          key={activePage}
          className="absolute inset-0 animate-in fade-in duration-200"
          style={{
            animationName: direction === "right" ? "slideInFromRight" : "slideInFromLeft",
            animationDuration: "250ms",
            animationTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          }}
        >
          {activePage === "dashboard" && (
            <DashboardPage
              data={storeData}
              realtimeOrders={allOrders}
              onToggleStatus={handleToggleStatus}
              onNavigate={handleNavigate}
            />
          )}
          {activePage === "orders" && (
          <OrdersPage
              realtimeOrders={allOrders}
            />
          )}
          {activePage === "notifications" && (
            <NotificationsPage
              latestPending={latestPending}
              latestPayment={latestPayment}
              latestDriver={latestDriver}
              unreadCategories={unreadCategories}
              onCategoryViewed={(category) => markCategoryViewed(category, category === "new_order" ? latestPending?.id : category === "payment_captured" ? latestPayment?.id : latestDriver?.id)}
              onMarkAllRead={handleMarkAllRead}
              onNavigate={handleNavigate}
            />
          )}
          {activePage === "settings" && (
            <SettingsPage
              onLogout={handleLogout}
              onNavigate={handleSettingsNavigate}
            />
          )}
          {activePage === "products" && currentUserId && (
            <ProductsPage
              products={storeData.products}
              storeId={currentUserId}
              onBack={handleBack}
              onAddProduct={() => {
                setEditingProduct(null)
                setActivePage("addProduct")
              }}
              onEditProduct={handleEditProduct}
              onDeleteProduct={handleDeleteProduct}
              onToggleAvailability={handleToggleProductAvailability}
            />
          )}
          {activePage === "addProduct" && currentUserId && (
        <AddProductPage
          key={editingProduct?.id ?? "new"}
          product={editingProduct}
              storeId={currentUserId}
              storeName={storeData.storeName}
              storeAddress={storeData.storeInfo.address}
              storeCategory={storeData.storeCategory}
              onBack={handleBack}
              onSave={handleSaveProduct}
            />
          )}
          {activePage === "openingHours" && currentUserId && (
            <OpeningHoursPage
              openingHours={storeData.openingHours}
              storeId={currentUserId}
              onBack={handleBack}
              onSave={handleSaveOpeningHours}
            />
          )}
          {activePage === "storeInfo" && currentUserId && (
            <StoreInfoPage
              storeInfo={storeData.storeInfo}
              storeId={currentUserId}
              onBack={handleBack}
              onSave={handleSaveStoreInfo}
            />
          )}
          {activePage === "pendingOrders" && (
            <PendingOrdersPage pendingOrders={pendingOrders} acceptedOrders={acceptedOrders} onBack={() => { setDirection("left"); setActivePage("notifications") }} />
          )}
  {activePage === "driverAssigned" && (
  <DriverAssignedPage orders={allOrders} onBack={() => { setDirection("left"); setActivePage("notifications") }} />
  )}
  {activePage === "payments" && (
  <PaymentsPage orders={allOrders} onBack={() => { setDirection("left"); setActivePage("notifications") }} />
  )}
        </div>
      </div>

      <StoreCallButton orders={allOrders} storeCategory={storeData.storeCategory} />

      {/* Fixed Bottom Navigation - hidden on sub-pages */}
      {!hideBottomNav && (
        <BottomNavigation
          activePage={activePage}
          onNavigate={handleNavigate}
          notificationCount={unreadCount}
        />
      )}

      {/* Page transition keyframes */}
      <style jsx>{`
        @keyframes slideInFromRight {
          from {
            transform: translateX(30px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideInFromLeft {
          from {
            transform: translateX(-30px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
      </div>
    </CallProvider>
  )
}
