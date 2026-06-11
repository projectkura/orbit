import { useEffect, useRef, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { masterAdminEmail } from "@orbit/shared/master-admin"

import { authClient } from "@/lib/auth-client"
import { getAuthCallbackUrl } from "@/lib/auth-redirect"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert"
import { Button } from "@/components/button"
import { Input } from "@/components/input"
import { Label } from "@/components/label"
import { Spinner } from "@/components/spinner"

export const Route = createFileRoute("/recovery")({
  head: () => ({
    meta: [
      { title: "Recovery sign-in" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
      { name: "googlebot", content: "noindex, nofollow" },
    ],
  }),
  component: RecoveryPage,
})

// Soft client-side throttle to slow down quick brute-force attempts. The real
// rate limiting is enforced server-side per IP in the API.
const ATTEMPT_COOLDOWN_MS = 1500

function RecoveryPage() {
  const navigate = useNavigate()
  const session = authClient.useSession()
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [exiting, setExiting] = useState(false)
  const lastAttemptRef = useRef(0)

  useEffect(() => {
    if (!session.isPending && session.data) {
      void navigate({ to: "/post-auth", replace: true })
    }
  }, [navigate, session.data, session.isPending])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const now = Date.now()
    const sinceLast = now - lastAttemptRef.current

    if (sinceLast < ATTEMPT_COOLDOWN_MS) {
      await new Promise((resolve) =>
        window.setTimeout(resolve, ATTEMPT_COOLDOWN_MS - sinceLast)
      )
    }

    lastAttemptRef.current = Date.now()

    if (password.length < 1) {
      setError("Enter the master password to continue.")
      return
    }

    setError(null)
    setPending(true)

    try {
      const result = await authClient.signIn.email({
        email: masterAdminEmail,
        password,
        callbackURL: getAuthCallbackUrl("/post-auth"),
        rememberMe: true,
      })

      if (result.error) {
        throw new Error(result.error.message ?? "Sign in failed.")
      }

      setExiting(true)
      window.setTimeout(() => {
        window.location.assign("/post-auth")
      }, 500)
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Sign in failed."
      )
      setPending(false)
    }
  }

  if (session.isPending) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
      </main>
    )
  }

  return (
    <main
      className={`flex min-h-svh items-center justify-center bg-background px-6 py-12 transition-all duration-500 ease-out ${
        exiting ? "opacity-0" : "opacity-100"
      }`}
    >
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-xs flex-col gap-5"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <img src="/logo.svg" alt="" className="size-5 opacity-80" />
          <p className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Recovery
          </p>
          <h1 className="text-base font-semibold tracking-tight">
            Master sign-in
          </h1>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="recovery-password" className="sr-only">
            Master password
          </Label>
          <Input
            id="recovery-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            placeholder="Master password"
            disabled={pending}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={pending || password.length === 0}
        >
          {pending ? <Spinner className="size-3.5" /> : null}
          {pending ? "Verifying…" : "Sign in"}
        </Button>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Access denied</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </form>
    </main>
  )
}
