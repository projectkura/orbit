"use client"

import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DashboardSquare01Icon,
  Logout01Icon,
  Moon02Icon,
  Notification02Icon,
  Settings02Icon,
  Sun03Icon,
  UnfoldMoreIcon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons"
import { useNotifications, NotificationCenterDialog } from "@/components/shared/notification-center"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/sidebar"
import { useTheme } from "@/hooks/use-theme"

export type NavUserData = {
  firstName: string
  username: string
  email: string
  avatar?: string | null
  isAdmin?: boolean
}

export function NavUser({
  user,
  onLogout,
}: {
  user: NavUserData
  onLogout: () => void
}) {
  const { isMobile } = useSidebar()
  const { theme, toggleTheme } = useTheme()
  const { unreadCount } = useNotifications()
  const [showNotifications, setShowNotifications] = useState(false)
  const fallback = (user.firstName || user.username || user.email)
    .slice(0, 1)
    .toUpperCase()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar>
              <AvatarImage
                src={user.avatar ?? undefined}
                alt={user.firstName}
              />
              <AvatarFallback>{fallback}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.firstName}</span>
              <span className="truncate text-xs text-muted-foreground">
                @{user.username}
              </span>
            </div>
            <HugeiconsIcon
              icon={UnfoldMoreIcon}
              strokeWidth={2}
              className="ml-auto size-4"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-60 bg-popover/85 backdrop-blur-2xl backdrop-saturate-150"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-3 px-2 py-2">
                  <Avatar>
                    <AvatarImage
                      src={user.avatar ?? undefined}
                      alt={user.firstName}
                    />
                    <AvatarFallback>{fallback}</AvatarFallback>
                  </Avatar>
                  <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium text-foreground">
                      {user.firstName}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setShowNotifications(true)}>
                <HugeiconsIcon icon={Notification02Icon} strokeWidth={2} />
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center size-5 text-[10px] font-semibold bg-primary text-primary-foreground rounded-full">
                    {unreadCount}
                  </span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link to="/account" />}>
                <HugeiconsIcon icon={UserCircleIcon} strokeWidth={2} />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link to="/app" />}>
                <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />
                Workspaces
              </DropdownMenuItem>
              {user.isAdmin ? (
                <DropdownMenuItem render={<Link to="/admin" />}>
                  <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />
                  Admin dashboard
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem closeOnClick={false} onClick={toggleTheme}>
                <HugeiconsIcon
                  icon={theme === "dark" ? Sun03Icon : Moon02Icon}
                  strokeWidth={2}
                />
                {theme === "dark" ? "Light theme" : "Dark theme"}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onLogout}>
              <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <NotificationCenterDialog open={showNotifications} onOpenChange={setShowNotifications} />
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
