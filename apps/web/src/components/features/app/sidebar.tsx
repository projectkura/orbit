"use client"

import * as React from "react"

import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity01Icon,
  ArrowLeft01Icon,
  DashboardSquare01Icon,
  Folder01Icon,
  HelpCircleIcon,
  Mail01Icon,
  SearchList01Icon,
  Settings02Icon,
  Task01Icon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"

import type { NavUserData } from "@/components/shared/nav-user"
import { NavMain } from "@/components/shared/nav-main"
import { NavProjects } from "@/components/shared/nav-projects"
import { NavUser } from "@/components/shared/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/sidebar"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  activeItem:
    | "overview"
    | "onboarding"
    | "settings"
    | "email"
    | "usage"
    | "all-workspaces"
    | "diagnostics"
  user: NavUserData
  onLogout: () => void
}

export function AppSidebar({ activeItem, user, onLogout, ...props }: AppSidebarProps) {
  const data = {
    navMain: [
      {
        title: "Overview",
        url: "/admin",
        icon: <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />,
        isActive: activeItem === "onboarding" || activeItem === "overview",
      },
      {
        title: "Settings",
        url: "/admin/settings",
        icon: <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />,
        isActive: activeItem === "settings",
      },
      {
        title: "Email",
        url: "/admin/email",
        icon: <HugeiconsIcon icon={Mail01Icon} strokeWidth={2} />,
        isActive: activeItem === "email",
      },
      {
        title: "Usage",
        url: "/admin/usage",
        icon: <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />,
        isActive: activeItem === "usage",
      },
      {
        title: "Diagnostics",
        url: "/admin/diagnostics",
        icon: <HugeiconsIcon icon={Activity01Icon} strokeWidth={2} />,
        isActive: activeItem === "diagnostics",
      },
    ],
    directory: [
      {
        title: "All workspaces",
        url: "/admin/workspaces",
        icon: <HugeiconsIcon icon={SearchList01Icon} strokeWidth={2} />,
        isActive: activeItem === "all-workspaces",
      },
    ],
    projects: [
      {
        name: "All users",
        url: "#",
        icon: <HugeiconsIcon icon={UserMultiple02Icon} strokeWidth={2} />,
      },
      {
        name: "Audit logs",
        url: "#",
        icon: <HugeiconsIcon icon={Task01Icon} strokeWidth={2} />,
      },
    ],
  }

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Orbit" render={<Link to="/admin" />}>
              <div className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                <img src="/favicon.svg" alt="Orbit" className="size-full object-contain" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">Orbit</span>
                <span className="truncate text-xs">Instance admin</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <SidebarGroup>
          <SidebarGroupLabel>Directory</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {data.directory.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    isActive={item.isActive}
                    tooltip={item.title}
                    render={<Link to={item.url} />}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <NavProjects label="Later" projects={data.projects} />
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="sm" render={<Link to="/app" />}>
                  <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                  <span>User app</span>
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
