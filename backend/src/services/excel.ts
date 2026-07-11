import ExcelJS from "exceljs";
import type { Account, Category, Transaction } from "@prisma/client";
import type { PnlResult } from "./pnl";

type TxWithRefs = Transaction & { account: Account; category: Category };

const CURRENCY_SYMBOL: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

function currencyFormat(code: string): string {
  const symbol = CURRENCY_SYMBOL[code] ?? `${code} `;
  return `"${symbol}"#,##0.00;[Red]-"${symbol}"#,##0.00`;
}

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F2937" },
};

function styleHeader(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = HEADER_FILL;
  row.alignment = { vertical: "middle" };
}

/**
 * Builds the finance report workbook: raw Transactions, P&L Summary, and Category
 * Breakdown sheets. Totals use SUM formulas (not hardcoded) and money cells carry a
 * currency number format.
 */
export function buildPnlWorkbook(params: {
  currency: string;
  from: string;
  to: string;
  transactions: TxWithRefs[];
  pnl: PnlResult;
  generatedBy: string;
}): ExcelJS.Workbook {
  const { currency, from, to, transactions, pnl } = params;
  const money = currencyFormat(currency);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Finance Tracker";
  wb.created = new Date();

  // --- Sheet 1: Transactions (raw data) ---
  const txSheet = wb.addWorksheet("Transactions");
  txSheet.columns = [
    { header: "Date", key: "date", width: 12 },
    { header: "Type", key: "type", width: 10 },
    { header: "Category", key: "category", width: 26 },
    { header: "Account", key: "account", width: 18 },
    { header: "Description", key: "description", width: 30 },
    { header: "Vendor", key: "vendor", width: 20 },
    { header: "Vendor GSTIN", key: "gstin", width: 18 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Tax", key: "tax", width: 12 },
    { header: "Payment Method", key: "payment", width: 16 },
    { header: "Currency", key: "currency", width: 10 },
  ];
  styleHeader(txSheet.getRow(1));

  for (const t of transactions) {
    txSheet.addRow({
      date: t.date.toISOString().slice(0, 10),
      type: t.type,
      category: t.category.name,
      account: t.account.name,
      description: t.description ?? "",
      vendor: t.vendorName ?? "",
      gstin: t.vendorGstin ?? "",
      amount: Number(t.amount),
      tax: Number(t.taxAmount),
      payment: t.paymentMethod ?? "",
      currency: t.currency,
    });
  }
  const lastDataRow = transactions.length + 1; // header is row 1
  txSheet.getColumn("amount").numFmt = money;
  txSheet.getColumn("tax").numFmt = money;

  // Formula-based total row.
  const totalRow = txSheet.addRow({});
  totalRow.getCell("category").value = "TOTAL";
  totalRow.getCell("category").font = { bold: true };
  if (transactions.length > 0) {
    const amountTotal = totalRow.getCell("amount");
    amountTotal.value = { formula: `SUM(H2:H${lastDataRow})` };
    amountTotal.numFmt = money;
    amountTotal.font = { bold: true };
    const taxTotal = totalRow.getCell("tax");
    taxTotal.value = { formula: `SUM(I2:I${lastDataRow})` };
    taxTotal.numFmt = money;
    taxTotal.font = { bold: true };
  }
  txSheet.views = [{ state: "frozen", ySplit: 1 }];
  txSheet.autoFilter = { from: "A1", to: `K1` };

  // --- Sheet 2: P&L Summary ---
  const pnl2 = wb.addWorksheet("P&L Summary");
  pnl2.columns = [
    { header: "", key: "label", width: 34 },
    { header: "", key: "value", width: 18 },
  ];
  pnl2.mergeCells("A1:B1");
  pnl2.getCell("A1").value = `Profit & Loss Statement — ${from} to ${to} (${currency})`;
  pnl2.getCell("A1").font = { bold: true, size: 13 };

  const addSectionHeader = (title: string) => {
    const r = pnl2.addRow({ label: title });
    r.getCell("label").font = { bold: true, color: { argb: "FFFFFFFF" } };
    r.getCell("label").fill = HEADER_FILL;
    r.getCell("value").fill = HEADER_FILL;
  };

  pnl2.addRow({});
  addSectionHeader("INCOME");
  const incomeStart = pnl2.rowCount + 1;
  for (const c of pnl.income) pnl2.addRow({ label: c.name, value: Number(c.total) });
  const incomeEnd = pnl2.rowCount;
  const incomeTotalRow = pnl2.addRow({ label: "Total Income" });
  incomeTotalRow.getCell("value").value =
    pnl.income.length > 0 ? { formula: `SUM(B${incomeStart}:B${incomeEnd})` } : 0;
  incomeTotalRow.font = { bold: true };

  pnl2.addRow({});
  addSectionHeader("EXPENSES");
  const expenseStart = pnl2.rowCount + 1;
  for (const c of pnl.expenses) pnl2.addRow({ label: c.name, value: Number(c.total) });
  const expenseEnd = pnl2.rowCount;
  const expenseTotalRow = pnl2.addRow({ label: "Total Expenses" });
  expenseTotalRow.getCell("value").value =
    pnl.expenses.length > 0 ? { formula: `SUM(B${expenseStart}:B${expenseEnd})` } : 0;
  expenseTotalRow.font = { bold: true };

  pnl2.addRow({});
  const netRow = pnl2.addRow({ label: "NET PROFIT / (LOSS)" });
  netRow.getCell("value").value = {
    formula: `B${incomeTotalRow.number}-B${expenseTotalRow.number}`,
  };
  netRow.font = { bold: true, size: 12 };
  pnl2.getColumn("value").numFmt = money;

  // --- Sheet 3: Category Breakdown ---
  const cat = wb.addWorksheet("Category Breakdown");
  cat.columns = [
    { header: "Type", key: "type", width: 12 },
    { header: "Category", key: "category", width: 30 },
    { header: "Total", key: "total", width: 16 },
  ];
  styleHeader(cat.getRow(1));
  for (const c of pnl.income) cat.addRow({ type: "income", category: c.name, total: Number(c.total) });
  for (const c of pnl.expenses) cat.addRow({ type: "expense", category: c.name, total: Number(c.total) });
  cat.getColumn("total").numFmt = money;
  cat.views = [{ state: "frozen", ySplit: 1 }];

  return wb;
}
