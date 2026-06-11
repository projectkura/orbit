import { useCallback, useEffect, useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  CodesandboxIcon,
  Mail01Icon,
  RefreshIcon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"

import { AdminShell } from "@/components/features/admin/shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert"
import { Badge } from "@/components/badge"
import { Button } from "@/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog"
import { FieldDescription, FieldError } from "@/components/field"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/table"
import { apiFetch } from "@/lib/api-client"
import {
  defaultInstanceConfig,
  EMAIL_EVENT_DEFINITIONS,
  EMAIL_EVENT_KEYS,
  normalizeInstanceConfig,
  ORBIT_EMAIL_VARIABLES,
  type EmailEventConfig,
  type EmailEventKey,
  type InstanceConfig,
  type OrbitEmailVariableKey,
  type ResendTemplateInfo,
  type ResendTemplateVariable,
} from "@orbit/shared/instance-config"

export const Route = createFileRoute("/admin/email")({
  component: AdminEmailPage,
})

const UNMAPPED = "__unmapped__" as const

type EventState = {
  templateInfo: ResendTemplateInfo | null
  fetchingTemplate: boolean
  fetchError: string | null
}

const initialEventState: EventState = {
  templateInfo: null,
  fetchingTemplate: false,
  fetchError: null,
}

function AdminEmailPage() {
  const [config, setConfig] = useState<InstanceConfig>(defaultInstanceConfig)
  const [resendConfigured, setResendConfigured] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [openEvent, setOpenEvent] = useState<EmailEventKey | null>(null)
  const [eventStates, setEventStates] = useState<
    Record<EmailEventKey, EventState>
  >(() =>
    EMAIL_EVENT_KEYS.reduce(
      (acc, key) => {
        acc[key] = { ...initialEventState }
        return acc
      },
      {} as Record<EmailEventKey, EventState>
    )
  )

  const loadAll = useCallback(async () => {
    try {
      setLoadError(null)
      setLoading(true)
      const [configRes, statusRes] = await Promise.all([
        apiFetch("/api/instance-config"),
        apiFetch("/api/email-status"),
      ])

      if (!configRes.ok) {
        throw new Error(`Failed to load config (${configRes.status})`)
      }

      const data = (await configRes.json()) as Partial<InstanceConfig>
      const status = statusRes.ok
        ? ((await statusRes.json()) as { resendApiKeyConfigured?: boolean })
        : null

      setConfig(normalizeInstanceConfig(data))
      setResendConfigured(Boolean(status?.resendApiKeyConfigured))
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const eventErrors = useMemo(() => {
    const errors: Partial<Record<EmailEventKey, string>> = {}
    for (const key of EMAIL_EVENT_KEYS) {
      const cfg = config.emailSettings[key]
      if (!cfg.enabled) continue
      if (!cfg.templateId.trim()) {
        errors[key] = "Template ID required"
        continue
      }
      if (!cfg.fromAddress.trim()) {
        errors[key] = "From address required"
      }
    }
    return errors
  }, [config.emailSettings])

  const canSave = !loading && Object.keys(eventErrors).length === 0

  function updateEvent(key: EmailEventKey, patch: Partial<EmailEventConfig>) {
    setSaved(false)
    setConfig((prev) => ({
      ...prev,
      emailSettings: {
        ...prev.emailSettings,
        [key]: { ...prev.emailSettings[key], ...patch },
      },
    }))
  }

  function setMapping(
    key: EmailEventKey,
    resendKey: string,
    orbitKey: OrbitEmailVariableKey | null
  ) {
    setConfig((prev) => {
      const event = prev.emailSettings[key]
      const next = { ...event.variableMappings }
      if (orbitKey === null) {
        delete next[resendKey]
      } else {
        next[resendKey] = orbitKey
      }
      return {
        ...prev,
        emailSettings: {
          ...prev.emailSettings,
          [key]: { ...event, variableMappings: next },
        },
      }
    })
  }

  async function handleFetchTemplate(key: EmailEventKey) {
    const templateId = config.emailSettings[key].templateId.trim()
    if (!templateId) {
      setEventStates((s) => ({
        ...s,
        [key]: { ...s[key], fetchError: "Enter a template ID first." },
      }))
      return
    }

    setEventStates((s) => ({
      ...s,
      [key]: { ...s[key], fetchingTemplate: true, fetchError: null },
    }))

    try {
      const res = await apiFetch(
        `/api/resend-template/${encodeURIComponent(templateId)}`
      )
      if (!res.ok) {
        const body = await safeJson(res)
        throw new Error(body?.message ?? `Failed to load template (${res.status})`)
      }
      const info = (await res.json()) as ResendTemplateInfo
      setEventStates((s) => ({
        ...s,
        [key]: { templateInfo: info, fetchingTemplate: false, fetchError: null },
      }))
    } catch (err) {
      setEventStates((s) => ({
        ...s,
        [key]: {
          ...s[key],
          fetchingTemplate: false,
          fetchError:
            err instanceof Error ? err.message : "Failed to load template.",
        },
      }))
    }
  }

  async function handleSave(configToSave?: InstanceConfig) {
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      const payload = configToSave || config
      const res = await apiFetch("/api/instance-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`Save failed (${res.status})`)
      const data = (await res.json()) as Partial<InstanceConfig>
      setConfig(normalizeInstanceConfig(data))
      setSaved(true)
      setOpenEvent(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminShell
      activeItem="email"
      title="Email"
      description="Manage transactional email templates."
    >
      <div className="flex flex-col gap-4">
        {/* Resend key warning */}
        {resendConfigured === false && (
          <Alert variant="destructive">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5" />
            <AlertTitle>Resend API key not configured</AlertTitle>
            <AlertDescription>
              Set <code className="font-mono">RESEND_API_KEY</code> on the API
              service to enable email delivery.
            </AlertDescription>
          </Alert>
        )}

        {/* Load error */}
        {loadError && (
          <Alert variant="destructive">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5" />
            <AlertTitle>Failed to load</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {/* Event list */}
        <div className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/8">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner className="size-4" />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {EMAIL_EVENT_KEYS.map((key) => {
                const def = EMAIL_EVENT_DEFINITIONS[key]
                const cfg = config.emailSettings[key]
                const hasError = Boolean(eventErrors[key])
                // An event is "complete" if it has both templateId and fromAddress
                const isComplete =
                  cfg.templateId.trim().length > 0 &&
                  cfg.fromAddress.trim().length > 0

                return (
                  <li key={key}>
                    {/* Use a plain div — switch lives OUTSIDE the clickable button */}
                    <div className="flex items-center hover:bg-muted/40 transition-colors">
                      {/* Clickable region — opens modal */}
                      <button
                        type="button"
                        aria-label={`Configure ${def.title}`}
                        onClick={() => setOpenEvent(key)}
                        className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3.5 text-left"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <HugeiconsIcon icon={Mail01Icon} className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-tight">
                            {def.title}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {def.description}
                          </p>
                        </div>
                        {hasError && cfg.enabled && (
                          <Badge
                            variant="destructive"
                            className="shrink-0 text-[0.65rem]"
                          >
                            Incomplete
                          </Badge>
                        )}
                      </button>

                      {/* Switch — isolated outside the button, no propagation issues */}
                      <div className="shrink-0 px-4">
                        <Switch
                          id={`${key}-toggle`}
                          checked={cfg.enabled}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              // Turning ON: if config is incomplete, open settings instead
                              if (!isComplete) {
                                setOpenEvent(key)
                                return
                              }
                            }
                            updateEvent(key, { enabled: checked === true })
                          }}
                        />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>


        {/* Save row */}
          {!loading && (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                {saved && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <HugeiconsIcon
                      icon={CheckmarkCircle02Icon}
                      className="size-3.5"
                    />
                    Saved
                  </span>
                )}
                {saveError && (
                  <span className="flex items-center gap-1 text-destructive">
                    <HugeiconsIcon icon={AlertCircleIcon} className="size-3.5" />
                    {saveError}
                  </span>
                )}
              </div>
              <Button
                className="w-24"
                disabled={saving || loading || !canSave}
                 onClick={() => {
                   // Build config with auto-enabled events
                   const updatedConfig = { ...config }
                   const updatedEmailSettings = { ...config.emailSettings }
                   
                   for (const key of EMAIL_EVENT_KEYS) {
                     const cfg = config.emailSettings[key]
                     if (!cfg.enabled && cfg.templateId.trim() && cfg.fromAddress.trim()) {
                       updatedEmailSettings[key] = { ...cfg, enabled: true }
                     }
                   }
                   
                   updatedConfig.emailSettings = updatedEmailSettings
                   void handleSave(updatedConfig)
                 }}
              >
                {saving ? <Spinner className="size-3.5" /> : "Save"}
              </Button>
            </div>
          )}
      </div>

      {/* Configure modal */}
      {openEvent && (
        <Dialog
          open={openEvent !== null}
          onOpenChange={(open) => {
            if (!open) setOpenEvent(null)
          }}
        >
          <DialogContent className="sm:max-w-lg">
            <ConfigModal
              eventKey={openEvent}
              config={config.emailSettings[openEvent]}
              state={eventStates[openEvent]}
              error={eventErrors[openEvent]}
              resendConfigured={resendConfigured ?? false}
              onChange={(patch) => updateEvent(openEvent, patch)}
              onMapping={(rk, ok) => setMapping(openEvent, rk, ok)}
              onFetch={() => void handleFetchTemplate(openEvent)}
              onClose={() => setOpenEvent(null)}
              onSave={() => void handleSave()}
              saving={saving}
              saveError={saveError}
            />
          </DialogContent>
        </Dialog>
      )}
    </AdminShell>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

type ConfigModalProps = {
  eventKey: EmailEventKey
  config: EmailEventConfig
  state: EventState
  error?: string
  resendConfigured: boolean
  onChange: (patch: Partial<EmailEventConfig>) => void
  onMapping: (resendKey: string, orbitKey: OrbitEmailVariableKey | null) => void
  onFetch: () => void
  onClose: () => void
  onSave: () => void
  saving: boolean
  saveError: string | null
}

function ConfigModal({
  eventKey,
  config,
  state,
  error,
  resendConfigured,
  onChange,
  onMapping,
  onFetch,
  onClose,
  onSave,
  saving,
  saveError,
}: ConfigModalProps) {
  const definition = EMAIL_EVENT_DEFINITIONS[eventKey]

  useEffect(() => {
    // Auto-fetch if we have a template ID, resend is configured, and we haven't fetched info yet
    if (config.templateId.trim() && resendConfigured && !state.templateInfo && !state.fetchingTemplate && !state.fetchError) {
      onFetch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventKey])

  return (
    <>
      <DialogHeader>
        <DialogTitle>{definition.title}</DialogTitle>
        <p className="text-xs text-muted-foreground">{definition.description}</p>
      </DialogHeader>

      {/* Fields */}
      <div className="flex flex-col gap-4">
        {/* Template ID */}
        <div className="space-y-1.5">
          <Label htmlFor={`${eventKey}-template-id`}>Template ID</Label>
          <div className="flex gap-2">
            <Input
              id={`${eventKey}-template-id`}
              value={config.templateId}
              placeholder="34a080c9-b17d-4187-ad80-5af20266e535"
              onChange={(e) => onChange({ templateId: e.currentTarget.value })}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                !config.templateId.trim() ||
                state.fetchingTemplate ||
                !resendConfigured
              }
              onClick={onFetch}
            >
              {state.fetchingTemplate ? (
                <Spinner className="size-3" />
              ) : (
                <HugeiconsIcon icon={RefreshIcon} className="size-3" />
              )}
              {state.fetchingTemplate ? "Fetching…" : "Fetch"}
            </Button>
          </div>
          <FieldDescription>
            Found in your Resend dashboard under Templates.
          </FieldDescription>
          {state.fetchError && <FieldError>{state.fetchError}</FieldError>}
        </div>

        {/* From address */}
        <div className="space-y-1.5">
          <Label htmlFor={`${eventKey}-from`}>From address</Label>
          <Input
            id={`${eventKey}-from`}
            value={config.fromAddress}
            placeholder="Orbit <hello@orbit.example>"
            onChange={(e) => onChange({ fromAddress: e.currentTarget.value })}
          />
          <FieldDescription>
            Must be a domain verified in Resend.
          </FieldDescription>
        </div>

        {error && <FieldError>{error}</FieldError>}

        {/* Variable mapping */}
        <VariableMappingSection
          eventKey={eventKey}
          templateInfo={state.templateInfo}
          mappings={config.variableMappings}
          availableOrbitVariables={definition.availableVariables}
          onMapping={onMapping}
          disabled={false}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="text-xs text-destructive">
          {saveError ?? null}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="w-24" onClick={onClose}>
            Cancel
          </Button>
          <Button className="w-24" disabled={saving} onClick={onSave}>
            {saving ? <Spinner className="size-3.5" /> : "Save"}
          </Button>
        </div>
      </div>
    </>
  )
}

// ─── Variable mapping ─────────────────────────────────────────────────────────

type VariableMappingSectionProps = {
  eventKey: EmailEventKey
  templateInfo: ResendTemplateInfo | null
  mappings: Record<string, OrbitEmailVariableKey>
  availableOrbitVariables: ReadonlyArray<OrbitEmailVariableKey>
  onMapping: (resendKey: string, orbitKey: OrbitEmailVariableKey | null) => void
  disabled: boolean
}

function VariableMappingSection({
  eventKey,
  templateInfo,
  mappings,
  availableOrbitVariables,
  onMapping,
  disabled,
}: VariableMappingSectionProps) {
  const variables = templateInfo?.variables ?? []

  if (!templateInfo) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 py-6 text-center">
        <HugeiconsIcon
          icon={CodesandboxIcon}
          className="size-4 text-muted-foreground"
        />
        <div>
          <p className="text-xs font-medium">No template loaded</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Enter a template ID and click Fetch to map variables.
          </p>
        </div>
      </div>
    )
  }

  if (variables.length === 0) {
    return (
      <Alert>
        <HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
        <AlertTitle>No variables</AlertTitle>
        <AlertDescription>
          {templateInfo.name
            ? `"${templateInfo.name}" has no variables — Orbit sends it as-is.`
            : "This template has no variables — Orbit sends it as-is."}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Variable mapping</p>
        {templateInfo.name && (
          <p className="text-xs text-muted-foreground">{templateInfo.name}</p>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Resend variable</TableHead>
              <TableHead className="w-[60%]">Orbit variable</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variables.map((variable: ResendTemplateVariable) => {
              const mapped = mappings[variable.key] ?? null
              return (
                <TableRow key={variable.key}>
                  <TableCell className="font-mono text-xs">
                    {variable.key}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={mapped ?? UNMAPPED}
                      onValueChange={(value) => {
                        const next = String(value)
                        if (next === UNMAPPED) {
                          onMapping(variable.key, null)
                          return
                        }
                        onMapping(variable.key, next as OrbitEmailVariableKey)
                      }}
                      disabled={disabled}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-label={`Map ${variable.key}`}
                      >
                        <SelectValue placeholder="Choose variable…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNMAPPED}>
                          <span className="text-muted-foreground">
                            Don't map
                          </span>
                        </SelectItem>
                        {availableOrbitVariables.map((orbitKey) => (
                          <SelectItem key={orbitKey} value={orbitKey}>
                            {ORBIT_EMAIL_VARIABLES[orbitKey].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground" id={`${eventKey}-hint`}>
        Unmapped variables fall back to the template default, or Resend will
        refuse to send.
      </p>
    </div>
  )
}

async function safeJson(res: Response): Promise<{ message?: string } | null> {
  try {
    return (await res.json()) as { message?: string }
  } catch {
    return null
  }
}
