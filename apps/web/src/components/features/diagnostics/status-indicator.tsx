import { cn } from "@/lib/utils"

interface StatusIndicatorProps {
  status: "ok" | "warn" | "error" | "neutral"
  label: string
}

export function StatusIndicator({ status, label }: StatusIndicatorProps) {
  const dotClass = {
    ok: "bg-green-500",
    warn: "bg-amber-500",
    error: "bg-red-500",
    neutral: "bg-border",
  }[status]

  const textClass = {
    ok: "text-green-600 dark:text-green-400",
    warn: "text-amber-600 dark:text-amber-400",
    error: "text-red-600 dark:text-red-400",
    neutral: "text-muted-foreground",
  }[status]

  return (
    <span className="flex items-center gap-1.5 text-xs font-medium">
      <span className={cn("size-1.5 rounded-full", dotClass)} />
      <span className={textClass}>{label}</span>
    </span>
  )
}
