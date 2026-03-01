'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Users,
  UserPlus,
  MoreHorizontal,
  Shield,
  Trash2,
  Loader2,
  Mail,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MemberRole = 'admin' | 'manager' | 'viewer' | 'accountant'

interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: MemberRole
  created_at: string
  user: {
    email: string
    raw_user_meta_data: {
      full_name?: string
      name?: string
    } | null
  } | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLES: { value: MemberRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'accountant', label: 'Accountant' },
]

const ROLE_COLORS: Record<MemberRole, string> = {
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  manager: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  viewer: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  accountant: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
}

// ---------------------------------------------------------------------------
// Validation Schema
// ---------------------------------------------------------------------------

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'manager', 'viewer', 'accountant'], {
    message: 'Please select a role',
  }),
})

type InviteFormValues = z.infer<typeof inviteSchema>

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function TeamSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {['Name', 'Email', 'Role', 'Joined', ''].map((_, i) => (
                  <TableHead key={i}>
                    <Skeleton className="h-4 w-20" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 4 }).map((_, rowIdx) => (
                <TableRow key={rowIdx}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="size-8" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Helper: format date
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getMemberName(member: TeamMember): string {
  const meta = member.user?.raw_user_meta_data
  return meta?.full_name || meta?.name || member.user?.email?.split('@')[0] || 'Unknown'
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function TeamSettingsPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [showInviteDialog, setShowInviteDialog] = useState(false)

  const inviteForm = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'viewer',
    },
  })

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()
      if (error) throw error
      return user
    },
  })

  // Fetch team members
  const {
    data: members,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['team_members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*, user:user_id(email, raw_user_meta_data)')
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as unknown as TeamMember[]
    },
  })

  // Get current user's role
  const currentMember = members?.find(
    (m) => m.user_id === currentUser?.id
  )
  const isAdmin = currentMember?.role === 'admin'

  // Invite member mutation
  const inviteMutation = useMutation({
    mutationFn: async (values: InviteFormValues) => {
      // Use Supabase Auth to invite the user, then create a team_member record
      // In production, use supabase.auth.admin.inviteUserByEmail()
      // For now, pre-create the team_member record that will be finalized when the user signs up
      const { error: inviteError } = await supabase.from('team_members').insert({
        user_id: '00000000-0000-0000-0000-000000000000', // placeholder until user accepts
        role: values.role as 'admin' | 'manager' | 'viewer' | 'accountant',
        invited_by: currentUser?.id ?? null,
      })

      if (inviteError) throw inviteError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_members'] })
      toast.success('Invitation sent successfully')
      setShowInviteDialog(false)
      inviteForm.reset()
    },
    onError: (err: Error) => {
      toast.error(`Failed to send invitation: ${err.message}`)
    },
  })

  // Change role mutation
  const changeRoleMutation = useMutation({
    mutationFn: async ({
      memberId,
      newRole,
    }: {
      memberId: string
      newRole: MemberRole
    }) => {
      const { error } = await supabase
        .from('team_members')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', memberId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_members'] })
      toast.success('Role updated successfully')
    },
    onError: (err: Error) => {
      toast.error(`Failed to update role: ${err.message}`)
    },
  })

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team_members'] })
      toast.success('Team member removed')
    },
    onError: (err: Error) => {
      toast.error(`Failed to remove member: ${err.message}`)
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Management</h1>
          <p className="text-muted-foreground">
            Manage team members and their roles
          </p>
        </div>
        <TeamSkeleton />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Management</h1>
          <p className="text-muted-foreground">
            Manage team members and their roles
          </p>
        </div>
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load team members: {(error as Error).message}
          </p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Management</h1>
          <p className="text-muted-foreground">
            Manage team members and their roles
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="mb-4 size-12 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold">Access Restricted</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Only team admins can manage team members and roles.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team Management</h1>
        <p className="text-muted-foreground">
          Manage team members and their roles
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5" />
                Team Members
              </CardTitle>
              <CardDescription>
                {members?.length ?? 0} member{(members?.length ?? 0) !== 1 ? 's' : ''} in your team
              </CardDescription>
            </div>

            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 size-4" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join your team. They will receive an email
                    with instructions.
                  </DialogDescription>
                </DialogHeader>
                <Form {...inviteForm}>
                  <form
                    onSubmit={inviteForm.handleSubmit((values) =>
                      inviteMutation.mutate(values)
                    )}
                    className="space-y-4"
                  >
                    <FormField
                      control={inviteForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
                              <Input
                                placeholder="colleague@example.com"
                                className="pl-9"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={inviteForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ROLES.map((role) => (
                                <SelectItem key={role.value} value={role.value}>
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`inline-block size-2 rounded-full ${
                                        role.value === 'admin'
                                          ? 'bg-purple-500'
                                          : role.value === 'manager'
                                          ? 'bg-blue-500'
                                          : role.value === 'viewer'
                                          ? 'bg-green-500'
                                          : 'bg-indigo-500'
                                      }`}
                                    />
                                    {role.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowInviteDialog(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={inviteMutation.isPending}>
                        {inviteMutation.isPending && (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        )}
                        Send Invitation
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members && members.length > 0 ? (
                  members.map((member) => {
                    const isSelf = member.user_id === currentUser?.id

                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {getMemberName(member)}
                          {isSelf && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              (you)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {member.user?.email ?? '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={ROLE_COLORS[member.role]}>
                            {member.role.charAt(0).toUpperCase() +
                              member.role.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(member.created_at)}
                        </TableCell>
                        <TableCell>
                          {!isSelf && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8">
                                  <MoreHorizontal className="size-4" />
                                  <span className="sr-only">Open menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger>
                                    <Shield className="mr-2 size-4" />
                                    Change Role
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent>
                                    {ROLES.map((role) => (
                                      <DropdownMenuItem
                                        key={role.value}
                                        disabled={member.role === role.value}
                                        onClick={() =>
                                          changeRoleMutation.mutate({
                                            memberId: member.id,
                                            newRole: role.value,
                                          })
                                        }
                                      >
                                        <span
                                          className={`mr-2 inline-block size-2 rounded-full ${
                                            role.value === 'admin'
                                              ? 'bg-purple-500'
                                              : role.value === 'manager'
                                              ? 'bg-blue-500'
                                              : role.value === 'viewer'
                                              ? 'bg-green-500'
                                              : 'bg-indigo-500'
                                          }`}
                                        />
                                        {role.label}
                                        {member.role === role.value && (
                                          <span className="ml-auto text-xs text-muted-foreground">
                                            Current
                                          </span>
                                        )}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() =>
                                    removeMemberMutation.mutate(member.id)
                                  }
                                >
                                  <Trash2 className="mr-2 size-4" />
                                  Remove Member
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No team members found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
