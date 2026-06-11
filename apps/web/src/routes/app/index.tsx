import { useEffect, useMemo, useRef, useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
import { MAX_WORKSPACE_IMAGE_BYTES } from "@orbit/shared/workspaces"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Image02Icon,
  Logout01Icon,
  Mail01Icon,
  Moon02Icon,
  Search01Icon,
  Settings02Icon,
  Sun03Icon,
  UnfoldMoreIcon,
  UserCircleIcon,
  UserMultiple02Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import type {
  CreateWorkspaceInput,
  WorkspaceListResponse,
  WorkspaceSummary,
} from "@orbit/shared/workspaces"

import type { OrbitSessionUser } from "@/lib/auth-types"
import { apiFetch } from "@/lib/api-client"
import { uploadWorkspaceAssetFromIntent } from "@/lib/workspace-asset-upload"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
import { NotificationCenterPopover } from "@/components/shared/notification-center"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/shared/empty"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/field"
import { Input } from "@/components/input"
import { Separator } from "@/components/separator"
import { Spinner } from "@/components/spinner"

export const Route = createFileRoute("/app/")({ component: AppPage })

type FormState = {
  name: string
  identifier: string
  imageFile: File | null
  imagePreview: string | null
}

type CreateStep = "details" | "invite"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function deriveIdentifier(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20)
}

function validateName(value: string) {
  if (!value.trim()) return "Workspace name is required."
  if (value.length > 20) return "Workspace name must be 20 characters or fewer."
  if (!/^[A-Za-z0-9]+$/.test(value)) {
    return "Workspace name can only contain letters and numbers."
  }
  return null
}

function validateIdentifier(value: string) {
  if (!value.trim()) return "Identifier is required."
  if (value.length > 20) return "Identifier must be 20 characters or fewer."
  if (!/^[a-z0-9_]+$/.test(value)) {
    return "Identifier can only contain lowercase letters, numbers, and underscores."
  }
  return null
}

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text()
  return text ? (JSON.parse(text) as T) : null
}

function getInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "•"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

// Stable, deterministic gradient derived from a workspace identifier so cards
// keep the same color across renders. Used as fallback when no image exists.
function gradientFromString(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  const hue = Math.abs(hash) % 360
  const altHue = (hue + 47) % 360
  return `linear-gradient(135deg, oklch(0.62 0.22 ${hue}) 0%, oklch(0.45 0.26 ${altHue}) 100%)`
}

function AppPage() {
  const session = authClient.useSession()
  const navigate = useNavigate()
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<Array<WorkspaceSummary>>([])
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true)
  const [search, setSearch] = useState("")

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<CreateStep>("details")
  const [createdWorkspace, setCreatedWorkspace] = useState<WorkspaceSummary | null>(null)
  const [form, setForm] = useState<FormState>({
    name: "",
    identifier: "",
    imageFile: null,
    imagePreview: null,
  })
  const [identifierTouched, setIdentifierTouched] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteError, setInviteError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const user = useMemo(
    () => (session.data?.user as OrbitSessionUser | undefined) ?? null,
    [session.data]
  )

  useEffect(() => {
    if (session.isPending || !user) {
      return
    }

    let mounted = true

    async function loadWorkspaces() {
      setLoadingWorkspaces(true)

      try {
        const response = await apiFetch("/api/workspaces")

        if (!response.ok) {
          throw new Error("Unable to load workspaces.")
        }

        const payload = await readJson<WorkspaceListResponse>(response)

        if (mounted) {
          setWorkspaces(payload?.workspaces ?? [])
        }
      } catch (error) {
        if (mounted) {
          setMessage(
            error instanceof Error ? error.message : "Unable to load workspaces."
          )
        }
      } finally {
        if (mounted) {
          setLoadingWorkspaces(false)
        }
      }
    }

    void loadWorkspaces()

    return () => {
      mounted = false
    }
  }, [session.isPending, user])

  function resetCreateState() {
    setStep("details")
    setForm({ name: "", identifier: "", imageFile: null, imagePreview: null })
    setIdentifierTouched(false)
    setFormError(null)
    setInviteEmail("")
    setInviteError(null)
    setCreatedWorkspace(null)
  }

  function handleOpenChange(next: boolean) {
    if (pendingAction === "create-workspace" || pendingAction === "send-invite") {
      return
    }
    setOpen(next)
    if (!next) {
      // Defer reset so closing animation doesn't flash a blank state
      setTimeout(resetCreateState, 200)
    }
  }

  async function handleLogout() {
    setPendingAction("logout")
    setMessage(null)

    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.assign("/")
        },
      },
    })
  }

  function handleImageSelect(file: File | null) {
    if (!file) return
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      toast.error("Choose a PNG, JPG, WebP, or GIF image.")
      return
    }
    if (file.size > MAX_WORKSPACE_IMAGE_BYTES) {
      toast.error("Workspace images must be 5 MB or smaller.")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setForm((current) => ({
        ...current,
        imageFile: file,
        imagePreview: typeof reader.result === "string" ? reader.result : null,
      }))
    }
    reader.readAsDataURL(file)
  }

  async function validateImageSignature(file: File) {
    const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
    const isPng =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    const isGif =
      bytes[0] === 0x47 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x38
    const isWebp =
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50

    return (
      (file.type === "image/png" && isPng) ||
      (file.type === "image/jpeg" && isJpeg) ||
      (file.type === "image/gif" && isGif) ||
      (file.type === "image/webp" && isWebp)
    )
  }

  async function handleCreateWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nameError = validateName(form.name)
    const identifierError = validateIdentifier(form.identifier)

    if (nameError || identifierError) {
      setFormError(nameError ?? identifierError)
      return
    }

    setPendingAction("create-workspace")
    setFormError(null)

    if (form.imageFile && !(await validateImageSignature(form.imageFile))) {
      setFormError("The selected file does not match its image type.")
      setPendingAction(null)
      return
    }

    const payload: CreateWorkspaceInput = {
      name: form.name,
      identifier: form.identifier,
      image: form.imageFile
        ? {
            fileName: form.imageFile.name,
            contentType: form.imageFile.type as
              | "image/png"
              | "image/jpeg"
              | "image/webp"
              | "image/gif",
            sizeBytes: form.imageFile.size,
          }
        : undefined,
    }

    try {
      const response = await apiFetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const body = await readJson<{ message?: string }>(response)
        throw new Error(
          body?.message ??
            (response.status === 409
              ? "Workspace identifier is already taken."
              : "Unable to create workspace.")
        )
      }

      let workspace = await readJson<WorkspaceSummary>(response)

      if (!workspace) {
        throw new Error("Workspace was created, but no workspace payload was returned.")
      }

      let uploadWarning: string | null = null

      if (!workspace.pendingUpload && form.imageFile) {
        uploadWarning =
          workspace.uploadBlockReason ??
          "Workspace created, but image uploads are currently blocked."
      } else if (workspace.pendingUpload && form.imageFile) {
        try {
          workspace = await uploadWorkspaceAssetFromIntent({
            identifier: workspace.identifier,
            intent: workspace.pendingUpload,
            file: form.imageFile,
          })
        } catch (error) {
          uploadWarning =
            error instanceof Error
              ? error.message
              : "Workspace created, but the image upload did not complete."
        }
      }

      setWorkspaces((current) => [
        ...current.filter((item) => item.id !== workspace.id),
        workspace,
      ])
      setCreatedWorkspace(workspace)
      setStep("invite")
      if (uploadWarning) {
        toast.warning(uploadWarning)
      } else {
        toast.success(`${workspace.name} created`)
      }
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to create workspace."
      )
    } finally {
      setPendingAction(null)
    }
  }

  async function finishFlow(skipInvite: boolean) {
    const target = createdWorkspace
    if (!target) return

    if (!skipInvite) {
      const value = inviteEmail.trim().toLowerCase()
      if (!value) {
        setInviteError("Enter an email address or skip for now.")
        return
      }
      if (!EMAIL_RE.test(value)) {
        setInviteError("That doesn't look like a valid email address.")
        return
      }

      setInviteError(null)
      setPendingAction("send-invite")
      // Invitation backend isn't wired up yet; queue locally and confirm.
      await new Promise((resolve) => setTimeout(resolve, 500))
      toast.success(`Invite queued for ${value}`)
      setPendingAction(null)
    }

    setOpen(false)
    setTimeout(resetCreateState, 200)
    void navigate({
      to: "/app/$identifier/overview",
      params: { identifier: target.identifier },
    })
  }

  if (session.isPending) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4">
        <Spinner className="size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    )
  }

  if (!session.data || !user) {
    return (
      <main className="flex min-h-svh items-center justify-center px-6 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Badge className="w-fit">Orbit</Badge>
            <CardTitle>You are not signed in</CardTitle>
            <CardDescription>
              Sign in first, then come back here to manage your workspaces.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3">
            <Button className="w-full" render={<Link to="/login" />}>
              Go to sign in
            </Button>
            <Button variant="ghost" className="w-full" render={<Link to="/" />}>
              Back to landing page
            </Button>
          </CardFooter>
        </Card>
      </main>
    )
  }

  const filtered = workspaces.filter((workspace) => {
    if (!search.trim()) return true
    const needle = search.toLowerCase()
    return (
      workspace.name.toLowerCase().includes(needle) ||
      workspace.identifier.toLowerCase().includes(needle)
    )
  })

  const displayName = user.firstName ?? user.name ?? user.username ?? "Orbit User"

  const nameError = form.name ? validateName(form.name) : null
  const identifierError = form.identifier ? validateIdentifier(form.identifier) : null
  const detailsValid =
    Boolean(form.name) && Boolean(form.identifier) && !nameError && !identifierError

  return (
    <main className="min-h-svh">
      <AppHeader
        user={{
          name: displayName,
          email: user.email,
          avatar: user.image ?? null,
          isAdmin: user.role === "admin",
        }}
        onLogout={() => void handleLogout()}
        loggingOut={pendingAction === "logout"}
      />

      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 md:px-6 md:pt-12">
        <section className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              Welcome back, {displayName.split(" ")[0]}
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Jump into a workspace you already own, or spin up a new one in
              seconds.
            </p>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <HugeiconsIcon
                icon={Search01Icon}
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search workspaces…"
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                className="h-10 pl-9 sm:w-72"
              />
            </div>
            <Button
              size="lg"
              className="h-10 gap-2"
              onClick={() => {
                resetCreateState()
                setOpen(true)
              }}
            >
              <HugeiconsIcon icon={Add01Icon} className="size-4" strokeWidth={2.4} />
              New workspace
            </Button>
          </div>
        </section>

        <Separator className="my-8" />

        {message ? (
          <Alert className="mb-6">
            <AlertTitle>Orbit update</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        {loadingWorkspaces ? (
          <WorkspaceGridSkeleton />
        ) : workspaces.length === 0 ? (
          <EmptyState
            onCreate={() => {
              resetCreateState()
              setOpen(true)
            }}
          />
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <p className="text-sm font-medium text-foreground">
                No workspaces match “{search}”.
              </p>
              <p className="text-xs text-muted-foreground">
                Try a different name or identifier.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((workspace) => (
              <WorkspaceCard key={workspace.id} workspace={workspace} />
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {step === "details" ? "Create a workspace" : "Invite a teammate"}
            </DialogTitle>
            <DialogDescription>
              {step === "details"
                ? "Pick a name and an identifier. You can change these later."
                : `${
                    createdWorkspace?.name ?? "Your workspace"
                  } is ready. Add a teammate by email, or skip for now.`}
            </DialogDescription>
          </DialogHeader>

          {step === "details" ? (
            <form
              className="space-y-5"
              onSubmit={(event) => void handleCreateWorkspace(event)}
            >
              <div className="flex flex-col items-center gap-2">
                <ImageDropzone
                  preview={form.imagePreview}
                  onSelect={(file) => handleImageSelect(file)}
                  onClear={() =>
                    setForm((current) => ({
                      ...current,
                      imageFile: null,
                      imagePreview: null,
                    }))
                  }
                  inputRef={fileInputRef}
                />
              </div>

              <FieldGroup>
                <Field data-invalid={Boolean(nameError)}>
                  <FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel>
                  <FieldContent>
                    <Input
                      id="workspace-name"
                      value={form.name}
                      maxLength={20}
                      placeholder="OrbitOne"
                      autoFocus
                      aria-invalid={Boolean(nameError)}
                      onChange={(event) => {
                        const nextName = event.currentTarget.value
                        setForm((current) => ({
                          ...current,
                          name: nextName,
                          identifier: identifierTouched
                            ? current.identifier
                            : deriveIdentifier(nextName),
                        }))
                      }}
                    />
                    <FieldDescription>
                      Up to 20 letters or numbers.
                    </FieldDescription>
                    <FieldError>{nameError}</FieldError>
                  </FieldContent>
                </Field>

                <Field data-invalid={Boolean(identifierError)}>
                  <FieldLabel htmlFor="workspace-identifier">
                    Workspace identifier
                  </FieldLabel>
                  <FieldContent>
                    <Input
                      id="workspace-identifier"
                      value={form.identifier}
                      maxLength={20}
                      placeholder="orbit_one"
                      aria-invalid={Boolean(identifierError)}
                      className="font-mono text-sm"
                      onChange={(event) => {
                        setIdentifierTouched(true)
                        setForm((current) => ({
                          ...current,
                          identifier: deriveIdentifier(event.currentTarget.value),
                        }))
                      }}
                    />
                    <FieldDescription>
                      Lowercase letters, numbers, and underscores only.
                    </FieldDescription>
                    <FieldError>{identifierError}</FieldError>
                  </FieldContent>
                </Field>
              </FieldGroup>

              {formError ? (
                <Alert variant="destructive">
                  <AlertTitle>Couldn't create workspace</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              ) : null}

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  disabled={pendingAction === "create-workspace"}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="gap-2"
                  disabled={!detailsValid || pendingAction === "create-workspace"}
                >
                  {pendingAction === "create-workspace" ? (
                    <>
                      <Spinner className="size-3.5" />
                      Creating…
                    </>
                  ) : (
                    <>
                      Continue
                      <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                void finishFlow(false)
              }}
            >
              <Field data-invalid={Boolean(inviteError)}>
                <FieldContent>
                  <div className="relative">
                    <HugeiconsIcon
                      icon={Mail01Icon}
                      className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="teammate@company.com"
                      autoFocus
                      className="h-11 pl-9"
                      value={inviteEmail}
                      aria-invalid={Boolean(inviteError)}
                      disabled={pendingAction === "send-invite"}
                      onChange={(event) => {
                        setInviteEmail(event.currentTarget.value)
                        if (inviteError) setInviteError(null)
                      }}
                    />
                  </div>
                  <FieldError>{inviteError}</FieldError>
                </FieldContent>
              </Field>

              <Button
                type="submit"
                className="w-full gap-2"
                size="lg"
                disabled={pendingAction === "send-invite"}
              >
                {pendingAction === "send-invite" ? (
                  <>
                    <Spinner className="size-3.5" />
                    Sending invite…
                  </>
                ) : (
                  "Send invite"
                )}
              </Button>

              <button
                type="button"
                onClick={() => void finishFlow(true)}
                disabled={pendingAction === "send-invite"}
                className="block w-full text-center text-xs text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                Skip for now
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}

function ImageDropzone({
  preview,
  onSelect,
  onClear,
  inputRef,
}: {
  preview: string | null
  onSelect: (file: File | null) => void
  onClear: () => void
  inputRef: React.MutableRefObject<HTMLInputElement | null>
}) {
  const [dragActive, setDragActive] = useState(false)

  return (
    <div
      className={cn(
        "group relative aspect-square w-24 overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 transition",
        dragActive && "border-primary bg-primary/10"
      )}
      onDragEnter={(event) => {
        event.preventDefault()
        setDragActive(true)
      }}
      onDragLeave={() => setDragActive(false)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        setDragActive(false)
        const file = event.dataTransfer.files?.[0]
        if (file) onSelect(file)
      }}
    >
      <button
        type="button"
        aria-label="Choose workspace image"
        onClick={() => inputRef.current?.click()}
        className="flex size-full items-center justify-center"
      >
        {preview ? (
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 text-muted-foreground transition group-hover:text-foreground">
            <HugeiconsIcon icon={Image02Icon} className="size-5" />
            <span className="text-[0.625rem] font-medium uppercase tracking-wider">
              Add image
            </span>
          </div>
        )}
      </button>
      {preview ? (
        <button
          type="button"
          aria-label="Remove image"
          onClick={onClear}
          className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-lg bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:bg-background"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
        </button>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => onSelect(event.currentTarget.files?.[0] ?? null)}
      />
    </div>
  )
}

function WorkspaceCard({ workspace }: { workspace: WorkspaceSummary }) {
  return (
    <Card className="group gap-0 overflow-hidden p-0 transition hover:border-primary/40 hover:shadow-md">
      <Link
        to="/app/$identifier/overview"
        params={{ identifier: workspace.identifier }}
        className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Open ${workspace.name}`}
      >
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          {workspace.imageUrl ? (
            <img
              src={workspace.imageUrl}
              alt=""
              className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div
              className="grid size-full place-items-center text-3xl font-semibold tracking-tight text-white transition duration-500 group-hover:scale-[1.03]"
              style={{ background: gradientFromString(workspace.identifier) }}
            >
              {getInitials(workspace.name)}
            </div>
          )}
          <div className="absolute right-2 top-2">
            <Badge
              variant="secondary"
              className="bg-background/80 text-foreground backdrop-blur"
            >
              {workspace.role}
            </Badge>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {workspace.name}
            </p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              @{workspace.identifier}
            </p>
          </div>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition group-hover:border-primary/40 group-hover:bg-primary group-hover:text-primary-foreground">
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3.5" />
          </div>
        </div>
      </Link>
    </Card>
  )
}

function WorkspaceGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index} className="gap-0 overflow-hidden p-0">
          <div className="aspect-square w-full animate-pulse bg-muted" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-2/3 animate-pulse rounded-full bg-muted" />
            <div className="h-2.5 w-1/3 animate-pulse rounded-full bg-muted/70" />
          </div>
        </Card>
      ))}
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Empty className="border border-dashed border-border bg-card/60 py-16">
      <EmptyHeader>
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-xl border border-border bg-muted/50 text-muted-foreground">
          <HugeiconsIcon icon={UserMultiple02Icon} className="size-6" />
        </div>
        <EmptyTitle>No workspaces yet</EmptyTitle>
        <EmptyDescription>
          Create your first workspace to start collaborating.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="lg" className="gap-2" onClick={onCreate}>
          <HugeiconsIcon icon={Add01Icon} className="size-4" strokeWidth={2.4} />
          Create your first workspace
        </Button>
      </EmptyContent>
    </Empty>
  )
}

function AppHeader({
  user,
  onLogout,
  loggingOut,
}: {
  user: { name: string; email: string; avatar: string | null; isAdmin: boolean }
  onLogout: () => void
  loggingOut: boolean
}) {
  const { theme, toggleTheme } = useTheme()
  const fallback = (user.name || user.email).slice(0, 1).toUpperCase()

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/65">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
        <Link
          to="/app"
          className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <img
            src="/logo.svg"
            alt=""
            className="size-7 shrink-0"
            aria-hidden="true"
          />
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="text-sm font-semibold text-foreground">Orbit</span>
            <span className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
              Workspaces
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="size-9 text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon
              icon={theme === "dark" ? Moon02Icon : Sun03Icon}
              strokeWidth={2}
              className="size-4"
            />
          </Button>

          <NotificationCenterPopover />

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  className={cn(
                    "ml-1 flex items-center gap-2 rounded-full border border-border bg-card/60 py-1 pl-1 pr-2 text-left transition hover:bg-muted",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                />
              }
            >
              <Avatar className="size-7">
                <AvatarImage src={user.avatar ?? undefined} alt={user.name} />
                <AvatarFallback>{fallback}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[10rem] truncate text-xs font-medium text-foreground sm:inline">
                {user.name}
              </span>
              <HugeiconsIcon
                icon={UnfoldMoreIcon}
                strokeWidth={2}
                className="size-3.5 text-muted-foreground"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="min-w-60 bg-popover/85 backdrop-blur-2xl backdrop-saturate-150"
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-3 px-2 py-2">
                    <Avatar className="size-9">
                      <AvatarImage src={user.avatar ?? undefined} alt={user.name} />
                      <AvatarFallback>{fallback}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {user.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem render={<Link to="/account" />}>
                  <HugeiconsIcon icon={UserCircleIcon} strokeWidth={2} />
                  Account
                </DropdownMenuItem>
                <DropdownMenuItem closeOnClick={false} onClick={toggleTheme}>
                  <HugeiconsIcon
                    icon={theme === "dark" ? Sun03Icon : Moon02Icon}
                    strokeWidth={2}
                  />
                  {theme === "dark" ? "Light theme" : "Dark theme"}
                </DropdownMenuItem>
                {user.isAdmin ? (
                  <DropdownMenuItem render={<Link to="/admin" />}>
                    <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />
                    Admin dashboard
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={onLogout}
                disabled={loggingOut}
              >
                <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
                {loggingOut ? "Logging out…" : "Log out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
