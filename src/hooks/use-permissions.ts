"use client";

import { useCurrentUser } from "./use-team";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Role = "admin" | "manager" | "viewer" | "accountant";

export type Permission =
  | "manage_team"
  | "manage_products"
  | "manage_inventory"
  | "manage_orders"
  | "manage_finance"
  | "manage_settings"
  | "manage_platforms"
  | "manage_warehouses"
  | "view_products"
  | "view_inventory"
  | "view_orders"
  | "view_finance"
  | "adjust_stock";

// Navigation section identifiers matching sidebar labels
export type NavSection =
  | "Dashboard"
  | "Products"
  | "Inventory"
  | "Orders"
  | "Finance"
  | "Settings";

// Settings sub-routes
export type SettingsChild = "General" | "Platforms" | "Team" | "Warehouses";

// ---------------------------------------------------------------------------
// Permission Matrix
// ---------------------------------------------------------------------------

const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  admin: new Set([
    "manage_team",
    "manage_products",
    "manage_inventory",
    "manage_orders",
    "manage_finance",
    "manage_settings",
    "manage_platforms",
    "manage_warehouses",
    "view_products",
    "view_inventory",
    "view_orders",
    "view_finance",
    "adjust_stock",
  ]),
  manager: new Set([
    "manage_products",
    "manage_inventory",
    "manage_orders",
    "manage_settings",
    "manage_platforms",
    "manage_warehouses",
    "view_products",
    "view_inventory",
    "view_orders",
    "adjust_stock",
  ]),
  accountant: new Set([
    "manage_finance",
    "view_orders",
    "view_finance",
  ]),
  viewer: new Set([
    "view_products",
    "view_inventory",
    "view_orders",
  ]),
};

// Navigation visibility: which roles can see each top-level nav section
const NAV_VISIBILITY: Record<NavSection, Role[]> = {
  Dashboard: ["admin", "manager", "accountant", "viewer"],
  Products: ["admin", "manager", "viewer"],
  Inventory: ["admin", "manager", "viewer"],
  Orders: ["admin", "manager", "accountant", "viewer"],
  Finance: ["admin", "accountant"],
  Settings: ["admin", "manager", "accountant"],
};

// Settings children visibility
const SETTINGS_CHILD_VISIBILITY: Record<SettingsChild, Role[]> = {
  General: ["admin", "manager", "accountant"],
  Platforms: ["admin", "manager"],
  Team: ["admin"],
  Warehouses: ["admin", "manager"],
};

// ---------------------------------------------------------------------------
// Pure utility functions (no hooks, can be used anywhere)
// ---------------------------------------------------------------------------

export function hasPermission(role: Role | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function canViewNav(role: Role | null, section: NavSection): boolean {
  if (!role) return false;
  return NAV_VISIBILITY[section]?.includes(role) ?? false;
}

export function canViewSettingsChild(role: Role | null, child: SettingsChild): boolean {
  if (!role) return false;
  return SETTINGS_CHILD_VISIBILITY[child]?.includes(role) ?? false;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePermissions() {
  const { data: currentUser, isLoading } = useCurrentUser();
  const role = (currentUser?.role as Role) ?? null;

  return {
    role,
    isLoading,
    /** Check if user has a specific permission */
    can: (permission: Permission) => hasPermission(role, permission),
    /** Check if user can see a navigation section */
    canViewNav: (section: NavSection) => canViewNav(role, section),
    /** Check if user can see a specific settings sub-page */
    canViewSettingsChild: (child: SettingsChild) => canViewSettingsChild(role, child),
    /** Convenience: is admin */
    isAdmin: role === "admin",
    /** Convenience: is at least manager (admin or manager) */
    isManagerOrAbove: role === "admin" || role === "manager",
  };
}
