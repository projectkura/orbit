import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Copy01Icon,
  CopyCheckIcon,
  Delete01Icon,
  Key01Icon,
  Time01Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/button"
import { Input } from "@/components/input"
import { Label } from "@/components/label"
import { Spinner } from "@/components/spinner"
import { Badge } from "@/components/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert"
import { NativeSelect, NativeSelectOption } from "@/components/native-select"

export const Route = createFileRoute("/app/$identifier/api-keys")({
  component: WorkspaceApiKeysPage,
})

interface ApiKeySummary {
  id: string
  name: string
  type: string
  keyPreview: string
  createdAt: string
  lastUsedAt: string | null
}

interface CreatedApiKey extends ApiKeySummary {
  secretKey: string
}

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text()
  return text ? (JSON.parse(text) as T) : null
}

function WorkspaceApiKeysPage() {
  const { identifier } = Route.useParams()
  const [keys, setKeys] = useState<ApiKeySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Creation State
  const [createOpen, setCreateOpen] = useState(false)
  const [keyName, setKeyName] = useState("")
  const [keyType, setKeyType] = useState<"voyager_fivem" | "general">("general")
  const [creating, setCreating] = useState(false)

  // Exposure State
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedConfig, setCopiedConfig] = useState(false)

  // Revocation State
  const [revokeKey, setRevokeKey] = useState<ApiKeySummary | null>(null)
  const [revoking, setRevoking] = useState(false)

  const loadKeys = async (mounted = true) => {
    try {
      const response = await apiFetch(`/api/workspaces/${identifier}/api-keys`)
      if (!response.ok) {
        const body = await readJson<{ message?: string }>(response)
        throw new Error(body?.message ?? "Failed to load API keys.")
      }
      const data = await readJson<{ keys: ApiKeySummary[] }>(response)
      if (mounted && data) {
        setKeys(data.keys)
      }
    } catch (err) {
      if (mounted) {
        setError(err instanceof Error ? err.message : "Failed to load API keys.")
      }
    } finally {
      if (mounted) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    let mounted = true
    void loadKeys(mounted)
    return () => {
      mounted = false
    }
  }, [identifier])

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!keyName.trim()) {
      toast.error("Please enter a name for the API key.")
      return
    }

    setCreating(true)
    try {
      const response = await apiFetch(`/api/workspaces/${identifier}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: keyName.trim(),
          type: keyType,
        }),
      })

      if (!response.ok) {
        const body = await readJson<{ message?: string }>(response)
        throw new Error(body?.message ?? "Failed to create API key.")
      }

      const newKey = await readJson<CreatedApiKey>(response)
      if (newKey) {
        setCreatedKey(newKey)
        setKeyName("")
        setCreateOpen(false)
        toast.success("API key successfully generated.")
        void loadKeys(true)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate key.")
    } finally {
      setCreating(false)
    }
  }

  const handleRevokeKey = async () => {
    if (!revokeKey) return

    setRevoking(true)
    try {
      const response = await apiFetch(
        `/api/workspaces/${identifier}/api-keys/${revokeKey.id}`,
        { method: "DELETE" }
      )

      if (!response.ok) {
        const body = await readJson<{ message?: string }>(response)
        throw new Error(body?.message ?? "Failed to revoke API key.")
      }

      toast.success(`API Key "${revokeKey.name}" has been revoked.`)
      setRevokeKey(null)
      void loadKeys(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke key.")
    } finally {
      setRevoking(false)
    }
  }

  const handleCopyKey = (text: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedKey(true)
    toast.success("API key copied to clipboard.")
    setTimeout(() => setCopiedKey(false), 2000)
  }

  const handleCopyConfig = (text: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedConfig(true)
    toast.success("Server configuration instruction copied.")
    setTimeout(() => setCopiedConfig(false), 2000)
  }

  const voyagerKeys = keys.filter((k) => k.type === "voyager_fivem")
  const generalKeys = keys.filter((k) => k.type === "general")

  const lastUsedKey = keys
    .filter((k) => k.lastUsedAt)
    .sort((a, b) => new Date(b.lastUsedAt!).getTime() - new Date(a.lastUsedAt!).getTime())[0]

  return (
    <div className="-m-4 flex flex-col md:-m-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 border-b border-border px-4 py-6 sm:flex-row sm:items-start sm:justify-between md:px-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">API Keys</h1>
          <p className="text-sm text-muted-foreground">
            Secure credentials for authenticating external server integrations.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="shrink-0 gap-2">
          <HugeiconsIcon icon={Key01Icon} className="size-4" strokeWidth={2} />
          Generate key
        </Button>
      </div>

      {/* Stats bar */}
      {!loading && !error && keys.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3 text-xs text-muted-foreground md:px-6">
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-green-500" />
            {keys.length} active {keys.length === 1 ? "key" : "keys"}
          </span>
          <span className="text-border">·</span>
          <span>{voyagerKeys.length > 0 && generalKeys.length > 0 ? "Mixed" : voyagerKeys.length > 0 ? "Voyager (FiveM)" : generalKeys.length > 0 ? "General API" : "No keys"}</span>
          {lastUsedKey?.lastUsedAt && (
            <>
              <span className="text-border">·</span>
              <span className="flex items-center gap-1">
                <HugeiconsIcon icon={Time01Icon} className="size-3" strokeWidth={2} />
                Last used {new Date(lastUsedKey.lastUsedAt).toLocaleDateString()}
              </span>
            </>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="px-4 py-6 md:px-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Loading API keys...
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>Error loading keys</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/50">
              <HugeiconsIcon icon={Key01Icon} className="size-5 text-muted-foreground" strokeWidth={2} />
            </div>
            <h3 className="font-medium text-foreground">No API keys</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Generate your first key to connect external services or the public API to this workspace.
            </p>
            <Button onClick={() => setCreateOpen(true)} variant="outline" className="mt-6 gap-2">
              <HugeiconsIcon icon={Key01Icon} className="size-4" strokeWidth={2} />
              Generate key
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {voyagerKeys.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Voyager (FiveM)</p>
                <p className="text-xs text-muted-foreground">
                  Shared secrets authorizing FiveM Voyager resources to communicate with Orbit.
                </p>
              </div>
            )}

            {voyagerKeys.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-border">
              {voyagerKeys.map((key, i) => (
                <div
                  key={key.id}
                  className={cn(
                    "flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40",
                    i !== voyagerKeys.length - 1 && "border-b border-border"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <HugeiconsIcon icon={Key01Icon} className="size-3.5 text-muted-foreground" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{key.name}</p>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          Active
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                          {key.keyPreview ?? "orb_voy_..."}••••••
                        </code>
                        <span className="text-border">·</span>
                        <span>{new Date(key.createdAt).toLocaleDateString()}</span>
                        {key.lastUsedAt ? (
                          <>
                            <span className="text-border">·</span>
                            <span>Used {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-border">·</span>
                            <span>Never used</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 gap-1.5 text-muted-foreground hover:text-destructive"
                    onClick={() => setRevokeKey(key)}
                  >
                    <HugeiconsIcon icon={Delete01Icon} className="size-3.5" strokeWidth={2} />
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
            )}

            {generalKeys.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">General API Keys</p>
                <p className="text-xs text-muted-foreground">
                  Keys for public API access, rate-limited per workspace.
                </p>
              </div>
            )}

            {generalKeys.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-border">
              {generalKeys.map((key, i) => (
                <div
                  key={key.id}
                  className={cn(
                    "flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40",
                    i !== generalKeys.length - 1 && "border-b border-border"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <HugeiconsIcon icon={Key01Icon} className="size-3.5 text-muted-foreground" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{key.name}</p>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          Active
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                          {key.keyPreview ?? "orb_api_..."}••••••
                        </code>
                        <span className="text-border">·</span>
                        <span>{new Date(key.createdAt).toLocaleDateString()}</span>
                        {key.lastUsedAt ? (
                          <>
                            <span className="text-border">·</span>
                            <span>Used {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-border">·</span>
                            <span>Never used</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 gap-1.5 text-muted-foreground hover:text-destructive"
                    onClick={() => setRevokeKey(key)}
                  >
                    <HugeiconsIcon icon={Delete01Icon} className="size-3.5" strokeWidth={2} />
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
            )}
          </div>
        )}

        {!loading && !error && (
          <div className="mt-6 flex items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-border" />
            Webhooks, Discord Bot tokens, and additional integrations are coming soon.
          </div>
        )}
      </div>


      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate New API Key</DialogTitle>
            <DialogDescription>
              Create a unique, secure key to authorize your external server resources to communicate with Orbit.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateKey} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Key Description / Name</Label>
              <Input
                id="key-name"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g., Main Production Server"
                disabled={creating}
              />
              <p className="text-xs text-muted-foreground">
                Give this key a name that will help you identify which server or resource is using it.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="key-type">Resource Type</Label>
              <NativeSelect
                id="key-type"
                value={keyType}
                onChange={(e) => setKeyType(e.target.value as "voyager_fivem" | "general")}
                disabled={creating}
                className="w-full"
              >
                <NativeSelectOption value="voyager_fivem">
                  Voyager (FiveM)
                </NativeSelectOption>
                <NativeSelectOption value="general">
                  General API Key
                </NativeSelectOption>
              </NativeSelect>
              <p className="text-xs text-muted-foreground">
                Voyager keys are for FiveM server integrations. General keys are for public API access.
              </p>
            </div>

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating || !keyName.trim()} className="gap-2">
                {creating && <Spinner className="size-3" />}
                Generate Key
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Key Exposure Dialog */}
      <Dialog
        open={createdKey !== null}
        onOpenChange={(open) => {
          if (!open) setCreatedKey(null)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>API Key Generated</DialogTitle>
            <DialogDescription>
              Save this key now. It won&apos;t be shown again after you close this dialog.
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-300">
                The plain-text secret is hashed on storage and cannot be retrieved by Orbit once you close this dialog. If you lose it, revoke the key and create a new one.
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Secret API key</p>
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 select-all truncate rounded-xl border border-border bg-muted/50 px-3 py-2.5 font-mono text-xs">
                    {createdKey.secretKey}
                  </div>
                  <Button
                    onClick={() => handleCopyKey(createdKey.secretKey)}
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    type="button"
                  >
                    <HugeiconsIcon
                      icon={copiedKey ? CopyCheckIcon : Copy01Icon}
                      className={cn("size-4", copiedKey && "text-green-500")}
                      strokeWidth={2}
                    />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Add to server.cfg</p>
                <div className="relative rounded-xl border border-border bg-neutral-950 p-4 dark:bg-black">
                  <pre className="select-all overflow-x-auto pr-10 font-mono text-xs text-neutral-300">
                    {`set orbit_api_key "${createdKey.secretKey}"`}
                  </pre>
                  <Button
                    onClick={() =>
                      handleCopyConfig(`set orbit_api_key "${createdKey.secretKey}"`)
                    }
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-3 top-3 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                    type="button"
                  >
                    <HugeiconsIcon
                      icon={copiedConfig ? CopyCheckIcon : Copy01Icon}
                      className={cn("size-3.5", copiedConfig && "text-green-500")}
                      strokeWidth={2}
                    />
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={() => setCreatedKey(null)} className="w-full">
                  I&apos;ve saved this key securely
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Revoke Key Confirmation Popup */}
      <AlertDialog
        open={revokeKey !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeKey(null)
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              Revoke API Key?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Are you sure you want to revoke{" "}
                <strong className="text-foreground">&quot;{revokeKey?.name}&quot;</strong>?
              </p>
              <p className="text-xs leading-relaxed">
                This action is irreversible. Any FiveM Voyager server using this key will be immediately disconnected and blocked from authenticating.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <DialogFooter className="gap-2">
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleRevokeKey()}
              disabled={revoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking && <Spinner className="mr-2 size-3" />}
              Revoke Key
            </AlertDialogAction>
          </DialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
