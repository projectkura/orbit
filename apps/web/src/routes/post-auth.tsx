import { useEffect, useState } from "react"
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"

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
import { Checkbox } from "@/components/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/field"
import { Input } from "@/components/input"
import { Spinner } from "@/components/spinner"
import { authClient } from "@/lib/auth-client"
import type { OrbitSessionUser } from "@/lib/auth-types"
import { apiFetch } from "@/lib/api-client"
import { isMasterAdminEmail } from "@orbit/shared/master-admin"

export const Route = createFileRoute("/post-auth")({
  component: PostAuthPage,
})

type Step = "legal" | "profile"

function PostAuthPage() {
  const session = authClient.useSession()
  const navigate = useNavigate()
  const user = (session.data?.user as OrbitSessionUser | undefined) ?? null

  const [step, setStep] = useState<Step>("legal")
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (session.isPending) {
      return
    }

    if (!user) {
      void navigate({ to: "/login", replace: true })
      return
    }

    if (isMasterAdminEmail(user.email)) {
      void navigate({ to: "/admin", replace: true })
      return
    }

    if (user.onboardingCompletedAt) {
      void navigate({ to: "/app", replace: true })
      return
    }

    setFirstName((current) => current || user.firstName || "")
    setLastName((current) => current || user.lastName || "")
  }, [session.isPending, user, navigate])

  async function completeOnboarding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextFirstName = firstName.trim()
    const nextLastName = lastName.trim()

    if (!nextFirstName) {
      setError("First name is required.")
      return
    }

    if (!nextLastName) {
      setError("Last name is required.")
      return
    }

    setPending(true)
    setError(null)

    try {
      const response = await apiFetch("/api/users/me/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          acceptedTermsOfService: true,
          acceptedPrivacyPolicy: true,
          firstName: nextFirstName,
          lastName: nextLastName,
        }),
      })

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { message?: string }
          | null
        throw new Error(body?.message ?? "Unable to finish account setup.")
      }

      window.location.assign("/app")
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to finish account setup."
      )
      setPending(false)
    }
  }

  if (session.isPending) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4">
        <Spinner className="size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Signing you in...</p>
      </main>
    )
  }

  if (!user) {
    return null
  }

  if (user.onboardingCompletedAt || isMasterAdminEmail(user.email)) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4">
        <Spinner className="size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Redirecting...</p>
      </main>
    )
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-lg border border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle>
            {step === "legal" ? "Accept terms to continue" : "Complete your profile"}
          </CardTitle>
          <CardDescription>
            {step === "legal"
              ? "New accounts need a quick confirmation before you enter Orbit."
              : "We need your legal name for billing information."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === "legal" ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                You are signed in as <span className="font-medium text-foreground">{user.email}</span>.
                Accept the Terms of Service and Privacy Policy to finish creating
                your account.
              </div>

              <FieldGroup>
                <Field orientation="horizontal" data-invalid={!acceptedTerms && error !== null}>
                  <Checkbox
                    checked={acceptedTerms}
                    onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                    aria-label="Accept terms of service"
                  />
                  <FieldContent>
                    <FieldLabel>
                      I accept the{" "}
                      <Link to="/terms" className="underline underline-offset-4">
                        Terms of Service
                      </Link>
                      .
                    </FieldLabel>
                  </FieldContent>
                </Field>

                <Field orientation="horizontal" data-invalid={!acceptedPrivacy && error !== null}>
                  <Checkbox
                    checked={acceptedPrivacy}
                    onCheckedChange={(checked) => setAcceptedPrivacy(checked === true)}
                    aria-label="Accept privacy policy"
                  />
                  <FieldContent>
                    <FieldLabel>
                      I accept the{" "}
                      <Link to="/privacy" className="underline underline-offset-4">
                        Privacy Policy
                      </Link>
                      .
                    </FieldLabel>
                  </FieldContent>
                </Field>
              </FieldGroup>

              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>Account setup failed</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
            </div>
          ) : (
            <form className="space-y-5" onSubmit={(event) => void completeOnboarding(event)}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="first-name">First name</FieldLabel>
                  <FieldContent>
                    <Input
                      id="first-name"
                      value={firstName}
                      autoFocus
                      maxLength={100}
                      onChange={(event) => setFirstName(event.currentTarget.value)}
                    />
                  </FieldContent>
                </Field>

                <Field>
                  <FieldLabel htmlFor="last-name">Last name</FieldLabel>
                  <FieldContent>
                    <Input
                      id="last-name"
                      value={lastName}
                      maxLength={100}
                      onChange={(event) => setLastName(event.currentTarget.value)}
                    />
                    <FieldDescription>
                      This is used for billing information. Your last name will not
                      be shown publicly.
                    </FieldDescription>
                    <FieldError>{error}</FieldError>
                  </FieldContent>
                </Field>
              </FieldGroup>

              <Button type="submit" className="w-full" size="lg" disabled={pending}>
                {pending ? "Saving..." : "Finish setup"}
              </Button>
            </form>
          )}
        </CardContent>

        {step === "legal" ? (
          <CardFooter className="justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (!acceptedTerms || !acceptedPrivacy) {
                  setError("You need to accept both documents to continue.")
                  return
                }

                setError(null)
                setStep("profile")
              }}
            >
              Continue
            </Button>
          </CardFooter>
        ) : null}
      </Card>
    </main>
  )
}
