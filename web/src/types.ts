export type FlowType = "income" | "expense";
export type AccountType = "bank" | "cash" | "credit_card";

export interface User {
  id: string;
  name: string;
  email: string;
  currencyDefault: string;
  createdAt: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: FlowType;
  parentCategoryId: string | null;
  isDefault: boolean;
  createdAt: string;
  children?: Category[];
}

export interface Attachment {
  id: string;
  transactionId: string;
  fileName: string;
  fileType: "image" | "pdf";
  fileSize: number;
  uploadedAt: string;
  downloadUrl: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string;
  type: FlowType;
  amount: string;
  currency: string;
  date: string;
  description: string | null;
  vendorName: string | null;
  vendorGstin: string | null;
  taxAmount: string;
  paymentMethod: string | null;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
  account?: Account;
  category?: Category;
  attachments?: Attachment[];
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  pagination: Pagination;
}

export interface PnlCategoryTotal {
  categoryId: string;
  name: string;
  total: string;
}

export interface PnlComparison {
  period: { from: string; to: string };
  totalIncome: string;
  totalExpense: string;
  netProfit: string;
  change: {
    totalIncome: number | null;
    totalExpense: number | null;
    netProfit: number | null;
  };
}

export interface PnlResponse {
  period: { from: string; to: string };
  income: PnlCategoryTotal[];
  expenses: PnlCategoryTotal[];
  totalIncome: string;
  totalExpense: string;
  netProfit: string;
  comparison?: PnlComparison;
}

export interface DashboardOverview {
  netIncomeThisMonth: string;
  totalIncomeThisMonth: string;
  totalExpenseThisMonth: string;
  incomeVsExpenseMonthly: { month: string; income: string; expense: string }[];
  expenseByCategory: PnlCategoryTotal[];
  recentTransactions: Transaction[];
}

export interface AuditLogEntry {
  id: string;
  transactionId: string | null;
  changedBy: string;
  action: "create" | "update" | "delete";
  fieldChanged: string | null;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
}

export type RecurringFrequency = "weekly" | "monthly" | "yearly";

export interface RecurringRule {
  id: string;
  type: FlowType;
  amount: string;
  currency: string;
  accountId: string;
  categoryId: string;
  vendorName: string | null;
  description: string | null;
  taxAmount: string;
  paymentMethod: string | null;
  frequency: RecurringFrequency;
  dayOfMonth: number | null;
  nextRunDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  account?: Account;
  category?: Category;
}

export interface Budget {
  id: string;
  categoryId: string;
  periodMonth: string;
  amount: string;
  category?: Category;
  spent?: string;
  remaining?: string;
  progress?: number;
}

export interface CashFlowAccount {
  accountId: string;
  name: string;
  type: AccountType;
  openingBalance: string;
  inflow: string;
  outflow: string;
  net: string;
  balance: string;
}

export interface CashFlowResponse {
  period: { from: string; to: string };
  accounts: CashFlowAccount[];
  totalInflow: string;
  totalOutflow: string;
  netCashFlow: string;
  monthly: { month: string; inflow: string; outflow: string }[];
}

export interface InsightsResponse {
  monthly: {
    month: string;
    income: string;
    expense: string;
    net: string;
    expenseToIncomeRatio: number | null;
  }[];
  momGrowth: { income: number | null; expense: number | null; net: number | null };
  topExpenseCategories: PnlCategoryTotal[];
}
