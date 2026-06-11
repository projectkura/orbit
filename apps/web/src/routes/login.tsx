import { useEffect, useState } from "react"
import {
  Link,
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  FingerPrintIcon,
} from "@hugeicons/core-free-icons"
import { masterAdminStatusSchema } from "@orbit/shared/master-admin"
import type { MasterAdminStatus } from "@orbit/shared/master-admin"

import { authClient } from "@/lib/auth-client"
import { getAuthCallbackUrl } from "@/lib/auth-redirect"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert"
import { Button } from "@/components/button"
import { Separator } from "@/components/separator"
import { Spinner } from "@/components/spinner"
import { Discord } from "@/components/ui/svgs/discord"
import { GithubDark } from "@/components/ui/svgs/githubDark"
import { Google } from "@/components/ui/svgs/google"



export const Route = createFileRoute("/login")({ component: LoginPage })

function LoginPage() {
  const session = authClient.useSession()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [status, setStatus] = useState<MasterAdminStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [startupError, setStartupError] = useState<string | null>(null)

  const passkeySupported =
    typeof window !== "undefined" && "PublicKeyCredential" in window

  useEffect(() => {
    let mounted = true

    async function loadStatus() {
      try {
        const response = await fetch("/api/master-admin", {
          credentials: "include",
        })

        if (!response.ok) {
          throw new Error(`Failed to reach the instance (${response.status}).`)
        }

        const data = masterAdminStatusSchema.parse(await response.json())

        if (mounted) {
          setStatus(data)
        }
      } catch (caughtError) {
        if (mounted) {
          setStartupError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to reach Orbit."
          )
        }
      } finally {
        if (mounted) {
          setStatusLoading(false)
        }
      }
    }

    void loadStatus()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!statusLoading && status?.freshInstall && !session.data) {
      void navigate({ to: "/boot", replace: true })
    }
  }, [navigate, session.data, status, statusLoading])

  async function signInWithProvider(
    provider: "google" | "github" | "discord"
  ) {
    try {
      setError(null)
      setPendingAction(provider)

      await authClient.signIn.social({
        provider,
        callbackURL: getAuthCallbackUrl("/post-auth"),
        errorCallbackURL: getAuthCallbackUrl("/login"),
      })
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : `Unable to continue with ${provider}.`
      )
      setPendingAction(null)
    }
  }

  async function signInWithCfx() {
    try {
      setError(null)
      setPendingAction("cfx")

      await authClient.signIn.oauth2({
        providerId: "cfx",
        callbackURL: getAuthCallbackUrl("/post-auth"),
        errorCallbackURL: getAuthCallbackUrl("/login"),
      })
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to continue with Cfx.re."
      )
      setPendingAction(null)
    }
  }

  async function signInWithPasskey() {
    if (!passkeySupported) {
      setError("Passkeys are not supported in this browser.")
      return
    }

    setError(null)
    setPendingAction("passkey")

    const result = await authClient.signIn.passkey()

    if (result.error) {
      setError(result.error.message ?? "Passkey sign in failed.")
      setPendingAction(null)
      return
    }

    window.location.assign("/post-auth")
  }

  if (
    session.isPending ||
    statusLoading ||
    (status?.freshInstall && !session.data)
  ) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
      </main>
    )
  }

  if (startupError || (status && !status.databaseReachable)) {
    return (
      <AuthShell>
        <div className="flex w-full flex-col gap-6">
          <Header
            eyebrow="System offline"
            title="Service unavailable"
            subtitle="The Orbit API is currently unreachable or the database is offline. Please check your backend services."
          />
          <Alert variant="destructive">
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>
              {startupError || status?.statusMessage || "Database unreachable."}
            </AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      </AuthShell>
    )
  }

  if (session.data) {
    const continuePath = "/app"
    return (
      <AuthShell>
        <div className="flex w-full flex-col gap-5">
          <Header
            eyebrow="Already signed in"
            title="Welcome back"
            subtitle="Pick up where you left off."
          />
          <div className="flex flex-col gap-2">
            <Button
              size="lg"
              className="w-full"
              render={<Link to={continuePath} />}
            >
              Continue to app
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                className="ml-auto size-3.5"
              />
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="w-full"
              render={<Link to="/" />}
            >
              Back to home
            </Button>
          </div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div className="flex w-full flex-col gap-6">
        <Header
          eyebrow="Sign in"
          title="Welcome to Orbit"
          subtitle="The control center for your FiveM operation. Sign in or create an account to continue."
        />

        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start gap-2.5"
            disabled={pendingAction !== null}
            onClick={() => void signInWithProvider("google")}
          >
            <Google className="size-3.5" />
            {pendingAction === "google"
              ? "Redirecting…"
              : "Continue with Google"}
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start gap-2.5"
            disabled={pendingAction !== null}
            onClick={() => void signInWithProvider("github")}
          >
            <GithubDark className="size-3.5" />
            {pendingAction === "github"
              ? "Redirecting…"
              : "Continue with GitHub"}
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start gap-2.5"
            disabled={pendingAction !== null}
            onClick={() => void signInWithProvider("discord")}
          >
            <Discord className="size-3.5" />
            {pendingAction === "discord"
              ? "Redirecting…"
              : "Continue with Discord"}
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start gap-2.5"
            disabled={pendingAction !== null}
            onClick={() => void signInWithCfx()}
          >
            <span className="flex size-3.5 items-center justify-center text-[0.5rem] font-bold leading-none">
              Cfx
            </span>
            {pendingAction === "cfx"
              ? "Redirecting…"
              : "Continue with Cfx.re"}
          </Button>

          <div className="flex items-center gap-2 py-1">
            <Separator className="flex-1" />
            <span className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
              or
            </span>
            <Separator className="flex-1" />
          </div>

          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start gap-2.5"
            disabled={pendingAction !== null}
            onClick={() => void signInWithPasskey()}
          >
            <HugeiconsIcon icon={FingerPrintIcon} className="size-3.5" />
            {pendingAction === "passkey"
              ? "Waiting for passkey…"
              : "Continue with passkey"}
          </Button>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Sign in failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <p className="text-center text-xs leading-5 text-muted-foreground">
          By continuing you agree to the Orbit{" "}
          <Link to="/terms" className="underline underline-offset-4">
            terms of service
          </Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline underline-offset-4">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </AuthShell>
  )
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-svh w-full overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,oklch(0.811_0.111_293.571_/_0.16),transparent_55%),radial-gradient(circle_at_80%_30%,oklch(0.606_0.25_292.717_/_0.12),transparent_60%),radial-gradient(circle_at_50%_100%,oklch(0.491_0.27_292.581_/_0.1),transparent_60%)]"
      />
      <div className="relative grid w-full lg:grid-cols-2">
        <aside className="relative hidden flex-col justify-between border-r border-border/60 bg-card/45 px-12 py-12 backdrop-blur-md lg:flex">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <img src="/logo.svg" alt="" className="size-5" />
            Orbit
          </Link>

          <div className="flex flex-col gap-6">
            <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
              Run your FiveM server like a real product.
            </h2>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              Player management, role-based access, and operations tooling — in
              one polished panel that you self-host.
            </p>
            <ul className="flex flex-col gap-3 text-sm text-muted-foreground">
              <FeatureLine>Single sign-on with Google, GitHub, Discord and Cfx.re</FeatureLine>
              <FeatureLine>Passkeys and modern session security out of the box</FeatureLine>
              <FeatureLine>Self-hosted, open source, yours to extend</FeatureLine>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Orbit. All systems nominal.
          </p>
        </aside>

        <section className="flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="flex w-full max-w-sm flex-col items-stretch">
            <Link
              to="/"
              className="mb-8 flex items-center gap-2 text-sm font-semibold tracking-tight lg:hidden"
            >
              <img src="/logo.svg" alt="" className="size-5" />
              Orbit
            </Link>
            {children}
          </div>
        </section>
      </div>
    </main>
  )
}

function Header({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string
  title: string
  subtitle: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {eyebrow}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm leading-6 text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function FeatureLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden
        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground/70"
      />
      <span>{children}</span>
    </li>
  )
}
