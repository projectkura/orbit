import { useEffect, type ReactNode } from "react"
import { useNavigate } from "@tanstack/react-router"

import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/sidebar"
import { Spinner } from "@/components/spinner"
import { authClient } from "@/lib/auth-client"
import type { OrbitSessionUser } from "@/lib/auth-types"

type AdminShellProps = {
  activeItem: "onboarding" | "settings"
  title: string
  description: string
  children: ReactNode
}

export function AdminShell({
  activeItem,
  title,
  description,
  children,
}: AdminShellProps) {
  const session = authClient.useSession()
  const navigate = useNavigate()

  const user = (session.data?.user as OrbitSessionUser | undefined) ?? null
  const isAdmin = user?.role === "admin"

  useEffect(() => {
    if (session.isPending) {
      return
    }

    if (!user) {
      void navigate({ to: "/auth", replace: true })
      return
    }

    if (!isAdmin) {
      void navigate({ to: "/app", replace: true })
    }
  }, [isAdmin, session.isPending, user, navigate])

  async function handleLogout() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.assign("/")
        },
      },
    })
  }

  if (session.isPending || !user || !isAdmin) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4">
        <Spinner />
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      </main>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar
        activeItem={activeItem}
        user={{
          name: user.name ?? user.username ?? "Orbit Admin",
          email: user.email,
          avatar: user.image,
          roleLabel: "Instance Admin",
        }}
        onLogout={() => void handleLogout()}
      />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 rounded-t-[inherit] border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <SidebarTrigger />
          <div className="flex min-w-0 items-baseline gap-2">
            <p className="truncate text-sm font-medium text-foreground">{title}</p>
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          </div>
        </header>

        <div className="p-4 md:p-6">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
