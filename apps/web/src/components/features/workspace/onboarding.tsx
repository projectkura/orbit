import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  CopyCheckIcon,
  Key01Icon,
  Wifi01Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { apiFetch } from "@/lib/api-client"
import { Button } from "@/components/button"
import { Input } from "@/components/input"
import { Label } from "@/components/label"
import { Spinner } from "@/components/spinner"

type Step = "install" | "generate" | "done"

interface CreatedApiKey {
  id: string
  name: string
  type: string
  keyPreview: string
  createdAt: string
  lastUsedAt: string | null
  secretKey: string
}

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text()
  return text ? (JSON.parse(text) as T) : null
}

const STEPS: Step[] = ["install", "generate", "done"]

export function WorkspaceOnboarding({
  identifier,
  onComplete,
}: {
  identifier: string
  onComplete: () => void
}) {
  const [step, setStep] = useState<Step>("install")
  const [keyName, setKeyName] = useState("Production Server")
  const [creating, setCreating] = useState(false)
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedConfig, setCopiedConfig] = useState(false)

  const stepIndex = STEPS.indexOf(step)

  const copyKey = (text: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedKey(true)
    toast.success("API key copied.")
    setTimeout(() => setCopiedKey(false), 2000)
  }

  const copyConfig = (text: string) => {
    void navigator.clipboard.writeText(text)
    setCopiedConfig(true)
    toast.success("Config snippet copied.")
    setTimeout(() => setCopiedConfig(false), 2000)
  }

  const handleGenerateKey = async () => {
    if (!keyName.trim()) return
    setCreating(true)
    try {
      const response = await apiFetch(`/api/workspaces/${identifier}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName.trim(), type: "voyager_fivem" }),
      })
      if (!response.ok) {
        const body = await readJson<{ message?: string }>(response)
        throw new Error(body?.message ?? "Failed to create API key.")
      }
      const newKey = await readJson<CreatedApiKey>(response)
      if (newKey) {
        setCreatedKey(newKey)
        setStep("done")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate key.")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-6 py-16 animate-in fade-in duration-500">
      <div className="mb-10 flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={cn(
              "h-1 rounded-full transition-all duration-500",
              i < stepIndex
                ? "w-6 bg-foreground/40"
                : i === stepIndex
                  ? "w-10 bg-foreground"
                  : "w-4 bg-border"
            )}
          />
        ))}
      </div>

      <div className="w-full max-w-md">
        {step === "install" && (
          <InstallStep
            onContinue={() => setStep("generate")}
            onSkip={onComplete}
          />
        )}
        {step === "generate" && (
          <GenerateStep
            keyName={keyName}
            onKeyNameChange={setKeyName}
            creating={creating}
            onGenerate={() => void handleGenerateKey()}
            onBack={() => setStep("install")}
          />
        )}
        {step === "done" && createdKey && (
          <DoneStep
            createdKey={createdKey}
            copiedKey={copiedKey}
            copiedConfig={copiedConfig}
            onCopyKey={copyKey}
            onCopyConfig={copyConfig}
            onComplete={onComplete}
          />
        )}
      </div>
    </div>
  )
}

function InstallStep({
  onContinue,
  onSkip,
}: {
  onContinue: () => void
  onSkip: () => void
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <HugeiconsIcon icon={Wifi01Icon} className="size-3.5" strokeWidth={2} />
          Step 1 of 2
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Install Voyager</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Voyager is the FiveM resource that connects your game server to Orbit. Install it before generating your key.
        </p>
      </div>

      <div className="space-y-5">
        <div className="flex gap-4">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-[11px] font-semibold mt-0.5">
            1
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Download the Voyager resource</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Get the latest release from your Orbit portal and place the{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono">voyager</code> folder inside your server&apos;s{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono">resources/</code> directory.
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-[11px] font-semibold mt-0.5">
            2
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Enable it in server.cfg</p>
            <p className="text-xs text-muted-foreground">Add the following line to your server config:</p>
            <div className="rounded-xl border border-border bg-neutral-950 px-4 py-3 dark:bg-black">
              <code className="font-mono text-xs text-neutral-300">ensure voyager</code>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Button onClick={onContinue} className="w-full gap-2">
          I&apos;ve installed Voyager
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" strokeWidth={2} />
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip setup for now
        </button>
      </div>
    </div>
  )
}

function GenerateStep({
  keyName,
  onKeyNameChange,
  creating,
  onGenerate,
  onBack,
}: {
  keyName: string
  onKeyNameChange: (v: string) => void
  creating: boolean
  onGenerate: () => void
  onBack: () => void
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          <HugeiconsIcon icon={Key01Icon} className="size-3.5" strokeWidth={2} />
          Step 2 of 2
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Create your API key</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          This key lets Voyager authenticate with your workspace. Give it a name you&apos;ll recognize.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="onboard-key-name">Key name</Label>
        <Input
          id="onboard-key-name"
          value={keyName}
          onChange={(e) => onKeyNameChange(e.target.value)}
          placeholder="e.g. Production Server"
          disabled={creating}
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          Use something like the server name so you can identify it later.
        </p>
      </div>

      <div className="space-y-3">
        <Button
          onClick={onGenerate}
          disabled={creating || !keyName.trim()}
          className="w-full gap-2"
        >
          {creating ? (
            <Spinner className="size-3.5" />
          ) : (
            <HugeiconsIcon icon={Key01Icon} className="size-4" strokeWidth={2} />
          )}
          {creating ? "Generating..." : "Generate API key"}
        </Button>
        <button
          type="button"
          onClick={onBack}
          className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3" strokeWidth={2} />
          Back
        </button>
      </div>
    </div>
  )
}

function DoneStep({
  createdKey,
  copiedKey,
  copiedConfig,
  onCopyKey,
  onCopyConfig,
  onComplete,
}: {
  createdKey: CreatedApiKey
  copiedKey: boolean
  copiedConfig: boolean
  onCopyKey: (text: string) => void
  onCopyConfig: (text: string) => void
  onComplete: () => void
}) {
  const configLine = `set orbit_api_key "${createdKey.secretKey}"`

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-green-600 dark:text-green-400">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" strokeWidth={2} />
          Setup complete
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">You&apos;re connected</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your API key is ready. Copy it to your server.cfg and Voyager will authenticate automatically on next restart.
        </p>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Secret API key
          </p>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 select-all truncate rounded-xl border border-border bg-muted/50 px-3 py-2.5 font-mono text-xs">
              {createdKey.secretKey}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => onCopyKey(createdKey.secretKey)}
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
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Add to server.cfg
          </p>
          <div className="relative rounded-xl border border-border bg-neutral-950 p-4 dark:bg-black">
            <pre className="select-all pr-10 font-mono text-xs text-neutral-300">{configLine}</pre>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onCopyConfig(configLine)}
              className="absolute right-3 top-3 text-neutral-400 hover:bg-neutral-800 hover:text-white"
            >
              <HugeiconsIcon
                icon={copiedConfig ? CopyCheckIcon : Copy01Icon}
                className={cn("size-3.5", copiedConfig && "text-green-500")}
                strokeWidth={2}
              />
            </Button>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Save this key now. It won&apos;t be shown again once you close this page.
          </p>
        </div>
      </div>

      <Button onClick={onComplete} className="w-full">
        Close setup
      </Button>
    </div>
  )
}
