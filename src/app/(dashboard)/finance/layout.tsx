'use client'

import { RoleGate } from '@/components/role-gate'

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RoleGate
      permission="view_finance"
      message="Finance data is restricted to admin and accountant roles. Contact your team admin for access."
    >
      {children}
    </RoleGate>
  )
}
