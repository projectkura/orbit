import { cn } from "@/lib/utils"

interface ServiceRowProps {
  icon: React.ReactNode
  name: string
  detail?: string
  status: React.ReactNode
  children?: React.ReactNode
  border?: boolean
}

export function ServiceRow({ icon, name, detail, status, children, border = true }: ServiceRowProps) {
  return (
    <div className={cn("flex flex-col gap-2 transition-colors hover:bg-muted/40", border && "border-b border-border last:border-b-0")}>
      <div className="flex items-center justify-between gap-4 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted">
            {icon}
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-sm font-medium">{name}</p>
            {detail && <p className="truncate text-xs text-muted-foreground">{detail}</p>}
          </div>
        </div>
        <div className="shrink-0">{status}</div>
      </div>
      {children && <div className="px-4 pb-3.5 pl-14">{children}</div>}
    </div>
  )
}
