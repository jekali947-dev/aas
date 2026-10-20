"use client"

import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"

const parents: Record<string, string> = { addProduct: "products", products: "settings", openingHours: "settings", storeInfo: "settings", pendingOrders: "notifications", driverAssigned: "notifications", payments: "notifications" }

export function useBackGuard(activePage: string, setActivePage: (page: string) => void, popupExpanded: boolean, minimizePopup: () => void, enabled = true, hasPopup = false) {
  const lastBackRef = useRef(0)
  const handlingRef = useRef(false)
  const pageChangedByBackRef = useRef(false)
  const enabledRef = useRef(false)
  const activePageRef = useRef(activePage)
  const popupExpandedRef = useRef(popupExpanded)
  const hasPopupRef = useRef(hasPopup)
  const setActivePageRef = useRef(setActivePage)
  const minimizePopupRef = useRef(minimizePopup)

  activePageRef.current = activePage
  popupExpandedRef.current = popupExpanded
  hasPopupRef.current = hasPopup
  setActivePageRef.current = setActivePage
  minimizePopupRef.current = minimizePopup

  const handleHardwareBack = useCallback(() => {
    if (handlingRef.current) return
    handlingRef.current = true
    const currentPage = activePageRef.current
    if (hasPopupRef.current) {
      if (!popupExpandedRef.current) minimizePopupRef.current()
      else toast("Respond to the order request first")
      history.pushState({ app: "merchant", page: currentPage }, "", location.href)
      handlingRef.current = false
      return
    }
    if (currentPage === "dashboard") {
      const now = Date.now()
      if (now - lastBackRef.current < 2000) { handlingRef.current = false; history.back(); return }
      lastBackRef.current = now; history.pushState({ app: "merchant", page: currentPage }, "", location.href); toast("Press back again to exit"); handlingRef.current = false; return
    }
    const next = parents[currentPage] || "dashboard"
    pageChangedByBackRef.current = true
    setActivePageRef.current(next)
    history.pushState({ app: "merchant", page: next }, "", location.href)
    handlingRef.current = false
  }, [])

  useEffect(() => {
    if (!enabled) return
    history.replaceState({ app: "merchant", page: "root" }, "", location.href)
    history.pushState({ app: "merchant", page: activePageRef.current }, "", location.href)
    const onPopState = () => handleHardwareBack()
    addEventListener("popstate", onPopState)
    return () => removeEventListener("popstate", onPopState)
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      enabledRef.current = false
      return
    }
    if (!enabledRef.current) {
      enabledRef.current = true
      pageChangedByBackRef.current = false
      return
    }
    if (pageChangedByBackRef.current) {
      pageChangedByBackRef.current = false
      return
    }
    if (!handlingRef.current) history.pushState({ app: "merchant", page: activePage }, "", location.href)
  }, [activePage, enabled])
  return { handleHardwareBack }
}
