import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">
          Orbit stores the account details needed to authenticate you, operate
          the service, and handle billing-related records for this instance.
        </p>
      </div>

      <section className="space-y-3 text-sm leading-6 text-muted-foreground">
        <p>
          This may include your email address, profile image, OAuth provider
          identifiers, and the first and last name you provide during onboarding.
        </p>
        <p>
          Your last name is retained for billing and account records and is not
          intended to be displayed publicly in the product UI.
        </p>
        <p>
          Data retention and disclosure are controlled by the organization or
          operator running this Orbit instance.
        </p>
      </section>
    </main>
  )
}
