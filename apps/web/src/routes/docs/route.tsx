import { Outlet, createFileRoute } from "@tanstack/react-router"
import { DocsLayout } from "@/components/features/docs/docs-layout"

export const Route = createFileRoute("/docs")({
  component: DocsLayoutRoute,
})

function DocsLayoutRoute() {
  return (
    <DocsLayout>
      <Outlet />
    </DocsLayout>
  )
}
