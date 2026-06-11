import { createFileRoute, notFound } from "@tanstack/react-router"
import { lazy, Suspense, useMemo, type ComponentType } from "react"
import { mdxComponents } from "@/components/features/docs/mdx-components"

type MdxModule = { default: ComponentType<{ components?: Record<string, ComponentType> }> }

const docModules = import.meta.glob<MdxModule>("/src/docs/**/*.mdx")

function resolveDocModule(splat: string): (() => Promise<MdxModule>) | null {
  const clean = splat.replace(/^\/|\/$/g, "")
  const candidates = [`/src/docs/${clean}.mdx`, `/src/docs/${clean}/index.mdx`]
  for (const path of candidates) {
    if (docModules[path]) return docModules[path]
  }
  return null
}

export const Route = createFileRoute("/docs/$")({
  beforeLoad: ({ params }) => {
    const splat = (params as Record<string, string>)["_splat"] ?? ""
    if (!resolveDocModule(splat)) throw notFound()
  },
  component: DocsPage,
})

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

function DocsPage() {
  const splat = ((Route.useParams() as Record<string, string>)["_splat"] ?? "").replace(
    /^\/|\/$/g,
    "",
  )

  const DocContent = useMemo(() => {
    const loader = resolveDocModule(splat)
    if (!loader) return null
    return lazy(loader)
  }, [splat])

  if (!DocContent) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <p className="text-6xl font-bold tracking-tight">404</p>
        <p className="text-muted-foreground">This page could not be found.</p>
      </div>
    )
  }

  return (
    <Suspense fallback={<DocsSkeleton />}>
      <DocContent components={mdxComponents} />
    </Suspense>
  )
}
