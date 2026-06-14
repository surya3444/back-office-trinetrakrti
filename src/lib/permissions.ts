// Modules that roles grant read/write access to. Keys map to route guards and
// the sidebar; labels are shown in the role editor.
export interface ModuleDef { key: string; label: string }

export const MODULES: ModuleDef[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "leads", label: "Leads (triage)" },
  { key: "pipeline", label: "Lead Pipeline" },
  { key: "followups", label: "Follow-ups" },
  { key: "crm", label: "CRM" },
  { key: "projects", label: "Projects" },
  { key: "products", label: "Products" },
  { key: "settings", label: "Lead Settings" },
];

export type Action = "read" | "write";

export interface RolePermissions {
  [moduleKey: string]: { read?: boolean; write?: boolean };
}

export interface Role {
  id: string;
  name: string;
  isAdmin?: boolean; // full access, incl. roles / members / activity log
  permissions: RolePermissions;
  createdAt?: any;
}

export interface Member {
  uid: string;
  email: string;
  name: string;
  roleId: string | null;
  roleName?: string;
  disabled?: boolean;
  createdAt?: any;
  createdBy?: string;
}

// A permission map granting everything — used to seed the bootstrap admin role.
export function fullPermissions(): RolePermissions {
  const p: RolePermissions = {};
  for (const m of MODULES) p[m.key] = { read: true, write: true };
  return p;
}
