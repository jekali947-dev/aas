"use client"

import { useEffect, useRef } from "react"
import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { useCall } from "@/contexts/call-context"
import { callServiceStart, callServiceStop, disposeNativeCalls, initNativeCalls, isNative } from "@/native/calls"

export function NativeCallsBoot({ onOpenOrders }: { onOpenOrders: () => void }) {
  const { callState, answerCall } = useCall()
  const tokenRef = useRef<string | null>(null)
  const callStateRef = useRef(callState)
  const answeredRef = useRef(false)
  callStateRef.current = callState

  useEffect(() => {
    if (callState === "in-call") callServiceStart()
    else if (callState === "ended" || callState === "idle") callServiceStop()
  }, [callState])

  useEffect(() => {
    if (!isNative) return
    let activeUid: string | null = null
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        if (activeUid && tokenRef.current) void updateDoc(doc(db, "stores", activeUid), { fcmToken: arrayRemove(tokenRef.current), fcmTokens: arrayRemove(tokenRef.current) }).catch(() => {})
        activeUid = null
        tokenRef.current = null
        void disposeNativeCalls()
        return
      }
      activeUid = user.uid
      void initNativeCalls({
        saveToken: async (token) => {
          tokenRef.current = token
          await updateDoc(doc(db, "stores", user.uid), { fcmToken: token, fcmTokens: arrayUnion(token) })
        },
        onAnswer: () => {
          if (answeredRef.current) return
          answeredRef.current = true
          const deadline = Date.now() + 10000
          const wait = () => {
            if (callStateRef.current === "ringing") { void answerCall(); return }
            if (Date.now() < deadline) window.setTimeout(wait, 250)
          }
          wait()
        },
        onOpen: onOpenOrders,
      })
    })
    return () => { unsubscribe(); void disposeNativeCalls() }
  }, [answerCall, onOpenOrders])

  useEffect(() => { if (callState !== "ringing") answeredRef.current = false }, [callState])
  return null
}
