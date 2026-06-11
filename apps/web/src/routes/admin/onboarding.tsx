import { useEffect, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CheckmarkCircle02Icon,
  GlobalIcon,
} from "@hugeicons/core-free-icons"

import { AdminShell } from "@/components/features/admin/shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert"
import { Button } from "@/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/card"
import { Input } from "@/components/input"
import { Label } from "@/components/label"
import { Separator } from "@/components/separator"
import { Spinner } from "@/components/spinner"
import { Switch } from "@/components/switch"

export const Route = createFileRoute("/admin/onboarding")({
  component: AdminOnboardingPage,
})

function AdminOnboardingPage() {
  const navigate = useNavigate()
  const [domain, setDomain] = useState("")
  const [publicSignups, setPublicSignups] = useState(false)
  const [homePageEnabled, setHomePageEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadConfig() {
      try {
        setError(null)
        const res = await fetch("/api/instance-config", {
          credentials: "include",
        })

        if (!res.ok) {
          throw new Error(`Failed to load config (${res.status})`)
        }

        const data = (await res.json()) as {
          domain?: string
          publicSignups?: boolean
          homePageEnabled?: boolean
          onboardingComplete?: boolean
        }

        if (!mounted) {
          return
        }

        if (data.onboardingComplete) {
          void navigate({ to: "/admin", replace: true })
          return
        }

        setDomain(data.domain ?? "")
        setPublicSignups(Boolean(data.publicSignups))
        setHomePageEnabled(data.homePageEnabled ?? true)
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Something went wrong")
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    void loadConfig()

    return () => {
      mounted = false
    }
  }, [navigate])

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const res = await fetch("/api/instance-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ domain, publicSignups, homePageEnabled, onboardingComplete: true }),
      })

      if (!res.ok) {
        throw new Error(`Setup failed (${res.status})`)
      }

      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminShell
      activeItem="onboarding"
      title="Instance setup"
      description="Configure your Orbit deployment"
    >
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center gap-2 text-muted-foreground">
            <HugeiconsIcon icon={GlobalIcon} className="size-3.5" />
            <span className="text-[0.625rem] font-medium uppercase tracking-wider">
              Instance configuration
            </span>
          </div>
          <CardTitle className="text-base">
            Set up your Orbit instance
          </CardTitle>
          <CardDescription>
            Configure the core settings for your deployment. You can change
            these later from the settings page.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Loading instance config...
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="domain">Domain</Label>
            <Input
              id="domain"
              type="text"
              placeholder="orbit.example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The domain this Orbit instance is accessible on.
            </p>
          </div>

          <Separator />

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="public-signups">Public signups</Label>
              <p className="text-xs text-muted-foreground">
                Allow anyone to create an account on this instance. When
                disabled, users must be invited by an admin.
              </p>
            </div>
            <Switch
              id="public-signups"
              checked={publicSignups}
              onCheckedChange={setPublicSignups}
            />
          </div>

          <Separator />

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="home-page-enabled">Homepage enabled</Label>
              <p className="text-xs text-muted-foreground">
                Toggle whether the public landing page should be shown.
              </p>
            </div>
            <Switch
              id="home-page-enabled"
              checked={homePageEnabled}
              onCheckedChange={setHomePageEnabled}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTitle>Failed to save</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="justify-end">
          <Button size="lg" disabled={saving || loading} onClick={handleSave}>
            {saving && <Spinner className="size-3.5" />}
            {saving ? "Saving…" : "Save & continue"}
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={saved}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-5 text-purple" />
              Instance configured
            </DialogTitle>
            <DialogDescription>
              Your Orbit instance settings have been saved. To complete setup, please sign out and sign back in using an OAuth provider (e.g. Discord, GitHub, Google). The next account to log in will automatically be granted admin access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              size="lg"
              onClick={async () => {
                const { authClient } = await import("@/lib/auth-client")
                await authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      window.location.assign("/login")
                    },
                  },
                })
              }}
            >
              Sign out & continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  )
}
