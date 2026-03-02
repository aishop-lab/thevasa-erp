'use client'

import { usePermissions, type Permission } from '@/hooks/use-permissions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldAlert } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface RoleGateProps {
  /** The permission required to view this content */
  permission: Permission
  /** Content to render if the user has the required permission */
  children: React.ReactNode
  /** Optional fallback message */
  message?: string
}

function AccessDenied({ message }: { message?: string }) {
  return (
    <Card className="mx-auto max-w-md mt-12">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <CardTitle>Access Restricted</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-center text-sm text-muted-foreground">
          {message ?? 'You don\u2019t have permission to access this page. Contact your team admin for access.'}
        </p>
      </CardContent>
    </Card>
  )
}

function RoleGateSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  )
}

/**
 * Wraps content with a role-based permission check.
 * Shows a loading skeleton while permissions are being fetched,
 * an access denied card if the user lacks the required permission,
 * or the children if the user has access.
 */
export function RoleGate({ permission, children, message }: RoleGateProps) {
  const { can, isLoading } = usePermissions()

  if (isLoading) return <RoleGateSkeleton />
  if (!can(permission)) return <AccessDenied message={message} />

  return <>{children}</>
}
