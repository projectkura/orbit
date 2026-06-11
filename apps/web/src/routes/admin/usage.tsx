import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import type { InstanceConfig } from "@orbit/shared"
import { STORAGE_QUOTA_DEFAULTS, UPLOAD_SETTINGS_DEFAULTS } from "@orbit/shared"
import { HugeiconsIcon } from "@hugeicons/react"
import { Folder01Icon, RefreshIcon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { AdminShell } from "@/components/features/admin/shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/select"
import { Spinner } from "@/components/spinner"
import { Switch } from "@/components/switch"

export const Route = createFileRoute("/admin/usage")({
  component: AdminUsagePage,
})

type Unit = "MB" | "GB"

type QuotaForm = {
  freeValue: string
  freeUnit: Unit
  proValue: string
  proUnit: Unit
  uploadsEnabled: boolean
  workspaceImageUploadsEnabled: boolean
  maxPendingUploadsPerWorkspace: string
  intentTtlSeconds: string
}

function bytesToFormValue(bytes: number): { value: string; unit: Unit } {
  const gb = bytes / 1024 / 1024 / 1024
  if (Number.isInteger(gb) || gb >= 1) {
    return { value: String(Number(gb.toFixed(2))), unit: "GB" }
  }
  return { value: String(Math.round(bytes / 1024 / 1024)), unit: "MB" }
}

function toBytes(value: string, unit: Unit) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return null
  const multiplier = unit === "GB" ? 1024 * 1024 * 1024 : 1024 * 1024
  return Math.round(number * multiplier)
}

function formFromConfig(config: InstanceConfig): QuotaForm {
  const free = bytesToFormValue(config.usageSettings.storage.freeBytes)
  const pro = bytesToFormValue(config.usageSettings.storage.proBytes)
  return {
    freeValue: free.value,
    freeUnit: free.unit,
    proValue: pro.value,
    proUnit: pro.unit,
    uploadsEnabled: config.uploadSettings.uploadsEnabled,
    workspaceImageUploadsEnabled:
      config.uploadSettings.workspaceImageUploadsEnabled,
    maxPendingUploadsPerWorkspace: String(
      config.uploadSettings.maxPendingUploadsPerWorkspace
    ),
    intentTtlSeconds: String(config.uploadSettings.intentTtlSeconds),
  }
}

function AdminUsagePage() {
  const [config, setConfig] = useState<InstanceConfig | null>(null)
  const [form, setForm] = useState<QuotaForm>(() => ({
    freeValue: "500",
    freeUnit: "MB",
    proValue: "5",
    proUnit: "GB",
    uploadsEnabled: true,
    workspaceImageUploadsEnabled: true,
    maxPendingUploadsPerWorkspace: "3",
    intentTtlSeconds: "600",
  }))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadConfig() {
      try {
        const response = await fetch("/api/instance-config", {
          credentials: "include",
        })

        if (!response.ok) {
          throw new Error(`Failed to load usage settings (${response.status})`)
        }

        const payload = (await response.json()) as InstanceConfig
        if (mounted) {
          setConfig(payload)
          setForm(formFromConfig(payload))
        }
      } catch (caughtError) {
        if (mounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load usage settings."
          )
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadConfig()

    return () => {
      mounted = false
    }
  }, [])

  async function saveUsageSettings() {
    if (!config) return

    const freeBytes = toBytes(form.freeValue, form.freeUnit)
    const proBytes = toBytes(form.proValue, form.proUnit)
    const maxPendingUploadsPerWorkspace = Number(form.maxPendingUploadsPerWorkspace)
    const intentTtlSeconds = Number(form.intentTtlSeconds)

    if (!freeBytes || !proBytes) {
      setError("Enter positive quota values.")
      return
    }

    if (!Number.isInteger(maxPendingUploadsPerWorkspace) || maxPendingUploadsPerWorkspace < 1) {
      setError("Pending upload cap must be a whole number greater than zero.")
      return
    }

    if (!Number.isInteger(intentTtlSeconds) || intentTtlSeconds < 60) {
      setError("Upload intent TTL must be at least 60 seconds.")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const nextConfig: InstanceConfig = {
        ...config,
        usageSettings: {
          ...config.usageSettings,
          storage: { freeBytes, proBytes },
        },
        uploadSettings: {
          ...config.uploadSettings,
          uploadsEnabled: form.uploadsEnabled,
          workspaceImageUploadsEnabled: form.workspaceImageUploadsEnabled,
          maxPendingUploadsPerWorkspace,
          intentTtlSeconds,
          staleUploadGraceSeconds: Math.max(
            config.uploadSettings.staleUploadGraceSeconds,
            intentTtlSeconds
          ),
        },
      }
      const response = await fetch("/api/instance-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(nextConfig),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string }
          | null
        throw new Error(body?.message ?? `Failed to save (${response.status})`)
      }

      const saved = (await response.json()) as InstanceConfig
      setConfig(saved)
      setForm(formFromConfig(saved))
      toast.success("Usage settings saved")
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to save usage settings."
      )
    } finally {
      setSaving(false)
    }
  }

  function resetDefaults() {
    const free = bytesToFormValue(STORAGE_QUOTA_DEFAULTS.free)
    const pro = bytesToFormValue(STORAGE_QUOTA_DEFAULTS.pro)
    setForm({
      freeValue: free.value,
      freeUnit: free.unit,
      proValue: pro.value,
      proUnit: pro.unit,
      uploadsEnabled: UPLOAD_SETTINGS_DEFAULTS.uploadsEnabled,
      workspaceImageUploadsEnabled:
        UPLOAD_SETTINGS_DEFAULTS.workspaceImageUploadsEnabled,
      maxPendingUploadsPerWorkspace: String(
        UPLOAD_SETTINGS_DEFAULTS.maxPendingUploadsPerWorkspace
      ),
      intentTtlSeconds: String(UPLOAD_SETTINGS_DEFAULTS.intentTtlSeconds),
    })
  }

  return (
    <AdminShell
      activeItem="usage"
      title="Usage"
      description="Workspace storage defaults and subscription limits."
    >
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-muted-foreground">
            <HugeiconsIcon icon={Folder01Icon} className="size-4" />
            <span className="text-[0.625rem] font-medium uppercase tracking-wider">
              General storage
            </span>
          </div>
          <CardTitle>Workspace storage limits</CardTitle>
          <CardDescription>
            Configure the default quota for Free workspaces and the higher quota
            unlocked by Pro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Loading usage settings...
            </div>
          ) : null}

          <QuotaRow
            label="Free"
            value={form.freeValue}
            unit={form.freeUnit}
            disabled={loading || saving}
            onValueChange={(freeValue) =>
              setForm((current) => ({ ...current, freeValue }))
            }
            onUnitChange={(freeUnit) =>
              setForm((current) => ({ ...current, freeUnit }))
            }
          />
          <QuotaRow
            label="Pro"
            value={form.proValue}
            unit={form.proUnit}
            disabled={loading || saving}
            onValueChange={(proValue) =>
              setForm((current) => ({ ...current, proValue }))
            }
            onUnitChange={(proUnit) =>
              setForm((current) => ({ ...current, proUnit }))
            }
          />

          <div className="grid gap-4 rounded-md border border-border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="uploads-enabled">Uploads enabled</Label>
                <p className="text-sm text-muted-foreground">
                  Block all new upload intents across the instance.
                </p>
              </div>
              <Switch
                id="uploads-enabled"
                checked={form.uploadsEnabled}
                disabled={loading || saving}
                onCheckedChange={(uploadsEnabled) =>
                  setForm((current) => ({ ...current, uploadsEnabled }))
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="workspace-image-uploads-enabled">
                  Workspace image uploads
                </Label>
                <p className="text-sm text-muted-foreground">
                  Allow new workspace logo/image upload intents.
                </p>
              </div>
              <Switch
                id="workspace-image-uploads-enabled"
                checked={form.workspaceImageUploadsEnabled}
                disabled={loading || saving}
                onCheckedChange={(workspaceImageUploadsEnabled) =>
                  setForm((current) => ({
                    ...current,
                    workspaceImageUploadsEnabled,
                  }))
                }
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="max-pending-uploads">
                  Max pending uploads per workspace
                </Label>
                <Input
                  id="max-pending-uploads"
                  type="number"
                  min="1"
                  step="1"
                  value={form.maxPendingUploadsPerWorkspace}
                  disabled={loading || saving}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      maxPendingUploadsPerWorkspace: event.currentTarget.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="intent-ttl">Upload intent TTL (seconds)</Label>
                <Input
                  id="intent-ttl"
                  type="number"
                  min="60"
                  step="60"
                  value={form.intentTtlSeconds}
                  disabled={loading || saving}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      intentTtlSeconds: event.currentTarget.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Usage settings unavailable</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2 sm:w-auto"
            onClick={resetDefaults}
            disabled={saving}
          >
            <HugeiconsIcon icon={RefreshIcon} className="size-4" />
            Reset defaults
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={() => void saveUsageSettings()}
            disabled={loading || saving}
          >
            {saving && <Spinner className="size-3.5" />}
            {saving ? "Saving..." : "Save limits"}
          </Button>
        </CardFooter>
      </Card>
    </AdminShell>
  )
}

function QuotaRow({
  label,
  value,
  unit,
  disabled,
  onValueChange,
  onUnitChange,
}: {
  label: string
  value: string
  unit: Unit
  disabled: boolean
  onValueChange: (value: string) => void
  onUnitChange: (unit: Unit) => void
}) {
  return (
    <div className="grid gap-3 rounded-md border border-border p-4 md:grid-cols-[1fr_12rem] md:items-end">
      <div className="space-y-1.5">
        <Label htmlFor={`${label}-quota`}>{label}</Label>
        <Input
          id={`${label}-quota`}
          type="number"
          min="1"
          step="0.1"
          value={value}
          disabled={disabled}
          onChange={(event) => onValueChange(event.currentTarget.value)}
        />
      </div>
      <Select
        value={unit}
        disabled={disabled}
        onValueChange={(next) => onUnitChange(next as Unit)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="MB">MB</SelectItem>
          <SelectItem value="GB">GB</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
