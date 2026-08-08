export type Role = 'Founder' | 'Admin' | 'Sales' | 'Operations' | 'Finance' | 'Support';

export const PERMISSION_MATRIX: Record<Role, string[]> = {
  Founder: ['ALL'],
  Admin: [
    'customers',
    'products',
    'productVariants',
    'orders',
    'orderItems',
    'inventory',
    'inventoryTransactions',
    'finance',
    'settings',
    'audit',
    'expenses',
    'payments',
    'auditLogs',
    'users',
    'leads',
    'campaigns',
    'tasks',
    'supportTickets',
    'notifications',
    'returns',
    'samples',
    'nlu',
    'agents',
  ],
  Sales: [
    'customers',
    'orders',
    'orderItems',
    'leads',
    'campaigns',
    'samples',
    'products',
    'productVariants',
    'returns',
    'notifications',
    'nlu',
    'agents',
    'payments', // allowed to read payments history & record payments
  ],
  Operations: [
    'inventory',
    'inventoryTransactions',
    'orders',
    'orderItems',
    'tasks',
    'products',
    'productVariants',
    'returns',
    'notifications',
  ],
  Finance: [
    'payments',
    'expenses',
    'finance',
    'orders',
    'orderItems',
    'customers',
    'notifications',
  ],
  Support: [
    'customers',
    'supportTickets',
    'orders',
    'orderItems',
    'notifications',
  ],
};

export const COLLECTION_PERMISSIONS: Record<string, { read: Role[]; write: Role[] }> = {
  customers: {
    read: ['Founder', 'Admin', 'Sales', 'Finance', 'Support'],
    write: ['Founder', 'Admin', 'Sales'],
  },
  products: {
    read: ['Founder', 'Admin', 'Sales', 'Operations', 'Finance', 'Support'],
    write: ['Founder', 'Admin'],
  },
  productVariants: {
    read: ['Founder', 'Admin', 'Sales', 'Operations', 'Finance', 'Support'],
    write: ['Founder', 'Admin'],
  },
  orders: {
    read: ['Founder', 'Admin', 'Sales', 'Operations', 'Finance', 'Support'],
    write: ['Founder', 'Admin', 'Sales'],
  },
  orderItems: {
    read: ['Founder', 'Admin', 'Sales', 'Operations', 'Finance', 'Support'],
    write: ['Founder', 'Admin', 'Sales'],
  },
  inventory: {
    read: ['Founder', 'Admin', 'Operations'],
    write: ['Founder', 'Admin', 'Operations'],
  },
  inventoryTransactions: {
    read: ['Founder', 'Admin', 'Operations'],
    write: [], // Prohibited directly (system-only transaction history)
  },
  payments: {
    read: ['Founder', 'Admin', 'Finance', 'Sales'],
    write: [], // Prohibited directly via generic API (must use dedicated payment endpoint)
  },
  expenses: {
    read: ['Founder', 'Admin', 'Finance'],
    write: [], // Prohibited directly via generic API (must use dedicated expenses endpoint)
  },
  leads: {
    read: ['Founder', 'Admin', 'Sales'],
    write: ['Founder', 'Admin', 'Sales'],
  },
  campaigns: {
    read: ['Founder', 'Admin', 'Sales'],
    write: ['Founder', 'Admin', 'Sales'],
  },
  supportTickets: {
    read: ['Founder', 'Admin', 'Support'],
    write: ['Founder', 'Admin', 'Support'],
  },
  tasks: {
    read: ['Founder', 'Admin', 'Operations'],
    write: ['Founder', 'Admin', 'Operations'],
  },
  notifications: {
    read: ['Founder', 'Admin', 'Sales', 'Operations', 'Finance', 'Support'],
    write: ['Founder', 'Admin'],
  },
  auditLogs: {
    read: ['Founder', 'Admin'],
    write: [], // Prohibited directly via generic API (must be system generated only)
  },
  samples: {
    read: ['Founder', 'Admin', 'Sales'],
    write: [], // Prohibited directly via generic API
  },
  returns: {
    read: ['Founder', 'Admin', 'Operations', 'Sales'],
    write: ['Founder', 'Admin', 'Operations', 'Sales'],
  },
  telegramPendingActions: {
    read: ['Founder', 'Admin'],
    write: [], // Prohibited directly via generic API
  },
  telegramProcessedUpdates: {
    read: ['Founder', 'Admin'],
    write: [], // Prohibited directly via generic API
  },
};

export function hasPermission(role: Role, resource: string): boolean {
  const permissions = PERMISSION_MATRIX[role] || [];
  return permissions.includes('ALL') || permissions.includes(resource);
}
