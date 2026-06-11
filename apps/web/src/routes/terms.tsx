import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/terms")({
  component: TermsPage,
})

function TermsPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">
          Orbit access is provided for authorized users of this instance. Use of
          the service is subject to your organization&apos;s policies and the
          operator&apos;s rules.
        </p>
      </div>

      <section className="space-y-3 text-sm leading-6 text-muted-foreground">
        <p>
          You are responsible for activity performed through your account and for
          maintaining the security of your sign-in methods.
        </p>
        <p>
          Do not use Orbit to violate applicable law, infringe rights, or access
          systems you are not authorized to manage.
        </p>
        <p>
          Instance operators may suspend or remove access when required for
          security, abuse prevention, or operational reasons.
        </p>
      </section>
    </main>
  )
}
