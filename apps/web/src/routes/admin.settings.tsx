import { createFileRoute } from "@tanstack/react-router"

import { AdminShell } from "@/components/admin-shell"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert"
import { Badge } from "@/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/table"

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettingsPage,
})

function AdminSettingsPage() {
  return (
    <AdminShell
      activeItem="settings"
      title="Instance settings"
      description="This is the reserved space for global Orbit configuration. Keep instance-wide settings here and leave tenant-specific controls for later." 
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Settings</Badge>
              <Badge variant="outline">WIP</Badge>
            </div>
            <CardTitle>Global configuration map</CardTitle>
            <CardDescription>
              These settings are not editable yet, but this table marks the
              right home for them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Area</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Purpose</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Deployment mode</TableCell>
                  <TableCell>Planned</TableCell>
                  <TableCell>SaaS vs self-hosted defaults</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Authentication</TableCell>
                  <TableCell>Planned</TableCell>
                  <TableCell>Provider toggles and passkey policy</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Branding</TableCell>
                  <TableCell>Planned</TableCell>
                  <TableCell>App name, logos, and panel identity</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Security</TableCell>
                  <TableCell>Planned</TableCell>
                  <TableCell>Role defaults, invite policy, and audit retention</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Alert>
            <AlertTitle>Admin-only surface</AlertTitle>
            <AlertDescription>
              Only instance admins should ever reach this page. Later, sensitive
              actions like auth rotation or environment switching can live here.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle>What belongs here later</CardTitle>
              <CardDescription>
                Keep these global; they should not be mixed into user pages.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>• provider enable/disable switches</p>
              <p>• instance-wide SaaS defaults</p>
              <p>• support and moderation policies</p>
              <p>• branding and white-label configuration</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminShell>
  )
}
