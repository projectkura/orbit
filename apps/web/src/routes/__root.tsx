import { HeadContent, Link, Scripts, createRootRoute } from "@tanstack/react-router"

import appCss from "@/styles/globals.css?url"
import { Button } from "@/components/button"
import { TooltipProvider } from "@/components/tooltip"
import { ThemeProvider } from "@/hooks/use-theme"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Orbit" },
      { name: "description", content: "Orbit is a FiveM admin panel with Better Auth." },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4">
      <h1 className="text-6xl font-bold tracking-tight">404</h1>
      <p className="text-muted-foreground">Page not found</p>
      <Button variant="outline" render={<Link to="/" />}>
        Go back home
      </Button>
    </main>
  ),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-svh bg-background text-foreground antialiased">
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
