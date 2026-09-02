import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { formatLedgerBalance } from "@/lib/finance/accounts"

// Bank-style statement PDF. Uses "Rs." rather than "₹" — jsPDF's built-in
// fonts have no rupee glyph, and a broken glyph would ruin the formatting.

export type StatementRow = {
  date: string // YYYY-MM-DD
  description: string
  category?: string
  debit?: number
  credit?: number
  balance?: number
}

export type StatementOptions = {
  heading: string // e.g. "SBI savings — Account Statement"
  profileName: string
  periodLabel: string
  rows: StatementRow[]
  // Credit card: balances are money owed, so they print as "Rs. X due" /
  // "Rs. X credit" under "Outstanding" headings instead of signed numbers.
  card?: boolean
  openingBalance?: number
  closingBalance?: number
  totalIn: number
  totalOut: number
  // Category-wise analysis rendered at the end of the statement.
  categorySummary?: Array<{ category: string; income: number; expense: number }>
  fileName: string
}

function inr(n: number): string {
  return `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function downloadStatementPdf(opts: StatementOptions): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40

  // Brand header
  doc.setFont("helvetica", "bold")
  doc.setFontSize(20)
  doc.setTextColor(29, 29, 31)
  doc.text("FinBoom", margin, 52)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(134, 134, 139)
  doc.text("Know Your True Wealth", margin, 66)

  doc.setDrawColor(230, 230, 235)
  doc.setLineWidth(1)
  doc.line(margin, 78, pageWidth - margin, 78)

  // Statement heading + meta
  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.setTextColor(29, 29, 31)
  doc.text(opts.heading, margin, 102)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9.5)
  doc.setTextColor(110, 110, 115)
  const meta = [
    `Profile: ${opts.profileName}`,
    `Period: ${opts.periodLabel}`,
    `Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`,
  ]
  meta.forEach((line, i) => doc.text(line, margin, 120 + i * 14))

  // Summary block, right-aligned against the meta block
  doc.setFontSize(9.5)
  const card = !!opts.card
  const balanceWord = card ? "outstanding" : "balance"
  const balance = (n: number) => formatLedgerBalance(card, n, inr)
  const summary: string[] = []
  if (opts.openingBalance !== undefined) summary.push(`Opening ${balanceWord}: ${balance(opts.openingBalance)}`)
  summary.push(`Money in: ${inr(opts.totalIn)}`)
  summary.push(`Money out: ${inr(opts.totalOut)}`)
  if (opts.closingBalance !== undefined) summary.push(`Closing ${balanceWord}: ${balance(opts.closingBalance)}`)
  summary.forEach((line, i) => doc.text(line, pageWidth - margin, 120 + i * 14, { align: "right" }))

  const hasBalance = opts.rows.some((r) => r.balance !== undefined)
  const hasCategory = opts.rows.some((r) => r.category)

  const head = [
    [
      "Date",
      "Description",
      ...(hasCategory ? ["Category"] : []),
      "Debit",
      "Credit",
      ...(hasBalance ? [card ? "Outstanding" : "Balance"] : []),
    ],
  ]
  const body = opts.rows.map((r) => [
    formatDate(r.date),
    r.description,
    ...(hasCategory ? [r.category ?? ""] : []),
    r.debit !== undefined ? inr(r.debit) : "",
    r.credit !== undefined ? inr(r.credit) : "",
    ...(hasBalance ? [r.balance !== undefined ? balance(r.balance) : ""] : []),
  ])

  autoTable(doc, {
    head,
    body,
    startY: 120 + Math.max(meta.length, summary.length) * 14 + 12,
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 5, textColor: [29, 29, 31] },
    headStyles: { fillColor: [29, 29, 31], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 246, 248] },
    columnStyles: {
      0: { cellWidth: 64 },
      [head[0].length - (hasBalance ? 3 : 2)]: { halign: "right" },
      [head[0].length - (hasBalance ? 2 : 1)]: { halign: "right" },
      ...(hasBalance ? { [head[0].length - 1]: { halign: "right" } } : {}),
    },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight()
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(160, 160, 165)
      doc.text(
        `FinBoom statement · page ${doc.getNumberOfPages()}`,
        pageWidth / 2,
        pageHeight - 18,
        { align: "center" }
      )
    },
  })

  if (opts.rows.length === 0) {
    doc.setFontSize(10)
    doc.setTextColor(134, 134, 139)
    doc.text("No transactions in this period.", margin, 210)
  }

  // Category analysis at the end — the statement's "cashflow breakdown".
  if (opts.categorySummary && opts.categorySummary.length > 0) {
    const afterTable =
      (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 210
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.setTextColor(29, 29, 31)
    doc.text("Category Analysis", margin, afterTable + 30)
    autoTable(doc, {
      head: [["Category", "Income", "Expense"]],
      body: opts.categorySummary.map((c) => [
        c.category,
        c.income > 0 ? inr(c.income) : "—",
        c.expense > 0 ? inr(c.expense) : "—",
      ]),
      startY: afterTable + 40,
      margin: { left: margin, right: margin },
      styles: { font: "helvetica", fontSize: 8.5, cellPadding: 5, textColor: [29, 29, 31] },
      headStyles: { fillColor: [29, 29, 31], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [246, 246, 248] },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    })
  }

  doc.save(opts.fileName)
}
