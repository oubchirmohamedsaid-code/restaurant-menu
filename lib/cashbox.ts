export type CashboxTxType = "income" | "expense" | "adjustment" | "deposit" | "withdrawal";
export type CashboxDirection = "in" | "out";

export const CASHBOX_TX_TYPES: CashboxTxType[] = [
  "income",
  "expense",
  "adjustment",
  "deposit",
  "withdrawal",
];

export const CASHBOX_METHODS: string[] = ["cash", "card", "transfer", "epayment", "other"];

export const ELECTRONIC_METHODS: string[] = ["card", "transfer", "epayment"];

export const EXPENSE_CATEGORIES: string[] = [
  "شراء مواد أولية",
  "كهرباء",
  "غاز",
  "ماء",
  "توصيل",
  "صيانة",
  "رواتب",
  "أخرى",
];

export const DIFF_REASONS: string[] = [
  "نقص في الصندوق",
  "زيادة في الصندوق",
  "خطأ في الحساب",
  "مصروف لم يسجل",
  "دخل لم يسجل",
  "أخرى",
];

export const CASHBOX_TX_LABELS: Record<CashboxTxType, string> = {
  income: "دخل",
  expense: "مصروف",
  adjustment: "تصحيح",
  deposit: "إيداع",
  withdrawal: "سحب",
};

export const CASHBOX_METHOD_LABELS: Record<string, string> = {
  cash: "نقداً",
  card: "بطاقة",
  transfer: "تحويل",
  epayment: "دفع إلكتروني",
  other: "أخرى",
};

export function defaultDirection(type: CashboxTxType): CashboxDirection {
  switch (type) {
    case "expense":
    case "withdrawal":
      return "out";
    default:
      return "in";
  }
}

export function txEffectCents(tx: { direction: CashboxDirection; amountCents: number }): number {
  return tx.direction === "in" ? tx.amountCents : -tx.amountCents;
}

export interface CashboxTxRow {
  id: number;
  txNumber: number;
  type: CashboxTxType;
  direction: CashboxDirection;
  amountCents: number;
  paymentMethod: string;
  source: string;
  orderId: number | null;
  sessionId: number | null;
  userId: number;
  userName: string;
  note: string;
  status: string;
  correctsTxId: number | null;
  createdAt: number;
}

export interface CashboxSessionRow {
  id: number;
  openedAt: number;
  openingBalanceCents: number;
  openedById: number;
  openedByName: string;
  status: string;
  closedAt: number | null;
  closedById: number;
  closedByName: string;
  expectedCents: number;
  actualCents: number;
  diffCents: number;
  note: string;
  closeReason: string;
}

export interface CashboxActor {
  id: number;
  username: string;
  role?: string;
}

export interface CashboxTxInput {
  type: CashboxTxType;
  direction?: CashboxDirection;
  amountCents: number;
  paymentMethod?: string;
  source?: string;
  orderId?: number | null;
  note?: string;
  actor?: CashboxActor;
}

export interface CashboxSummaryPeriod {
  incomeCents: number;
  expenseCents: number;
  depositCents: number;
  withdrawalCents: number;
  adjustmentInCents: number;
  adjustmentOutCents: number;
  salesCashCents: number;
  salesElectronicCents: number;
}

export interface CashboxDayStat {
  key: string;
  label: string;
  inCents: number;
  outCents: number;
}

export interface CashboxByTypeStat {
  type: CashboxTxType;
  count: number;
  amountCents: number;
}

export interface CashboxSummary {
  currentBalanceCents: number;
  openSession: CashboxSessionRow | null;
  period: CashboxSummaryPeriod;
  salesCents: number;
  paidOrders: number;
  txCount: number;
  byDay: CashboxDayStat[];
  byType: CashboxByTypeStat[];
}

export interface CashboxListFilters {
  from?: number;
  to?: number;
  type?: string;
  method?: string;
  methodIn?: string[];
  direction?: CashboxDirection;
  user?: string;
  source?: string;
  orderId?: number;
  sessionId?: number;
  search?: string;
  limit?: number;
}

export interface CashboxSessionDetail {
  session: CashboxSessionRow;
  breakdown: {
    salesCents: number;
    manualIncomeCents: number;
    depositCents: number;
    expenseCents: number;
    withdrawalCents: number;
    adjustmentInCents: number;
    adjustmentOutCents: number;
  };
  rows: CashboxTxRow[];
}
