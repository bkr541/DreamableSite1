import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface InvoiceLineItem {
  description: string;
  qty: number;
  rate: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  clientName: string;
  clientEmail: string;
  clientCompany: string;
  projectName: string;
  lineItems: InvoiceLineItem[];
  taxRate: number;
}

const PURPLE  = [107,  33, 168] as [number, number, number];
const DARK    = [ 26,  32,  48] as [number, number, number];
const GRAY    = [130, 130, 140] as [number, number, number];
const LT_GRAY = [247, 247, 249] as [number, number, number];
const WHITE   = [255, 255, 255] as [number, number, number];

const PAGE_W  = 210;
const PAGE_H  = 297;
const MARGIN  = 22;
const CONTENT_W = PAGE_W - MARGIN * 2;

function currency(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function generateInvoicePDF(data: InvoiceData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  let y = MARGIN;

  // ── HEADER ──────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...DARK);
  doc.text('Dreamable Studio', MARGIN, y + 7);

  doc.setFontSize(34);
  doc.setTextColor(...PURPLE);
  doc.text('INVOICE', PAGE_W - MARGIN, y + 7, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text(`#${data.invoiceNumber}`, PAGE_W - MARGIN, y + 14, { align: 'right' });

  y += 24;

  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);

  y += 10;

  // ── COMPANY INFO ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text('Dreamable Studio', MARGIN, y);
  y += 5;
  doc.text('hello@dreamable.studio', MARGIN, y);
  y += 5;
  doc.text('dreamable.studio', MARGIN, y);

  y += 18;

  // ── BILL TO + PROJECT ────────────────────────────────────────────────────────
  const colMid = MARGIN + CONTENT_W / 2;
  const billTopY = y;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...PURPLE);
  doc.text('BILL TO', MARGIN, billTopY);
  doc.text('PROJECT', colMid, billTopY);

  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...DARK);
  doc.text(data.clientName, MARGIN, y);
  doc.text(data.projectName, colMid, y);

  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(data.clientCompany, MARGIN, y);
  doc.text(`Issue Date:  ${data.issueDate}`, colMid, y);

  y += 5;
  doc.text(data.clientEmail, MARGIN, y);
  doc.text(`Due Date:    ${data.dueDate}`, colMid, y);

  y += 22;

  // ── ITEMIZED TABLE ───────────────────────────────────────────────────────────
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['DESCRIPTION', 'QTY', 'RATE', 'TOTAL']],
    body: data.lineItems.map(item => [
      item.description,
      String(item.qty),
      currency(item.rate),
      currency(item.qty * item.rate),
    ]),
    headStyles: {
      fillColor: DARK,
      textColor: WHITE,
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
    },
    bodyStyles: {
      fontSize: 9.5,
      textColor: DARK,
      cellPadding: { top: 5.5, bottom: 5.5, left: 6, right: 6 },
    },
    alternateRowStyles: { fillColor: LT_GRAY },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 32, halign: 'right' },
    },
    theme: 'plain',
    tableLineWidth: 0,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10;

  // ── SUMMARY ──────────────────────────────────────────────────────────────────
  const subtotal = data.lineItems.reduce((sum, item) => sum + item.qty * item.rate, 0);
  const tax      = subtotal * data.taxRate;
  const total    = subtotal + tax;

  const sumLabelX = PAGE_W - MARGIN - 72;
  const sumValX   = PAGE_W - MARGIN;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...GRAY);
  doc.text('Subtotal', sumLabelX, y);
  doc.text(currency(subtotal), sumValX, y, { align: 'right' });
  y += 6.5;

  doc.text(`Tax (${(data.taxRate * 100).toFixed(1)}%)`, sumLabelX, y);
  doc.text(currency(tax), sumValX, y, { align: 'right' });
  y += 4;

  doc.setDrawColor(215, 215, 220);
  doc.setLineWidth(0.3);
  doc.line(sumLabelX, y + 1, sumValX, y + 1);
  y += 9;

  // Total Due pill
  doc.setFillColor(...PURPLE);
  doc.roundedRect(sumLabelX - 5, y - 5, sumValX - sumLabelX + 10, 13, 2.5, 2.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text('TOTAL DUE', sumLabelX, y + 3.5);
  doc.text(currency(total), sumValX, y + 3.5, { align: 'right' });

  y += 22;

  // ── PAYMENT METHODS ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...PURPLE);
  doc.text('PAYMENT METHODS', MARGIN, y);
  y += 7;

  const methods: [string, string][] = [
    ['Bank Transfer', 'ACH / Wire — contact us for banking details'],
    ['Credit / Debit Card', 'Stripe secure checkout — link provided upon request'],
    ['PayPal', 'payments@dreamable.studio'],
  ];

  methods.forEach(([label, detail]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text(`${label}:`, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(detail, MARGIN + 40, y);
    y += 6.5;
  });

  // ── FOOTER ───────────────────────────────────────────────────────────────────
  const footerY = PAGE_H - 18;

  doc.setDrawColor(215, 215, 220);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, footerY - 7, PAGE_W - MARGIN, footerY - 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text(
    'Thank you for choosing Dreamable Studio — we truly appreciate your business.',
    PAGE_W / 2, footerY - 1, { align: 'center' }
  );
  doc.text(
    'dreamable.studio  ·  hello@dreamable.studio',
    PAGE_W / 2, footerY + 5, { align: 'center' }
  );

  doc.save(`Dreamable-Studio-Invoice-${data.invoiceNumber}.pdf`);
}

// Sample data used when no real invoice context is available yet
export function getSampleInvoiceData(): InvoiceData {
  const now  = new Date();
  const due  = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const fmt  = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const num  = `DS-${now.getFullYear()}-001`;

  return {
    invoiceNumber: num,
    issueDate:     fmt(now),
    dueDate:       fmt(due),
    clientName:    'Client Name',
    clientEmail:   'client@example.com',
    clientCompany: 'Client Company, Inc.',
    projectName:   'Project Name',
    lineItems: [
      { description: 'Brand Identity & Strategy',                  qty: 1, rate: 2500 },
      { description: 'Website Design & Development',               qty: 1, rate: 4500 },
      { description: 'Ongoing Support & Maintenance (per month)',  qty: 3, rate:  250 },
    ],
    taxRate: 0,
  };
}
