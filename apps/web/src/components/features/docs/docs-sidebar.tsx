import { Link, useRouterState } from "@tanstack/react-router"
import { cn } from "@/lib/utils"
import { docsConfig } from "@/docs/config"

export function DocsSidebar({ className }: { className?: string }) {
  const location = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav className={cn("flex flex-col gap-6", className)}>
      {docsConfig.map((section) => (
        <div key={section.title}>
          <p className="mb-2 px-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const isActive = location === item.href
              return (
                <li key={item.href}>
                  <Link
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    to={item.href as any}
                    className={cn(
                      "group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-all duration-150",
                      isActive
                        ? "bg-primary/10 font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 h-5 w-0.5 rounded-full bg-primary" />
                    )}
                    <span className="relative">{item.title}</span>
                    {item.badge && (
                      <span className="ml-auto rounded-full bg-blue/15 px-1.5 py-0.5 text-[10px] font-medium text-blue">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
