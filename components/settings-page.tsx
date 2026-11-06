"use client"

import { useEffect, useState } from "react"
import { getCallPermissionStatus, isNative, openCallSettings } from "@/native/calls"
import {
  ChevronLeft,
  ChevronRight,
  Store,
  ShoppingBag,
  LayoutGrid,
  Clock,
  Truck,
  CreditCard,
  Bell,
  Shield,
  LogOut,
} from "lucide-react"

interface SettingsPageProps {
  onLogout: () => void
  onNavigate: (page: string) => void
}

const settingsItems = [
  {
    id: "storeInformationButton",
    icon: Store,
    label: "Store Information",
    description: "Edit store name, address, contact details",
    color: "bg-primary/15",
    iconColor: "text-primary",
    navigateTo: "storeInfo",
  },
  {
    id: "productsButton",
    icon: ShoppingBag,
    label: "Products",
    description: "Add new products, edit items, upload product images",
    color: "bg-[#22c55e]/15",
    iconColor: "text-[#22c55e]",
    navigateTo: "addProduct",
  },
  {
    id: "categoriesButton",
    icon: LayoutGrid,
    label: "Categories",
    description: "Manage product categories",
    color: "bg-[#f97316]/15",
    iconColor: "text-[#f97316]",
    navigateTo: "products",
  },
  {
    id: "openingHoursButton",
    icon: Clock,
    label: "Opening Hours",
    description: "Set business hours Monday to Sunday with toggles",
    color: "bg-[#6366f1]/15",
    iconColor: "text-[#6366f1]",
    navigateTo: "openingHours",
  },
  {
    id: "deliverySettingsButton",
    icon: Truck,
    label: "Delivery Settings",
    description: "Set delivery radius and delivery time",
    color: "bg-destructive/15",
    iconColor: "text-destructive",
    navigateTo: null,
  },
  {
    id: "paymentSettingsButton",
    icon: CreditCard,
    label: "Payment Settings",
    description: "Connect payment gateway and payout account",
    color: "bg-[#0ea5e9]/15",
    iconColor: "text-[#0ea5e9]",
    navigateTo: null,
  },
  {
    id: "settingsNotificationsButton",
    icon: Bell,
    label: "Notifications",
    description: "Manage order notifications and alerts",
    color: "bg-[#eab308]/15",
    iconColor: "text-[#eab308]",
    navigateTo: null,
  },
  {
    id: "securitySettingsButton",
    icon: Shield,
    label: "Security",
    description: "Change password and account security",
    color: "bg-[#8b5cf6]/15",
    iconColor: "text-[#8b5cf6]",
    navigateTo: null,
  },
]

export function SettingsPage({ onLogout, onNavigate }: SettingsPageProps) {
  const [permissions, setPermissions] = useState<{ notifications: boolean; fullScreen: boolean; batteryIgnored: boolean; microphone: boolean } | null>(null)
  useEffect(() => { if (isNative()) void getCallPermissionStatus().then(setPermissions) }, [])
  const phoneSettings = permissions ? [
    ["Notifications", permissions.notifications, "notifications"],
    ["Full-screen calls", permissions.fullScreen, "fullScreen"],
    ["Battery", permissions.batteryIgnored, "battery"],
    ["Microphone", permissions.microphone, "app"],
  ] as const : []
  return (
    <div className="flex flex-col h-full">
      {/* Fixed Header */}
      <div className="bg-card px-4 pt-5 pb-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="text-card-foreground" aria-label="Go back">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-card-foreground">Settings</h1>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
            TC
          </div>
        </div>
      </div>

      {/* Scrollable Settings List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-hide">
        <div className="flex flex-col gap-2">
          {isNative() && permissions && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-sm font-semibold text-card-foreground">Phone settings</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {phoneSettings.map(([label, enabled, type]) => (
                  <button key={label} type="button" onClick={() => !enabled && void openCallSettings(type)} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-left text-xs">
                    <span>{label}</span><span className={enabled ? "text-emerald-600" : "text-primary"}>{enabled ? "✓" : "Fix"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {settingsItems.map((item) => (
            <button
              key={item.id}
              id={item.id}
              onClick={() => item.navigateTo && onNavigate(item.navigateTo)}
              className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 shadow-sm w-full text-left transition-all duration-200 active:scale-[0.98] hover:bg-accent/50"
            >
              <div className={`${item.color} w-10 h-10 rounded-full flex items-center justify-center shrink-0`}>
                <item.icon className={`w-5 h-5 ${item.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-card-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}

          {/* Logout Button */}
          <button
            id="logoutButton"
            onClick={onLogout}
            className="mt-4 bg-primary text-primary-foreground rounded-xl p-4 flex items-center justify-center gap-2 font-semibold transition-all duration-200 active:scale-[0.98] hover:bg-primary/90"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}
