"use client"

import * as React from "react"

import { Button } from "@/components/button"
import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
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
import { useTheme } from "@/hooks/use-theme"
import { Link } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CommandIcon,
  DashboardSquare01Icon,
  Settings02Icon,
  UserMultiple02Icon,
  Task01Icon,
  ArrowLeft01Icon,
  HelpCircleIcon,
  Moon02Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  activeItem: "onboarding" | "settings"
  user: {
    name: string
    email: string
    avatar?: string | null
    roleLabel: string
  }
  onLogout: () => void
}

export function AppSidebar({ activeItem, user, onLogout, ...props }: AppSidebarProps) {
  const { theme, toggleTheme } = useTheme()

  const data = {
    navMain: [
      {
        title: "Onboarding",
        url: "/admin",
        icon: <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />,
        isActive: activeItem === "onboarding",
      },
      {
        title: "Settings",
        url: "/admin/settings",
        icon: <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />,
        isActive: activeItem === "settings",
      },
    ],
    projects: [
      {
        name: "Tenant management",
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
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/admin" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <HugeiconsIcon icon={CommandIcon} strokeWidth={2} className="size-4" />
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
        <NavProjects label="Roadmap" projects={data.projects} />
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="sm" render={<Link to="/app" />}>
                  <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
                  <span>User app</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem className="flex items-center">
                <SidebarMenuButton size="sm" render={<Link to="/" />} className="flex-1">
                  <HugeiconsIcon icon={HelpCircleIcon} strokeWidth={2} />
                  <span>Help</span>
                </SidebarMenuButton>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={toggleTheme}
                  className="size-7 shrink-0 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                >
                  <HugeiconsIcon
                    icon={theme === "dark" ? Moon02Icon : Sun03Icon}
                    strokeWidth={2}
                    className="size-3.5"
                  />
                  <span className="sr-only">Toggle theme</span>
                </Button>
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
