import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import type { WorkspaceUsageResponse } from "@orbit/shared/workspaces"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity01Icon,
  ArrowRight01Icon,
  InformationCircleIcon,
  Wifi01Icon,
} from "@hugeicons/core-free-icons"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, XAxis, YAxis } from "recharts"

import { apiFetch } from "@/lib/api-client"
import { Badge } from "@/components/badge"
import { Button } from "@/components/button"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/chart"
import { Spinner } from "@/components/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/tooltip"

export const Route = createFileRoute("/app/$identifier/usage")({
  component: WorkspaceUsagePage,
})

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text()
  return text ? (JSON.parse(text) as T) : null
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
  }
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function WorkspaceUsagePage() {
  const { identifier } = Route.useParams()
  const [usage, setUsage] = useState<WorkspaceUsageResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let mounted = true

    async function loadUsage() {
      setLoading(true)
      setError(null)

      try {
        const response = await apiFetch(`/api/workspaces/${identifier}/usage`)

        if (!response.ok) {
          const body = await readJson<{ message?: string }>(response)
          throw new Error(body?.message ?? "Unable to load usage.")
        }

        const payload = await readJson<WorkspaceUsageResponse>(response)
        if (mounted) setUsage(payload)
      } catch (caughtError) {
        if (mounted) {
          setError(
            caughtError instanceof Error ? caughtError.message : "Unable to load usage."
          )
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadUsage()

    return () => {
      mounted = false
    }
  }, [identifier])

  if (loading) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center md:-m-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          Loading usage...
        </div>
      </div>
    )
  }

  if (error || !usage) {
    return (
      <div className="-m-4 flex min-h-[calc(100vh-3.5rem)] items-center justify-center md:-m-6">
        <p className="text-sm text-destructive">{error ?? "Usage unavailable."}</p>
      </div>
    )
  }

  const storageMetric = usage.metrics.find((m) => m.type === "general_storage")
  const dbMetric      = usage.metrics.find((m) => m.type === "database")
  const bwMetric      = usage.metrics.find((m) => m.type === "bandwidth")

  const usedBytes      = storageMetric?.usedBytes ?? 0
  const limitBytes     = storageMetric?.limitBytes ?? 0
  const availableBytes = usage.availableBytes
  const pct            = limitBytes > 0 ? Math.min(100, (usedBytes / limitBytes) * 100) : 0

  const dbUsedBytes  = dbMetric?.usedBytes ?? 0
  const totalUsedBytes = usedBytes + dbUsedBytes

  const bwBytes = bwMetric?.usedBytes ?? 0
  const BW_MAX  = 100 * 1024 * 1024 * 1024
  const bwPct   = Math.min(100, (bwBytes / BW_MAX) * 100)

  const segments  = buildSegments(usage.items, dbUsedBytes)
  const pieData   = segments.filter((s) => s.value > 0)
  const chartPie  = pieData.length > 0
    ? pieData
    : [{ type: "empty", label: "No files", value: 1, fill: "var(--color-empty)" }]
  const isEmpty      = pieData.length === 0
  const dailyBwData  = buildDailyData()
  const dailyApiData = buildDailyData()

  return (
    <div className="-m-4 flex flex-col md:-m-6">

      {/* Plan banner */}
      <div className="relative overflow-hidden border-b border-border px-4 py-6 md:px-6">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-foreground/4 via-transparent to-transparent" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Workspace Plan
            </p>
            <p className="mt-1 text-3xl font-bold capitalize tracking-tight">{usage.workspace.storageTier}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="text-xs text-muted-foreground">{formatBytes(limitBytes)} storage</span>
              <span className="text-xs text-muted-foreground/30">·</span>
              <span className="text-xs text-muted-foreground">100 GB network / mo</span>
              <span className="text-xs text-muted-foreground/30">·</span>
              <span className="text-xs text-muted-foreground">Unlimited API requests</span>
            </div>
          </div>
          <Button size="sm" className="shrink-0 gap-1.5 self-start sm:self-auto">
            Upgrade plan
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-3" strokeWidth={2} />
          </Button>
        </div>
      </div>

      {/* Storage hero */}
      <div className="border-b border-border px-4 py-6 md:px-6">
        <div className="grid items-start gap-8 lg:grid-cols-[240px_1fr]">

          {/* Donut chart */}
          <div className="flex flex-col items-center">
            <p className="mb-2 self-start text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Storage Distribution
            </p>
            <ChartContainer config={chartConfig} className="aspect-square w-full max-w-[200px]">
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value) => formatBytes(Number(value))}
                    />
                  }
                />
                <Pie
                  data={chartPie}
                  dataKey="value"
                  nameKey="type"
                  innerRadius={62}
                  outerRadius={86}
                  strokeWidth={0}
                  paddingAngle={isEmpty ? 0 : 2}
                >
                  {chartPie.map((entry) => (
                    <Cell key={entry.type} fill={entry.fill} />
                  ))}
                  <Label
                    content={({ viewBox }) => {
                      if (!viewBox || !("cx" in viewBox)) return null
                      const cx = viewBox.cx ?? 0
                      const cy = viewBox.cy ?? 0
                      return (
                        <text textAnchor="middle" dominantBaseline="middle">
                          <tspan x={cx} y={cy - 9} className="fill-foreground text-[17px] font-bold">
                            {formatBytes(totalUsedBytes)}
                          </tspan>
                          <tspan x={cx} y={cy + 11} className="fill-muted-foreground text-[11px]">
                            of {formatBytes(limitBytes)}
                          </tspan>
                        </text>
                      )
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1.5">
              {segments.map((s) => (
                <div key={s.type} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <div className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: s.fill }} />
                  {s.label}
                </div>
              ))}
            </div>
          </div>

          {/* Stats + breakdown bars */}
          <div className="space-y-6">
            <div>
              <div className="flex items-baseline gap-2.5">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">
                  {formatBytes(usedBytes)}
                </span>
                <span className="text-sm text-muted-foreground">of {formatBytes(limitBytes)}</span>
                <Badge variant="outline" className="ml-auto capitalize">{usage.workspace.storageTier}</Badge>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{pct.toFixed(1)}% used</span>
                  <span>{formatBytes(availableBytes)} available</span>
                </div>
              </div>
            </div>

            {totalUsedBytes > 0 ? (
              <div className="space-y-3">
                {segments
                  .filter((s) => s.value > 0)
                  .map((s) => (
                    <div key={s.type} className="flex items-center gap-3">
                      <div className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: s.fill }} />
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{s.label}</span>
                          <span className="font-medium tabular-nums">{formatBytes(s.value)}</span>
                        </div>
                        <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${(s.value / totalUsedBytes) * 100}%`, backgroundColor: s.fill }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No files yet. Storage distribution will appear here once assets are uploaded.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Network Traffic */}
      <div className="border-b border-border px-4 py-6 md:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
              <HugeiconsIcon icon={Wifi01Icon} className="size-4 text-muted-foreground" strokeWidth={2} />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">Network Traffic</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="cursor-default text-muted-foreground/40 transition-colors hover:text-muted-foreground">
                    <HugeiconsIcon icon={InformationCircleIcon} className="size-3.5" strokeWidth={2} />
                  </TooltipTrigger>
                  <TooltipContent>Data transferred between your servers and Orbit</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xl font-semibold tabular-nums">{bwBytes > 0 ? formatBytes(bwBytes) : "0 B"}</span>
            <p className="text-[11px] text-muted-foreground">{bwPct.toFixed(2)}% of 100 GB</p>
          </div>
        </div>
        <div className="mt-5 h-[180px]">
          <ChartContainer
            config={{ value: { label: "Data", color: "#06b6d4" } }}
            className="h-full w-full"
          >
            <AreaChart data={dailyBwData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id="bwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#ccc" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => formatBytes(v)}
                width={50}
              />
              <ChartTooltip
                animationDuration={0}
                content={<ChartTooltipContent hideLabel formatter={(v) => formatBytes(Number(v))} />}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#06b6d4"
                strokeWidth={2}
                fill="url(#bwGrad)"
              />
            </AreaChart>
          </ChartContainer>
        </div>
      </div>

      {/* API Requests */}
      <div className="border-b border-border px-4 py-6 md:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
              <HugeiconsIcon icon={Activity01Icon} className="size-4 text-muted-foreground" strokeWidth={2} />
            </div>
            <span className="text-sm font-medium">API Requests</span>
          </div>
          <div className="text-right">
            <span className="text-xl font-semibold tabular-nums">0</span>
            <p className="text-[11px] text-muted-foreground">Unlimited · this month</p>
          </div>
        </div>
        <div className="mt-5 h-[180px]">
          <ChartContainer
            config={{ value: { label: "Requests", color: "#10b981" } }}
            className="h-full w-full"
          >
            <BarChart data={dailyApiData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid vertical={false} stroke="#ccc" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => v.toLocaleString()}
                width={40}
              />
              <ChartTooltip
                animationDuration={0}
                content={<ChartTooltipContent hideLabel formatter={(v) => `${Number(v).toLocaleString()} req`} />}
              />
              <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} minPointSize={2} />
            </BarChart>
          </ChartContainer>
        </div>
      </div>

    </div>
  )
}

const SEGMENT_DEFS = [
  { type: "images",   label: "Images",   fill: "#3b82f6", test: (ct: string) => ct.startsWith("image/") },
  { type: "audio",    label: "Audio",    fill: "#8b5cf6", test: (ct: string) => ct.startsWith("audio/") },
  { type: "videos",   label: "Videos",   fill: "#f59e0b", test: (ct: string) => ct.startsWith("video/") },
  { type: "logs",     label: "Logs",     fill: "#10b981", test: (ct: string) => ct.includes("log") || ct === "text/plain" },
  { type: "messages", label: "Messages", fill: "#06b6d4", test: (ct: string) => ct.includes("message") || ct.includes("json") },
  { type: "backups",  label: "Backups",  fill: "#f43f5e", test: () => false },
  { type: "other",    label: "Other",    fill: "#94a3b8", test: () => true },
] as const

function buildSegments(items: WorkspaceUsageResponse["items"], dbUsedBytes = 0) {
  const buckets: Record<string, number> = {}
  for (const def of SEGMENT_DEFS) buckets[def.type] = 0
  for (const item of items) {
    const ct  = (item.contentType ?? "").toLowerCase()
    const def = SEGMENT_DEFS.find((d) => d.test(ct)) ?? SEGMENT_DEFS[SEGMENT_DEFS.length - 1]
    buckets[def.type] += item.sizeBytes
  }
  buckets["backups"] += dbUsedBytes
  return SEGMENT_DEFS.map((d) => ({ type: d.type, label: d.label, fill: d.fill, value: buckets[d.type] }))
}

function buildDailyData(days = 14) {
  const now = new Date()
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (days - 1 - i))
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: 0,
    }
  })
}

const chartConfig: ChartConfig = {
  images:   { label: "Images",   color: "#3b82f6" },
  audio:    { label: "Audio",    color: "#8b5cf6" },
  videos:   { label: "Videos",   color: "#f59e0b" },
  logs:     { label: "Logs",     color: "#10b981" },
  messages: { label: "Messages", color: "#06b6d4" },
  backups:  { label: "Backups",  color: "#f43f5e" },
  other:    { label: "Other",    color: "#94a3b8" },
  empty:    { label: "No files", color: "#e2e8f0" },
}
