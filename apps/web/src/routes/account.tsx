import { useEffect, useMemo, useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  CheckmarkCircle02Icon,
  Logout01Icon,
  Mail01Icon,
  Moon02Icon,
  Sun03Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import type { OrbitSessionUser } from "@/lib/auth-types"
import { authClient } from "@/lib/auth-client"
import { useTheme } from "@/hooks/use-theme"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/avatar"
import { Badge } from "@/components/badge"
import { Button } from "@/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/field"
import { Input } from "@/components/input"
import { Spinner } from "@/components/spinner"

export const Route = createFileRoute("/account")({ component: AccountPage })

function formatDate(value?: string | Date | null) {
  if (!value) return null
  try {
    const d = typeof value === "string" ? new Date(value) : value
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  } catch {
    return null
  }
}

function AccountPage() {
  const session = authClient.useSession()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  const user = useMemo(
    () => (session.data?.user as OrbitSessionUser | undefined) ?? null,
    [session.data]
  )

  const [displayName, setDisplayName] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [savingProfile, setSavingProfile] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    if (session.isPending) return
    if (!user) {
      void navigate({ to: "/login", replace: true })
      return
    }
    setDisplayName((current) => current || user.name || "")
    setImageUrl((current) => current || user.image || "")
  }, [session.isPending, user, navigate])

  async function handleLogout() {
    setLoggingOut(true)
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.assign("/")
        },
      },
    })
  }

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    const trimmedName = displayName.trim()
    const trimmedImage = imageUrl.trim()

    if (!trimmedName) {
      toast.error("Display name cannot be empty.")
      return
    }

    setSavingProfile(true)
    try {
      const result = await authClient.updateUser({
        name: trimmedName,
        image: trimmedImage || undefined,
      })

      if (result.error) {
        throw new Error(result.error.message ?? "Failed to update profile.")
      }

      toast.success("Profile updated.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile."
      )
    } finally {
      setSavingProfile(false)
    }
  }

  if (session.isPending || !user) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4">
        <Spinner className="size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading account…</p>
      </main>
    )
  }

  const fallback = (user.firstName || user.name || user.email)
    .slice(0, 1)
    .toUpperCase()
  const username = user.username ?? user.email.split("@")[0]
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ")

  return (
    <main className="min-h-svh bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-3 px-4 md:px-6">
          <Button variant="ghost" size="sm" render={<Link to="/app" />} className="gap-1.5 -ml-2">
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
            Workspaces
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon
              icon={theme === "dark" ? Moon02Icon : Sun03Icon}
              strokeWidth={2}
              className="size-4"
            />
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6 md:py-12">
        <div className="mb-8 flex items-center gap-2">
          <HugeiconsIcon
            icon={UserCircleIcon}
            strokeWidth={2}
            className="size-5 text-muted-foreground"
          />
          <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        </div>

        <div className="flex flex-col gap-6">
          {/* Identity card */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Profile</Badge>
                {user.emailVerified ? (
                  <Badge variant="secondary" className="gap-1">
                    <HugeiconsIcon
                      icon={CheckmarkCircle02Icon}
                      strokeWidth={2.4}
                      className="size-3"
                    />
                    Verified
                  </Badge>
                ) : null}
              </div>
              <CardTitle>Your identity</CardTitle>
              <CardDescription>
                This is how Orbit identifies you across workspaces.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <Avatar size="lg" className="size-16">
                  <AvatarImage src={user.image ?? undefined} alt={user.name ?? "Avatar"} />
                  <AvatarFallback>{fallback}</AvatarFallback>
                </Avatar>
                <div className="grid gap-1">
                  <p className="text-base font-semibold text-foreground">
                    {fullName || user.name || username}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    @{username}
                  </p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile editing */}
          <form onSubmit={handleSaveProfile}>
            <Card>
              <CardHeader>
                <CardTitle>Display preferences</CardTitle>
                <CardDescription>
                  Update how your name and avatar appear inside Orbit.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="displayName">Display name</FieldLabel>
                    <Input
                      id="displayName"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your display name"
                      maxLength={100}
                    />
                    <FieldDescription>
                      Shown next to actions you take across workspaces.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="imageUrl">Avatar URL</FieldLabel>
                    <Input
                      id="imageUrl"
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://…"
                    />
                    <FieldDescription>
                      Paste a public image URL. Leave blank to use your initials.
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </CardContent>
              <CardFooter className="justify-end">
                <Button type="submit" disabled={savingProfile}>
                  {savingProfile ? (
                    <>
                      <Spinner className="size-4" />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </CardFooter>
            </Card>
          </form>

          {/* Account details (read-only) */}
          <Card>
            <CardHeader>
              <CardTitle>Account details</CardTitle>
              <CardDescription>
                These details come from your sign-in provider and cannot be
                changed here.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <ReadOnlyField
                label="First name"
                value={user.firstName ?? "—"}
              />
              <ReadOnlyField
                label="Last name"
                value={user.lastName ?? "—"}
              />
              <ReadOnlyField label="Username" value={`@${username}`} />
              <ReadOnlyField
                label="Email"
                value={user.email}
                icon={
                  <HugeiconsIcon
                    icon={Mail01Icon}
                    strokeWidth={2}
                    className="size-3.5 text-muted-foreground"
                  />
                }
              />
              <ReadOnlyField
                label="Member since"
                value={formatDate(user.onboardingCompletedAt) ?? "—"}
              />
              <ReadOnlyField
                label="Terms accepted"
                value={formatDate(user.tosAcceptedAt) ?? "—"}
              />
            </CardContent>
          </Card>

          {/* Session card */}
          <Card>
            <CardHeader>
              <CardTitle>Session</CardTitle>
              <CardDescription>
                Sign out of Orbit on this device.
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              {user.role === "admin" ? (
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  render={<Link to="/admin" />}
                >
                  Open admin dashboard
                </Button>
              ) : null}
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => void handleLogout()}
                disabled={loggingOut}
              >
                <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
                {loggingOut ? "Logging out…" : "Log out"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </main>
  )
}

function ReadOnlyField({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 truncate text-sm text-foreground">
        {icon}
        {value}
      </span>
    </div>
  )
}
