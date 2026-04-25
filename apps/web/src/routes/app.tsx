import { useMemo, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"

import type { OrbitSessionUser } from "@/lib/auth-types"
import { authClient } from "@/lib/auth-client"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/avatar"
import { Badge } from "@/components/badge"
import { Button } from "@/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/card"
import { Separator } from "@/components/separator"
import { Spinner } from "@/components/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/alert"

export const Route = createFileRoute("/app")({ component: AppPage })

function AppPage() {
  const session = authClient.useSession()
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const user = useMemo(
    () => (session.data?.user as OrbitSessionUser | undefined) ?? null,
    [session.data]
  )

  async function handleAddPasskey() {
    if (typeof window === "undefined" || !("PublicKeyCredential" in window)) {
      setMessage("Passkeys are not supported in this browser.")
      return
    }

    setPendingAction("passkey")
    setMessage(null)

    const result = await authClient.passkey.addPasskey({
      name: "Orbit passkey",
    })

    if (result.error) {
      setMessage(result.error.message ?? "Unable to save a passkey.")
      setPendingAction(null)
      return
    }

    setMessage("Passkey saved to your Orbit account.")
    setPendingAction(null)
  }

  async function handleLogout() {
    setPendingAction("logout")
    setMessage(null)

    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.assign("/")
        },
      },
    })
  }

  if (session.isPending) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-4">
        <Spinner className="size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    )
  }

  if (!session.data || !user) {
    return (
      <main className="flex min-h-svh items-center justify-center px-6 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <Badge className="w-fit">Orbit App</Badge>
            <CardTitle>You are not signed in</CardTitle>
            <CardDescription>
              Sign in first, then come back here to inspect the data stored for
              your account.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3">
            <Button className="w-full" render={<Link to="/auth" />}>
              Go to sign in
            </Button>
            <Button variant="ghost" className="w-full" render={<Link to="/" />}>
              Back to landing page
            </Button>
          </CardFooter>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-svh px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Orbit App</Badge>
                  <Badge variant="outline">Signed in</Badge>
                  <Badge variant={user.role === "admin" ? "secondary" : "outline"}>
                    {user.role ?? "user"}
                  </Badge>
                </div>
                <CardTitle>Signed in successfully</CardTitle>
                <CardDescription>
                  This page shows the account data currently available for your
                  Orbit user record.
                </CardDescription>
              </div>

              <div className="flex items-center gap-3">
                <Avatar size="lg">
                  <AvatarImage
                    src={user.image ?? undefined}
                    alt={user.name ?? user.username ?? user.email}
                  />
                  <AvatarFallback>
                    {(user.name ?? user.username ?? user.email).slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {user.name ?? user.username ?? "Orbit User"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stored user data</CardTitle>
            <CardDescription>
              The current session payload coming from Better Auth.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <DataRow label="User ID" value={user.id} />
                <DataRow label="Username" value={user.username ?? user.name ?? "Not available yet"} />
                <DataRow label="Email" value={user.email} />
                <DataRow label="Email verified" value={user.emailVerified ? "Yes" : "No"} />
                <DataRow label="Display name" value={user.name ?? "Not set"} />
                <DataRow label="Role" value={user.role ?? "user"} />
                <DataRow label="Profile picture" value={user.image ?? "Not set"} />
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Raw user data</CardTitle>
            <CardDescription>
              Useful while the admin panel is still being wired up.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg border border-border bg-background/80 p-4 text-xs leading-6 text-foreground">
              {JSON.stringify(user, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>
              Manage your current session and passwordless setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {message ? (
              <Alert>
                <AlertTitle>Orbit update</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {user.role === "admin" ? (
                <Button render={<Link to="/admin" />}>Open admin dashboard</Button>
              ) : null}
              <Button
                disabled={pendingAction !== null}
                onClick={() => void handleAddPasskey()}
              >
                {pendingAction === "passkey"
                  ? "Saving passkey..."
                  : "Add passkey to this account"}
              </Button>
              <Button
                variant="outline"
                disabled={pendingAction !== null}
                onClick={() => void handleLogout()}
              >
                {pendingAction === "logout" ? "Logging out..." : "Logout"}
              </Button>
            </div>

            <Separator />

            <p className="text-xs text-muted-foreground">
              Non-admin users stay on this page after sign-in. Instance admins
              can also enter the protected admin dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">{label}</TableCell>
      <TableCell className="whitespace-normal break-words text-muted-foreground">
        {value}
      </TableCell>
    </TableRow>
  )
}
