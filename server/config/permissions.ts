export type Role = 'Founder' | 'Admin' | 'Sales' | 'Operations' | 'Finance' | 'Support';

export const PERMISSION_MATRIX: Record<Role, string[]> = {
  Founder: ['ALL'],
  Admin: [
    'customers',
    'products',
    'orders',
    'inventory',
    'finance',
    'settings',
    'audit',
    'expenses',
    'payments',
    'auditLogs',
    'users',
    'leads',
    'tasks',
    'supportTickets',
    'nlu',
    'agents',
  ],
  Sales: ['customers', 'orders', 'leads', 'samples', 'products', 'nlu', 'agents'],
  Operations: ['inventory', 'orders', 'tasks', 'products'],
  Finance: ['payments', 'expenses', 'finance', 'orders', 'customers'],
  Support: ['customers', 'supportTickets', 'orders'],
};

export function hasPermission(role: Role, resource: string): boolean {
  const permissions = PERMISSION_MATRIX[role] || [];
  return permissions.includes('ALL') || permissions.includes(resource);
}
