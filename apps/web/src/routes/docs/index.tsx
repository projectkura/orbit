import { createFileRoute } from "@tanstack/react-router"
import { mdxComponents } from "@/components/features/docs/mdx-components"
import { lazy, Suspense } from "react"

const IndexMdx = lazy(() => import("@/docs/index.mdx"))

export const Route = createFileRoute("/docs/")({
  component: DocsIndexPage,
})

function DocsIndexPage() {
  return (
    <Suspense fallback={<DocsSkeleton />}>
      <IndexMdx components={mdxComponents} />
    </Suspense>
  )
}

function DocsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-9 w-3/4 rounded-lg bg-muted" />
      <div className="h-4 w-full rounded-lg bg-muted" />
      <div className="h-4 w-5/6 rounded-lg bg-muted" />
      <div className="h-4 w-4/6 rounded-lg bg-muted" />
    </div>
  )
}
