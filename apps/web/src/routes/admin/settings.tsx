import { useEffect, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

import { AdminShell } from "@/components/features/admin/shell"
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
import { Input } from "@/components/input"
import { Label } from "@/components/label"
import { Spinner } from "@/components/spinner"
import { toast } from "sonner"

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettingsPage,
})

interface RateLimitTier {
  apiRequestsPerMinute: number
  apiRequestsPerMonth: number
  networkEgressBytesPerMonth: number | null
  storageBytesMax: number | null
}

interface InstanceConfig {
  rateLimitSettings?: {
    free: RateLimitTier
    pro: RateLimitTier
  }
}

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text()
  return text ? (JSON.parse(text) as T) : null
}

function AdminSettingsPage() {
  const [config, setConfig] = useState<InstanceConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [freePerMinute, setFreePerMinute] = useState("60")
  const [freePerMonth, setFreePerMonth] = useState("10000")
  const [proPerMinute, setProPerMinute] = useState("600")
  const [proPerMonth, setProPerMonth] = useState("100000")

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const res = await fetch("/api/v1/admin/instance-config", {
          credentials: "include",
        })
        const data = await readJson<InstanceConfig>(res)
        if (mounted && data) {
          setConfig(data)
          setFreePerMinute(String(data.rateLimitSettings?.free.apiRequestsPerMinute ?? 60))
          setFreePerMonth(String(data.rateLimitSettings?.free.apiRequestsPerMonth ?? 10000))
          setProPerMinute(String(data.rateLimitSettings?.pro.apiRequestsPerMinute ?? 600))
          setProPerMonth(String(data.rateLimitSettings?.pro.apiRequestsPerMonth ?? 100000))
        }
      } catch (err) {
        console.error("Failed to load instance config", err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()
    return () => {
      mounted = false
    }
  }, [])

  async function handleSaveRateLimits(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const updated: InstanceConfig = {
        ...config,
        rateLimitSettings: {
          free: {
            apiRequestsPerMinute: Number(freePerMinute) || 60,
            apiRequestsPerMonth: Number(freePerMonth) || 10000,
            networkEgressBytesPerMonth: null,
            storageBytesMax: null,
          },
          pro: {
            apiRequestsPerMinute: Number(proPerMinute) || 600,
            apiRequestsPerMonth: Number(proPerMonth) || 100000,
            networkEgressBytesPerMonth: null,
            storageBytesMax: null,
          },
        },
      }

      const res = await fetch("/api/v1/admin/instance-config", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      })

      if (!res.ok) {
        throw new Error(`Save failed (${res.status})`)
      }

      const data = await readJson<InstanceConfig>(res)
      if (data) setConfig(data)
      toast.success("Rate limits saved.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminShell
      activeItem="settings"
      title="Instance settings"
      description="General global configuration for this Orbit instance."
    >
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Settings</Badge>
              <Badge variant="outline">Global</Badge>
            </div>
            <CardTitle>Admin settings</CardTitle>
            <CardDescription>
              This section is for instance-wide controls. Email templates now
              live on their own dedicated admin page.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Use this area for shared platform settings that are not
              tenant-specific.
            </p>
            <p>
              The email configuration has been moved out so it is easier to find.
            </p>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full justify-between"
              render={<Link to="/admin/email" />}
            >
              Open email settings
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rate Limits</CardTitle>
            <CardDescription>
              Configure per-tier API rate limits. These are the defaults for all workspaces.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner className="size-4" />
                Loading rate limits...
              </div>
            ) : (
              <form onSubmit={handleSaveRateLimits} className="space-y-6">
                <div className="space-y-4">
                  <p className="text-sm font-medium">Free tier</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="free-per-minute">Requests / minute</Label>
                      <Input
                        id="free-per-minute"
                        type="number"
                        min={1}
                        value={freePerMinute}
                        onChange={(e) => setFreePerMinute(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="free-per-month">Requests / month</Label>
                      <Input
                        id="free-per-month"
                        type="number"
                        min={1}
                        value={freePerMonth}
                        onChange={(e) => setFreePerMonth(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-sm font-medium">Pro tier</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="pro-per-minute">Requests / minute</Label>
                      <Input
                        id="pro-per-minute"
                        type="number"
                        min={1}
                        value={proPerMinute}
                        onChange={(e) => setProPerMinute(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pro-per-month">Requests / month</Label>
                      <Input
                        id="pro-per-month"
                        type="number"
                        min={1}
                        value={proPerMonth}
                        onChange={(e) => setProPerMonth(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={saving} className="gap-2">
                    {saving && <Spinner className="size-3" />}
                    Save rate limits
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  )
}
