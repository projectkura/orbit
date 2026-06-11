import { HeadContent, Link, Scripts, createRootRoute } from "@tanstack/react-router"

import appCss from "@/styles/globals.css?url"
import { Button } from "@/components/button"
import { Toaster } from "@/components/sonner"
import { TooltipProvider } from "@/components/tooltip"
import { ThemeProvider } from "@/hooks/use-theme"
import { NotificationProvider } from "@/components/shared/notification-center"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Orbit" },
      { name: "description", content: "Orbit is a FiveM admin panel with Better Auth." },
      { name: "apple-mobile-web-app-title", content: "Orbit" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon-96x96.png", sizes: "96x96" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "shortcut icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
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
          <NotificationProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster position="bottom-right" />
          </NotificationProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
