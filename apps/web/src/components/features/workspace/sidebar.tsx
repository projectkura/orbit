"use client"

import * as React from "react"

import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  DashboardSquare01Icon,
  Folder01Icon,
  HelpCircleIcon,
  Key01Icon,
  Settings02Icon,
} from "@hugeicons/core-free-icons"

import type { NavUserData } from "@/components/shared/nav-user"
import { NavMain } from "@/components/shared/nav-main"
import { NavUser } from "@/components/shared/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/sidebar"

type WorkspaceSidebarProps = React.ComponentProps<typeof Sidebar> & {
  activeItem: "overview" | "usage" | "settings" | "api-keys"
  identifier: string
  workspace: {
    name: string
    identifier: string
    imageUrl?: string | null
  }
  user: NavUserData
  onLogout: () => void
}

export function WorkspaceSidebar({
  activeItem,
  identifier,
  workspace,
  user,
  onLogout,
  ...props
}: WorkspaceSidebarProps) {
  const data = {
    navMain: [
      {
        title: "Overview",
        url: `/app/${identifier}/overview`,
        icon: <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />,
        isActive: activeItem === "overview",
      },
      {
        title: "Usage",
        url: `/app/${identifier}/usage`,
        icon: <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />,
        isActive: activeItem === "usage",
      },
      {
        title: "API Keys",
        url: `/app/${identifier}/api-keys`,
        icon: <HugeiconsIcon icon={Key01Icon} strokeWidth={2} />,
        isActive: activeItem === "api-keys",
      },
      {
        title: "Settings",
        url: `/app/${identifier}/settings`,
        icon: <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />,
        isActive: activeItem === "settings",
      },
    ],
  }

  function initials(value: string) {
    return value.slice(0, 2).toUpperCase()
  }

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip={workspace.name}>
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                {workspace.imageUrl ? (
                  <img src={workspace.imageUrl} alt="" className="size-full object-cover" />
                ) : (
                  <span className="text-xs font-semibold">{initials(workspace.name)}</span>
                )}
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{workspace.name}</span>
                <span className="truncate text-xs">@{workspace.identifier}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="sm" render={<Link to="/app" />}>
                  <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                  <span>Workspaces</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton size="sm" render={<Link to="/" />}>
                  <HugeiconsIcon icon={HelpCircleIcon} strokeWidth={2} />
                  <span>Help</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} onLogout={onLogout} />
      </SidebarFooter>
    </Sidebar>
  )
}
