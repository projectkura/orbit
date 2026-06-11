import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Cancel01Icon,
  Database01Icon,
  Folder01Icon,
  HardDriveIcon,
  Mail01Icon,
  RefreshIcon,
  Settings02Icon,
  Shield02Icon,
  SparklesIcon,
  Wifi01Icon,
  WifiOff01Icon,
} from '@hugeicons/core-free-icons'

import { AdminShell } from '@/components/features/admin/shell'
import { Button } from '@/components/button'
import { ServiceRow, StatusIndicator } from '@/components/features/diagnostics'
import { Spinner } from '@/components/spinner'
import { apiFetch } from '@/lib/api-client'

export const Route = createFileRoute('/admin/diagnostics')({
  component: AdminDiagnosticsPage,
})

interface DiagnosticsData {
  instance: { appName: string; configMode: string; apiUrl: string; webUrl: string }
  database: {
    reachable: boolean
    migrations: { total: number; pending: number }
    counts: { users: number; workspaces: number; assets: number; apiKeys: number }
  }
  dragonfly: { connected: boolean; urlConfigured: boolean }
  rateLimiter: { mode: 'dragonfly' | 'in-memory' }
  r2: { configured: boolean }
  email: { resendConfigured: boolean }
  edgeConfig: { configured: boolean; storeIdConfigured: boolean }
  auth: {
    oauthProviders: { google: boolean; github: boolean; discord: boolean; cfx: boolean }
    passkeyConfigured: boolean
  }
  uploads: {
    uploadsEnabled: boolean
    workspaceImageUploadsEnabled: boolean
    maxPendingUploadsPerWorkspace: number
    intentTtlSeconds: number
  }
}

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text()
  return text ? (JSON.parse(text) as T) : null
}

function AdminDiagnosticsPage() {
  const [data, setData] = useState<DiagnosticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const response = await apiFetch('/api/admin/diagnostics')
      if (!response.ok) {
        const body = await readJson<{ message?: string }>(response)
        throw new Error(body?.message ?? 'Failed (' + response.status + ')')
      }
      const payload = await readJson<DiagnosticsData>(response)
      if (payload) setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load diagnostics.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  if (loading && !data) {
    return (
      <AdminShell activeItem='diagnostics' title='Diagnostics' description='System health and service status.' fullWidth>
        <div className='flex min-h-[calc(100vh-14rem)] items-center justify-center'>
          <div className='flex items-center gap-2 text-sm text-muted-foreground'>
            <Spinner className='size-4' />
            Checking services...
          </div>
        </div>
      </AdminShell>
    )
  }

  if (error && !data) {
    return (
      <AdminShell activeItem='diagnostics' title='Diagnostics' description='System health and service status.' fullWidth>
        <div className='flex min-h-[calc(100vh-14rem)] items-center justify-center'>
          <div className='flex flex-col items-center gap-4 text-center'>
            <div className='flex size-12 items-center justify-center rounded-2xl border border-border bg-muted/50'>
              <HugeiconsIcon icon={Cancel01Icon} className='size-5 text-muted-foreground' strokeWidth={2} />
            </div>
            <div className='space-y-1'>
              <h3 className='font-medium text-foreground'>Could not check services</h3>
              <p className='max-w-xs text-sm text-muted-foreground'>{error}</p>
            </div>
            <Button variant='outline' size='sm' className='gap-2' onClick={() => void load()}>
              <HugeiconsIcon icon={RefreshIcon} className='size-3.5' />
              Try again
            </Button>
          </div>
        </div>
      </AdminShell>
    )
  }

  if (!data) return null

  const coreUp = [data.database.reachable, data.dragonfly.connected || !data.dragonfly.urlConfigured, data.r2.configured].filter(Boolean).length

  return (
    <AdminShell activeItem='diagnostics' title='Diagnostics' description='System health and service status.' fullWidth>
      <div className='-m-4 flex flex-col md:-m-6'>

        <div className='relative overflow-hidden border-b border-border px-4 py-6 md:px-6'>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
            <div>
              <p className='text-[10px] font-semibold uppercase tracking-widest text-muted-foreground'>System Status</p>
              <p className='mt-1 text-3xl font-bold capitalize tracking-tight'>
                {!data.database.reachable
                  ? 'Critical'
                  : data.dragonfly.urlConfigured && !data.dragonfly.connected
                    ? 'Degraded'
                    : !data.r2.configured || !data.email.resendConfigured || data.database.migrations.pending > 0
                      ? 'Degraded'
                      : 'Healthy'}
              </p>
              <div className='mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1'>
                <span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                  <span className={`size-1.5 rounded-full ${coreUp === 3 ? 'bg-green-500' : coreUp >= 2 ? 'bg-amber-500' : 'bg-red-500'}`} />
                  {coreUp}/3 core services running
                </span>
                {data.database.migrations.pending > 0 && (
                  <>
                    <span className='text-xs text-muted-foreground/30'>&middot;</span>
                    <span className='text-xs text-amber-600 dark:text-amber-400'>{data.database.migrations.pending} pending migrations</span>
                  </>
                )}
              </div>
            </div>
            <Button variant='outline' size='sm' className='shrink-0 gap-2 self-start' onClick={() => void load()} disabled={loading}>
              <HugeiconsIcon icon={RefreshIcon} className='size-3.5' />
              {loading ? 'Running...' : 'Refresh'}
            </Button>
          </div>
        </div>

        <div className='flex flex-col gap-8 px-4 py-6 md:px-6'>

          <section className='space-y-3'>
            <div className='space-y-1'>
              <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>Core Services</p>
              <p className='text-xs text-muted-foreground'>Services the app depends on to run.</p>
            </div>
            <div className='overflow-hidden rounded-2xl border border-border'>
              <ServiceRow
                icon={<HugeiconsIcon icon={Database01Icon} className='size-4 text-muted-foreground' strokeWidth={2} />}
                name='PostgreSQL'
                detail={data.database.reachable ? 'Connected' : 'Cannot connect'}
                status={
                  data.database.reachable
                    ? <StatusIndicator status='ok' label='Connected' />
                    : <StatusIndicator status='error' label='Unreachable' />
                }
              >
                {data.database.reachable && (
                  <div className='grid grid-cols-2 gap-2 sm:grid-cols-4'>
                    {[
                      ['Users', data.database.counts.users],
                      ['Workspaces', data.database.counts.workspaces],
                      ['Assets', data.database.counts.assets],
                      ['API Keys', data.database.counts.apiKeys],
                    ].map(([label, value]) => (
                      <div key={label} className='space-y-0.5'>
                        <p className='text-[10px] text-muted-foreground'>{label}</p>
                        <p className='font-mono text-sm font-medium'>{Number(value).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
                {data.database.reachable && data.database.migrations.pending > 0 && (
                  <p className='mt-2 text-xs text-amber-600 dark:text-amber-400'>
                    {data.database.migrations.pending} migration{data.database.migrations.pending === 1 ? '' : 's'} pending — run db:migrate.
                  </p>
                )}
                {!data.database.reachable && (
                  <p className='text-xs text-red-600 dark:text-red-400'>Check DATABASE_URL and your network connection.</p>
                )}
              </ServiceRow>

              <ServiceRow
                icon={
                  <HugeiconsIcon
                    icon={data.dragonfly.connected ? Wifi01Icon : WifiOff01Icon}
                    className='size-4 text-muted-foreground'
                    strokeWidth={2}
                  />
                }
                name='Dragonfly'
                detail={data.dragonfly.connected ? 'Rate limiting and caching active' : data.dragonfly.urlConfigured ? 'Configured but not responding' : 'Not configured'}
                status={
                  data.dragonfly.connected
                    ? <StatusIndicator status='ok' label='Connected' />
                    : data.dragonfly.urlConfigured
                      ? <StatusIndicator status='warn' label='Offline' />
                      : <StatusIndicator status='neutral' label='Disabled' />
                }
              >
                {data.rateLimiter.mode === 'in-memory' && (
                  <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
                    <span>Mode: <span className='font-mono font-medium text-foreground'>in-memory</span></span>
                    {!data.dragonfly.urlConfigured && (
                      <span className='text-muted-foreground/70'>No DRAGONFLY_URL set — falling back to in-memory.</span>
                    )}
                  </div>
                )}
              </ServiceRow>

              <ServiceRow
                icon={<HugeiconsIcon icon={HardDriveIcon} className='size-4 text-muted-foreground' strokeWidth={2} />}
                name='Cloudflare R2'
                detail={data.r2.configured ? 'Ready' : 'Not configured'}
                status={data.r2.configured ? <StatusIndicator status='ok' label='Ready' /> : <StatusIndicator status='neutral' label='Not configured' />}
                border={false}
              >
                {!data.r2.configured && (
                  <p className='text-xs text-muted-foreground/70'>Set ORBIT_R2_ACCOUNT_ID, ORBIT_R2_ACCESS_KEY_ID, ORBIT_R2_SECRET_ACCESS_KEY, ORBIT_R2_BUCKET, and ORBIT_R2_PUBLIC_URL.</p>
                )}
              </ServiceRow>
            </div>
          </section>

          <section className='space-y-3'>
            <div className='space-y-1'>
              <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>Integrations</p>
              <p className='text-xs text-muted-foreground'>Third-party services and feature providers.</p>
            </div>
            <div className='overflow-hidden rounded-2xl border border-border'>
              <ServiceRow
                icon={<HugeiconsIcon icon={Mail01Icon} className='size-4 text-muted-foreground' strokeWidth={2} />}
                name='Resend Email'
                detail={data.email.resendConfigured ? 'Email delivery ready' : 'RESEND_API_KEY not set'}
                status={data.email.resendConfigured ? <StatusIndicator status='ok' label='Configured' /> : <StatusIndicator status='neutral' label='Not configured' />}
              />
              <ServiceRow
                icon={<HugeiconsIcon icon={SparklesIcon} className='size-4 text-muted-foreground' strokeWidth={2} />}
                name='Vercel Edge Config'
                detail={data.edgeConfig.configured ? 'Remote configuration active' : 'Not configured'}
                status={data.edgeConfig.configured ? <StatusIndicator status='ok' label='Configured' /> : <StatusIndicator status='neutral' label='Not configured' />}
                border={false}
              />
            </div>
          </section>

          <section className='space-y-3'>
            <div className='space-y-1'>
              <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>Authentication</p>
              <p className='text-xs text-muted-foreground'>Sign-in methods and passkey support.</p>
            </div>
            <div className='overflow-hidden rounded-2xl border border-border'>
              {([
                ['Google', data.auth.oauthProviders.google],
                ['GitHub', data.auth.oauthProviders.github],
                ['Discord', data.auth.oauthProviders.discord],
                ['CFX (FiveM)', data.auth.oauthProviders.cfx],
                ['Passkeys', data.auth.passkeyConfigured],
              ] as const).map(([name, configured], i, arr) => (
                <div key={name} className={'flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/40 ' + (i !== arr.length - 1 ? 'border-b border-border' : '')}>
                  <div className='flex min-w-0 items-center gap-3'>
                    <div className='flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted'>
                      <HugeiconsIcon icon={Shield02Icon} className='size-3.5 text-muted-foreground' strokeWidth={2} />
                    </div>
                    <p className='text-sm font-medium'>{name}</p>
                  </div>
                  {configured
                    ? <StatusIndicator status='ok' label='Configured' />
                    : <StatusIndicator status='neutral' label='Not configured' />}
                </div>
              ))}
            </div>
          </section>

          <section className='space-y-3'>
            <div className='space-y-1'>
              <p className='text-xs font-medium uppercase tracking-wider text-muted-foreground'>Uploads</p>
              <p className='text-xs text-muted-foreground'>File upload settings.</p>
            </div>
            <div className='overflow-hidden rounded-2xl border border-border'>
              <ServiceRow
                icon={<HugeiconsIcon icon={Folder01Icon} className='size-4 text-muted-foreground' strokeWidth={2} />}
                name='Upload Settings'
                detail={data.uploads.uploadsEnabled ? 'Enabled' : 'Disabled'}
                status={data.uploads.uploadsEnabled ? <StatusIndicator status='ok' label='Enabled' /> : <StatusIndicator status='neutral' label='Disabled' />}
              >
                <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
                  <div className='space-y-0.5'>
                    <p className='text-[10px] text-muted-foreground'>Workspace images</p>
                    <p className='font-mono text-sm font-medium'>{data.uploads.workspaceImageUploadsEnabled ? 'On' : 'Off'}</p>
                  </div>
                  <div className='space-y-0.5'>
                    <p className='text-[10px] text-muted-foreground'>Max pending</p>
                    <p className='font-mono text-sm font-medium'>{data.uploads.maxPendingUploadsPerWorkspace}</p>
                  </div>
                  <div className='space-y-0.5'>
                    <p className='text-[10px] text-muted-foreground'>Intent TTL</p>
                    <p className='font-mono text-sm font-medium'>{data.uploads.intentTtlSeconds}s</p>
                  </div>
                </div>
              </ServiceRow>

              <ServiceRow
                icon={<HugeiconsIcon icon={Settings02Icon} className='size-4 text-muted-foreground' strokeWidth={2} />}
                name='Configuration'
                detail='How settings are stored'
                status={<span className='font-mono text-xs capitalize'>{data.instance.configMode}</span>}
                border={false}
              >
                <div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
                  <span>API: <span className='font-mono text-foreground'>{data.instance.apiUrl}</span></span>
                  <span>Web: <span className='font-mono text-foreground'>{data.instance.webUrl}</span></span>
                </div>
              </ServiceRow>
            </div>
          </section>

        </div>
      </div>
    </AdminShell>
  )
}
