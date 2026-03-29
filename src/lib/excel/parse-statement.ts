import * as XLSX from "xlsx";

export interface ParsedTransaction {
  tx_date: string;
  description: string;
  amount: number;
  category: string | null;
  reference: string | null;
}

export type StatementFormat = "amex" | "bank" | "auto";

const DATE_HEADERS = ["date", "trans date", "transaction date", "posting date", "post date"];
const DESC_HEADERS = ["description", "merchant", "payee", "memo", "details", "narrative", "transaction description"];
const AMOUNT_HEADERS = ["amount", "total", "charge", "charges"];
const DEBIT_HEADERS = ["debit", "debits", "withdrawal", "withdrawals"];
const CREDIT_HEADERS = ["credit", "credits", "deposit", "deposits"];
const CATEGORY_HEADERS = ["category", "type", "transaction type"];
const REF_HEADERS = ["reference", "ref", "reference number", "check number", "confirmation"];

function normalise(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

function findCol(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex((h) => normalise(h) === c);
    if (idx !== -1) return idx;
  }
  for (const c of candidates) {
    const idx = headers.findIndex((h) => normalise(h).includes(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseExcelDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    if (d) {
      const mm = String(d.m).padStart(2, "0");
      const dd = String(d.d).padStart(2, "0");
      return `${d.y}-${mm}-${dd}`;
    }
  }

  const s = String(value).trim();

  // ISO: 2025-03-15
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  // US: 03/15/2025 or 3/15/25
  const us = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (us) {
    const year = us[3].length === 2 ? `20${us[3]}` : us[3];
    return `${year}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  }

  return null;
}

function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/[$,\s]/g, "").replace(/\((.+)\)/, "-$1");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/**
 * Parse an Excel buffer (AMEX or bank statement) into normalised transactions.
 *
 * Amount sign convention: negative = money out (expense), positive = money in (revenue/credit).
 * For credit card statements (format "amex"), charges are flipped to negative.
 */
export function parseStatement(
  buffer: ArrayBuffer,
  format: StatementFormat = "auto"
): { transactions: ParsedTransaction[]; detectedFormat: StatementFormat } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Find header row (first row with >= 3 non-empty cells)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const row = raw[i];
    if (row && row.filter((c) => c !== null && c !== undefined && String(c).trim() !== "").length >= 3) {
      headerIdx = i;
      break;
    }
  }

  const headers = (raw[headerIdx] ?? []).map((h) => String(h ?? ""));
  const dateCol = findCol(headers, DATE_HEADERS);
  const descCol = findCol(headers, DESC_HEADERS);
  const amountCol = findCol(headers, AMOUNT_HEADERS);
  const debitCol = findCol(headers, DEBIT_HEADERS);
  const creditCol = findCol(headers, CREDIT_HEADERS);
  const catCol = findCol(headers, CATEGORY_HEADERS);
  const refCol = findCol(headers, REF_HEADERS);

  if (dateCol === -1) {
    throw new Error("Could not find a date column. Expected headers like: Date, Trans Date, Transaction Date.");
  }
  if (descCol === -1 && amountCol === -1 && debitCol === -1) {
    throw new Error("Could not find description or amount columns. Check that the file has expected statement columns.");
  }

  const isCreditCard =
    format === "amex" ||
    (format === "auto" && amountCol !== -1 && debitCol === -1 && creditCol === -1);

  const detectedFormat: StatementFormat = isCreditCard ? "amex" : "bank";

  const transactions: ParsedTransaction[] = [];

  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.length === 0) continue;

    const date = parseExcelDate(row[dateCol]);
    if (!date) continue;

    const description = descCol !== -1 ? String(row[descCol] ?? "").trim() : "";
    if (!description) continue;

    let amount: number | null = null;

    if (amountCol !== -1) {
      amount = parseAmount(row[amountCol]);
      if (amount !== null && isCreditCard) {
        amount = -Math.abs(amount);
      }
    } else if (debitCol !== -1 || creditCol !== -1) {
      const debit = debitCol !== -1 ? parseAmount(row[debitCol]) : null;
      const credit = creditCol !== -1 ? parseAmount(row[creditCol]) : null;
      if (debit !== null && debit !== 0) {
        amount = -Math.abs(debit);
      } else if (credit !== null && credit !== 0) {
        amount = Math.abs(credit);
      }
    }

    if (amount === null || amount === 0) continue;

    const category = catCol !== -1 ? String(row[catCol] ?? "").trim() || null : null;
    const reference = refCol !== -1 ? String(row[refCol] ?? "").trim() || null : null;

    transactions.push({ tx_date: date, description, amount, category, reference });
  }

  return { transactions, detectedFormat };
}
