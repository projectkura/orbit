"use client"

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react"
import { authClient } from "@/lib/auth-client"
import { apiFetch } from "@/lib/api-client"
import type { UserNotification, NotificationListResponse } from "@orbit/shared"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  SparklesIcon,
  FolderCheckIcon,
  Delete02Icon,
  CreditCardIcon,
  InformationCircleIcon,
  Notification02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "@/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/popover"
import {
  Dialog,
  DialogContent,
} from "@/components/dialog"

interface NotificationContextType {
  notifications: UserNotification[]
  unreadCount: number
  loading: boolean
  fetchNotifications: () => Promise<void>
  markAllRead: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const session = authClient.useSession()
  const user = session.data?.user
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const response = await apiFetch("/api/v1/notifications")
      if (response.ok) {
        const text = await response.text()
        if (text) {
          const data = JSON.parse(text) as NotificationListResponse
          setNotifications(data.notifications || [])
          setUnreadCount(data.unreadCount || 0)
        }
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error)
    } finally {
      setLoading(false)
    }
  }, [user])

  const markAllRead = useCallback(async () => {
    if (!user) return
    try {
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, readAt: new Date().toISOString() })))
      setUnreadCount(0)

      const response = await apiFetch("/api/v1/notifications", {
        method: "PATCH",
      })
      if (!response.ok) {
        throw new Error("Failed to mark all read")
      }
    } catch (error) {
      console.error("Failed to mark notifications read:", error)
      toast.error("Failed to mark notifications read")
      void fetchNotifications()
    }
  }, [user, fetchNotifications])

  useEffect(() => {
    if (user) {
      void fetchNotifications()
    } else {
      setNotifications([])
      setUnreadCount(0)
    }
  }, [user, fetchNotifications])

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    if (!user) return
    const interval = setInterval(() => {
      void fetchNotifications()
    }, 30000)
    return () => clearInterval(interval)
  }, [user, fetchNotifications])

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAllRead,
  }), [notifications, unreadCount, loading, fetchNotifications, markAllRead])

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider")
  }
  return context
}

interface NotificationListContentProps {
  onClose?: () => void
}

export function NotificationListContent({ onClose }: NotificationListContentProps) {
  const { notifications, unreadCount, loading, markAllRead } = useNotifications()

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
    } catch {
      return ""
    }
  }

  const getIcon = (kind: string) => {
    switch (kind) {
      case "welcome":
        return <HugeiconsIcon icon={SparklesIcon} className="size-4" strokeWidth={2} />
      case "workspace_created":
        return <HugeiconsIcon icon={FolderCheckIcon} className="size-4" strokeWidth={2} />
      case "workspace_deleted":
        return <HugeiconsIcon icon={Delete02Icon} className="size-4" strokeWidth={2} />
      case "subscription":
        return <HugeiconsIcon icon={CreditCardIcon} className="size-4" strokeWidth={2} />
      default:
        return <HugeiconsIcon icon={InformationCircleIcon} className="size-4" strokeWidth={2} />
    }
  }

  const getIconColorClass = (kind: string) => {
    switch (kind) {
      case "welcome":
        return "bg-amber-500/10 text-amber-500 dark:bg-amber-500/20"
      case "workspace_created":
        return "bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20"
      case "workspace_deleted":
        return "bg-rose-500/10 text-rose-500 dark:bg-rose-500/20"
      case "subscription":
        return "bg-sky-500/10 text-sky-500 dark:bg-sky-500/20"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  return (
    <div className="flex flex-col h-full max-h-[450px]">
      <div className="flex items-center justify-between px-4 py-3 bg-card/45 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">Notifications</span>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-medium bg-primary text-primary-foreground rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {unreadCount > 0 && (
            <button
              onClick={() => void markAllRead()}
              className="text-xs text-primary hover:text-primary/80 transition font-medium outline-hidden cursor-pointer"
            >
              Mark all read
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition cursor-pointer p-0.5 rounded-lg hover:bg-muted/80 flex items-center justify-center"
              aria-label="Close notifications"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-4" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 bg-background/50">
        {loading && notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
            <span className="animate-spin text-primary size-5 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-xs">Loading notifications...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="grid size-12 place-items-center rounded-xl bg-muted/30 text-muted-foreground mb-3">
              <HugeiconsIcon icon={Notification02Icon} className="size-5" />
            </div>
            <p className="text-sm font-medium text-foreground">All caught up!</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
              You don't have any notifications at the moment.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {notifications.map((notification) => {
              const isUnread = !notification.readAt
              return (
                <div
                  key={notification.id}
                  className={cn(
                    "flex gap-3 p-4 transition duration-150 relative group",
                    isUnread ? "bg-primary/5 hover:bg-primary/[0.08]" : "hover:bg-muted/30"
                  )}
                >
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      getIconColorClass(notification.kind)
                    )}
                  >
                    {getIcon(notification.kind)}
                  </div>
                  <div className="flex-1 min-w-0 pr-4">
                    <p className={cn("text-xs font-semibold leading-tight text-foreground truncate")}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-normal break-words">
                      {notification.body}
                    </p>
                    <p className="text-[10px] text-muted-foreground/80 mt-1.5">
                      {formatTime(notification.createdAt)}
                    </p>
                  </div>
                  {isUnread && (
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 size-2 rounded-full bg-primary" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function NotificationCenterPopover() {
  const { unreadCount } = useNotifications()

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-9 text-muted-foreground hover:text-foreground relative rounded-full"
            aria-label="Notifications"
          >
            <HugeiconsIcon icon={Notification02Icon} className="size-4" strokeWidth={2} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex size-2 rounded-full bg-destructive animate-pulse" />
            )}
          </Button>
        }
      />
      <PopoverContent className="w-80 p-0 overflow-hidden rounded-2xl bg-popover/85 backdrop-blur-2xl backdrop-saturate-150 border border-border" align="end" sideOffset={8}>
        <NotificationListContent />
      </PopoverContent>
    </Popover>
  )
}

interface NotificationCenterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationCenterDialog({ open, onOpenChange }: NotificationCenterDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md p-0 overflow-hidden gap-0 rounded-2xl bg-popover/85 backdrop-blur-2xl backdrop-saturate-150 border border-border">
        <NotificationListContent onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}
