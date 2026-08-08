export type QualityGrade = 'Eco' | 'Standard' | 'Premium';
export type ProductVariant = 'Room Freshener' | 'Bathroom Freshener';

export type UserRole =
  | 'Founder'
  | 'Admin'
  | 'Sales'
  | 'Operations'
  | 'Finance'
  | 'Support';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}

export interface QualityPricing {
  buyPrice: number;
  salePrice: number;
  baseProfit: number;
}

export const PRICING_MATRIX: Record<QualityGrade, QualityPricing> = {
  Eco: {
    buyPrice: 650,
    salePrice: 900,
    baseProfit: 250,
  },
  Standard: {
    buyPrice: 750,
    salePrice: 1200,
    baseProfit: 450,
  },
  Premium: {
    buyPrice: 950,
    salePrice: 1500,
    baseProfit: 550,
  },
};

export interface LiquidStockPool {
  quality: QualityGrade;
  currentStock5L: number; // Number of 5L cans available in physical liquid pool
  lowStockThreshold: number;
  lastRestockedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  businessName?: string;
  place: string; // e.g. Trichy, Madurai, Chennai
  phone: string;
  outstandingBalance: number;
  free200mlSamplesUsed: number; // Max 2 per customer lifetime
  totalOrdersCount: number;
  totalSpent: number;
  createdAt: string;
  isArchived: boolean;
}

export interface OrderItem {
  id: string;
  productVariant: ProductVariant;
  quality: QualityGrade;
  quantity: number; // Number of 5L cans
  buyPricePerUnit: number;
  salePricePerUnit: number;
  discountPerUnit: number; // Absolute ₹ amount
  realizedProfitPerUnit: number; // (salePrice - buyPrice - discountPerUnit)
  totalAmount: number;
  totalProfit: number;
}

export interface SampleDistribution {
  id: string;
  customerId: string;
  customerName: string;
  sampleType: '200ml' | '500ml';
  isFree: boolean; // First two 200ml are free, additional 200ml = ₹200, 500ml = ₹300
  quantity: number;
  chargeAmount: number; // Free = 0, Paid 200ml = 200, Paid 500ml = 300
  profit: number; // ALWAYS ₹0 profit
  distributedAt: string;
  followUpDueDate: string; // Exactly +3 days
  followUpStatus: 'Pending' | 'Completed' | 'Overdue';
  followUpNotes?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPlace: string;
  items: OrderItem[];
  totalAmount: number;
  totalDiscount: number;
  totalProfit: number;
  paidAmount: number;
  paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
  samples?: SampleDistribution[];
  orderDate: string; // UTC ISO string
  isReturned: boolean;
  returnedAt?: string;
  returnReason?: string;
  notes?: string;
  source: 'Telegram Voice' | 'Telegram Text' | 'Dashboard Manual';
  isArchived: boolean;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  amount: number;
  paymentMethod: 'Cash' | 'UPI' | 'Bank Transfer';
  receivedAt: string;
  notes?: string;
}

export interface ExpenseRecord {
  id: string;
  title: string;
  category: 'Fuel & Field Travel' | 'Raw Essence' | 'Packaging & Cans' | 'Logistics' | 'Sales Commission' | 'Utilities';
  amount: number;
  date: string;
  loggedBy: string;
  notes?: string;
}

export interface ReturnRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  returnedItems: {
    productVariant: ProductVariant;
    quality: QualityGrade;
    quantity: number;
    reversedProfit: number;
  }[];
  totalReversedProfit: number;
  totalRefundAmount: number;
  returnedAt: string;
  reason: string;
}

export interface AIAgent {
  id: string;
  name: string;
  role: 'CEO Agent' | 'Sales Agent' | 'Marketing Agent' | 'Support Agent' | 'Inventory Agent' | 'Finance Agent';
  description: string;
  status: 'Active' | 'Standby' | 'Running';
  allowedTools: string[];
  lastRunAt?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: 'New Order' | 'Low Stock' | 'Payment Pending' | '3-Day Sample Due';
  action: 'Send Telegram Alert' | 'Schedule Follow-Up' | 'Generate Invoice' | 'Log Audit Event';
  isActive: boolean;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: 'Order Created' | 'Payment Received' | 'Return Processed' | 'Sample Distributed' | 'Stock Restocked' | 'FollowUp Scheduled';
  title: string;
  description: string;
  customerId?: string;
  customerName?: string;
  metadata?: Record<string, any>;
}

export interface VoiceParseResult {
  customerName: string;
  place: string;
  productVariant: ProductVariant;
  quality: QualityGrade;
  quantity: number;
  discount: number; // Absolute ₹ amount
  paymentAmount: number;
  paymentStatus: 'Paid' | 'Partial' | 'Unpaid';
  samplesRequested: {
    sampleType: '200ml' | '500ml';
    quantity: number;
  }[];
  isReturnRequest: boolean;
  rawTranscript: string;
  confidenceScore: number;
  needsClarification: boolean;
  clarificationQuestion?: string;
  suggestedAction?: string;
}
