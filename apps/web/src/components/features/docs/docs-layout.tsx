import { useRef, useState } from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { cn } from "@/lib/utils"
import { DocsSidebar } from "./docs-sidebar"
import { DocsToc } from "./docs-toc"
import { docsConfig, getAllDocItems } from "@/docs/config"

interface DocsLayoutProps {
  children: React.ReactNode
  title?: string
  description?: string
}

function DocsBreadcrumb({ pathname }: { pathname: string }) {
  const allItems = getAllDocItems()
  const current = allItems.find((item) => item.href === pathname)
  const section = docsConfig.find((s) => s.items.some((i) => i.href === pathname))

  if (!current || !section) return null

  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Link to={"/docs" as any} className="hover:text-foreground transition-colors">
        Docs
      </Link>
      {section.title !== "Overview" && (
        <>
          <span className="opacity-40">/</span>
          <span>{section.title}</span>
        </>
      )}
      <span className="opacity-40">/</span>
      <span className="text-foreground font-medium">{current.title}</span>
    </nav>
  )
}

function PrevNext({ pathname }: { pathname: string }) {
  const allItems = getAllDocItems()
  const idx = allItems.findIndex((item) => item.href === pathname)
  const prev = idx > 0 ? allItems[idx - 1] : null
  const next = idx < allItems.length - 1 ? allItems[idx + 1] : null

  if (!prev && !next) return null

  return (
    <div className="mt-12 flex items-center justify-between border-t border-border pt-6">
      {prev ? (
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          to={prev.href as any}
          className="group flex flex-col gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="text-xs text-muted-foreground/60">Previous</span>
          <span className="font-medium group-hover:underline">← {prev.title}</span>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          to={next.href as any}
          className="group flex flex-col items-end gap-0.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="text-xs text-muted-foreground/60">Next</span>
          <span className="font-medium group-hover:underline">{next.title} →</span>
        </Link>
      ) : (
        <div />
      )}
    </div>
  )
}

export function DocsLayout({ children, title, description }: DocsLayoutProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const contentRef = useRef<HTMLDivElement>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-50 flex h-14 items-center border-b border-border bg-background/80 px-4 backdrop-blur-sm lg:px-6">
        <div className="flex w-full max-w-screen-2xl items-center gap-4 mx-auto">
          <Link
            to="/"
            className="flex items-center gap-2 font-semibold text-foreground hover:opacity-80 transition-opacity"
          >
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
              O
            </div>
            <span>Orbit</span>
          </Link>
          <span className="text-border select-none">/</span>
          <Link
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            to={"/docs" as any}
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Docs
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <a
              href="https://github.com/kura-labs/orbit"
              target="_blank"
              rel="noreferrer"
              className="hidden text-sm text-muted-foreground hover:text-foreground transition-colors sm:block"
            >
              GitHub
            </a>
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex size-8 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors lg:hidden"
            aria-label="Toggle sidebar"
          >
            <svg
              className="size-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              {sidebarOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </header>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <div
            className="absolute left-0 top-14 bottom-0 w-72 border-r border-border bg-background p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            aria-label="Mobile docs navigation"
          >
            <DocsSidebar />
          </div>
        </div>
      )}

      <div className="flex flex-1 mx-auto w-full max-w-screen-2xl">
        <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-border p-6 lg:block xl:w-64">
          <DocsSidebar />
        </aside>

        <main className="flex-1 min-w-0 px-6 py-10 lg:px-10 xl:px-16">
          <div className="mx-auto max-w-3xl">
            <DocsBreadcrumb pathname={pathname} />

            {(title || description) && (
              <div className="mb-8">
                {title && (
                  <h1 className="scroll-m-20 text-4xl font-bold tracking-tight text-foreground mb-3">
                    {title}
                  </h1>
                )}
                {description && (
                  <p className="text-lg text-muted-foreground leading-relaxed">{description}</p>
                )}
              </div>
            )}

            <div
              ref={contentRef}
              className={cn(
                "docs-content",
                "**:data-rehype-pretty-code-figure:my-4",
                "**:data-rehype-pretty-code-figure:**:pre:rounded-xl",
                "**:data-rehype-pretty-code-figure:**:pre:border",
                "**:data-rehype-pretty-code-figure:**:pre:border-border",
                "**:data-rehype-pretty-code-figure:**:pre:bg-card",
                "**:data-rehype-pretty-code-figure:**:pre:px-4",
                "**:data-rehype-pretty-code-figure:**:pre:py-4",
                "**:data-rehype-pretty-code-figure:**:pre:overflow-x-auto",
                "**:figcaption:text-xs",
                "**:figcaption:text-muted-foreground",
                "**:figcaption:px-4",
                "**:figcaption:py-1.5",
                "**:figcaption:border-b",
                "**:figcaption:border-border",
                "**:figcaption:bg-muted/50",
                "**:figcaption:rounded-t-xl",
                "**:data-highlighted-line:bg-blue/10",
                "**:data-highlighted-line:border-l-2",
                "**:data-highlighted-line:border-blue",
                "**:data-highlighted-line:-mx-4",
                "**:data-highlighted-line:px-4",
              )}
            >
              {children}
            </div>

            <PrevNext pathname={pathname} />
          </div>
        </main>

        <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-52 shrink-0 overflow-y-auto p-6 xl:block xl:w-56 2xl:w-64">
          <DocsToc contentRef={contentRef} />
        </aside>
      </div>
    </div>
  )
}
