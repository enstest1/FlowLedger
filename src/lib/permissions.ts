export type OrgRole = 'ADMIN' | 'TREASURY' | 'APPROVER' | 'ACCOUNTANT'

export const permissions: Record<OrgRole, Record<string, string[]>> = {
  ADMIN: {
    org: ['read', 'update', 'delete'],
    members: ['read', 'invite', 'remove', 'change-role'],
    vendors: ['read', 'create', 'update', 'delete'],
    invoices: ['read', 'create', 'cancel'],
    batches: ['read', 'create', 'execute'],
    receipts: ['read', 'export'],
    settings: ['read', 'update'],
  },
  TREASURY: {
    org: ['read'],
    members: ['read'],
    vendors: ['read', 'create', 'update'],
    invoices: ['read', 'create'],
    batches: ['read', 'create', 'execute'],
    receipts: ['read', 'export'],
    settings: ['read'],
  },
  APPROVER: {
    org: ['read'],
    members: ['read'],
    vendors: ['read'],
    invoices: ['read', 'approve', 'reject'],
    batches: ['read'],
    receipts: ['read'],
    settings: [],
  },
  ACCOUNTANT: {
    org: ['read'],
    members: [],
    vendors: ['read'],
    invoices: ['read'],
    batches: ['read'],
    receipts: ['read', 'export'],
    settings: [],
  },
}

export function hasPermission(
  role: OrgRole,
  resource: string,
  action: string
): boolean {
  return permissions[role]?.[resource]?.includes(action) ?? false
}
