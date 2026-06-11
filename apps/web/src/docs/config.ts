export interface DocItem {
  title: string
  href: string
  badge?: string
}

export interface DocSection {
  title: string
  items: DocItem[]
}

export const docsConfig: DocSection[] = [
  {
    title: "Overview",
    items: [{ title: "Introduction", href: "/docs" }],
  },
  {
    title: "API Reference",
    items: [
      { title: "Overview", href: "/docs/api" },
      { title: "Authentication", href: "/docs/api/authentication" },
      { title: "Rate Limits", href: "/docs/api/rate-limits" },
      { title: "Test Endpoint", href: "/docs/api/test-endpoint" },
      { title: "API Keys", href: "/docs/api/api-keys" },
      { title: "Workspaces", href: "/docs/api/workspaces" },
    ],
  },
  {
    title: "Self-hosting",
    items: [
      { title: "Docker", href: "/docs/self-hosting/docker" },
      { title: "Environment Variables", href: "/docs/self-hosting/env-vars" },
    ],
  },
]

export function getAllDocItems(): DocItem[] {
  return docsConfig.flatMap((section) => section.items)
}

export function getDocTitle(href: string): string | undefined {
  return getAllDocItems().find((item) => item.href === href)?.title
}
