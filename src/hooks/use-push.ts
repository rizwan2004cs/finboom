"use client"

import { useEffect, useRef } from "react"
import { useUser } from "@/hooks/use-auth"

export function usePushSubscription() {
  const { user } = useUser()
  const subscribed = useRef(false)

  useEffect(() => {
    if (!user || subscribed.current) return
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return

    subscribed.current = true
    subscribeToPush()
  }, [user])

  async function subscribeToPush() {
    try {
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()

      if (existing) {
        // Already subscribed, sync to server
        await saveSubscription(existing)
        return
      }

      // Ask permission
      const permission = await Notification.requestPermission()
      if (permission !== "granted") return

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      })

      await saveSubscription(subscription)
    } catch (err) {
      console.warn("[push] Failed to subscribe:", err)
    }
  }

  async function saveSubscription(subscription: PushSubscription) {
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    })
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
