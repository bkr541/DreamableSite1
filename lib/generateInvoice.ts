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

const PAGE_W    = 210;
const PAGE_H    = 297;
const MARGIN    = 22;
const CONTENT_W = PAGE_W - MARGIN * 2;

function currency(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function generateInvoicePDF(data: InvoiceData): Promise<void> {
  // Load assets in parallel
  const [fontRegular, fontBold, logoBase64] = await Promise.all([
    fetchAsBase64('/fonts/Quicksand-Regular.ttf'),
    fetchAsBase64('/fonts/Quicksand-Bold.ttf'),
    fetchAsBase64('/images/logo_transparent.png'),
  ]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Register Quicksand
  doc.addFileToVFS('Quicksand-Regular.ttf', fontRegular);
  doc.addFont('Quicksand-Regular.ttf', 'Quicksand', 'normal');
  doc.addFileToVFS('Quicksand-Bold.ttf', fontBold);
  doc.addFont('Quicksand-Bold.ttf', 'Quicksand', 'bold');

  let y = MARGIN;

  // ── HEADER ──────────────────────────────────────────────────────────────────
  const LOGO_SIZE = 16;
  doc.addImage(logoBase64, 'PNG', MARGIN, y, LOGO_SIZE, LOGO_SIZE);

  doc.setFont('Quicksand', 'bold');
  doc.setFontSize(34);
  doc.setTextColor(...PURPLE);
  doc.text('INVOICE', PAGE_W - MARGIN, y + 10, { align: 'right' });

  doc.setFont('Quicksand', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text(`#${data.invoiceNumber}`, PAGE_W - MARGIN, y + 17, { align: 'right' });

  y += LOGO_SIZE + 8;

  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);

  y += 10;

  // ── COMPANY INFO ──────────────────────────────────────────────────────────
  doc.setFont('Quicksand', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text('Dreamable Studio', MARGIN, y);
  y += 5;
  doc.text('hello@dreamable.studio', MARGIN, y);
  y += 5;
  doc.text('dreamable.studio', MARGIN, y);

  y += 18;

  // ── BILL TO + PROJECT ──────────────────────────────────────────────────────
  const colMid   = MARGIN + CONTENT_W / 2;
  const billTopY = y;

  doc.setFont('Quicksand', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...PURPLE);
  doc.text('BILL TO', MARGIN, billTopY);
  doc.text('PROJECT', colMid, billTopY);

  y += 6;

  doc.setFont('Quicksand', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...DARK);
  doc.text(data.clientName, MARGIN, y);
  doc.text(data.projectName, colMid, y);

  y += 5.5;

  doc.setFont('Quicksand', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(data.clientCompany, MARGIN, y);
  doc.text(`Issue Date:  ${data.issueDate}`, colMid, y);

  y += 5;
  doc.text(data.clientEmail, MARGIN, y);
  doc.text(`Due Date:    ${data.dueDate}`, colMid, y);

  y += 22;

  // ── ITEMIZED TABLE ─────────────────────────────────────────────────────────
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
      font: 'Quicksand',
      cellPadding: { top: 4, bottom: 4, left: 6, right: 6 },
    },
    bodyStyles: {
      fontSize: 9.5,
      textColor: DARK,
      font: 'Quicksand',
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

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  const subtotal  = data.lineItems.reduce((sum, item) => sum + item.qty * item.rate, 0);
  const tax       = subtotal * data.taxRate;
  const total     = subtotal + tax;
  const sumLabelX = PAGE_W - MARGIN - 72;
  const sumValX   = PAGE_W - MARGIN;

  doc.setFont('Quicksand', 'normal');
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

  doc.setFont('Quicksand', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...WHITE);
  doc.text('TOTAL DUE', sumLabelX, y + 3.5);
  doc.text(currency(total), sumValX, y + 3.5, { align: 'right' });

  y += 22;

  // ── PAYMENT METHODS ───────────────────────────────────────────────────────
  doc.setFont('Quicksand', 'bold');
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
    doc.setFont('Quicksand', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text(`${label}:`, MARGIN, y);
    doc.setFont('Quicksand', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(detail, MARGIN + 40, y);
    y += 6.5;
  });

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const footerY = PAGE_H - 18;

  doc.setDrawColor(215, 215, 220);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, footerY - 7, PAGE_W - MARGIN, footerY - 7);

  doc.setFont('Quicksand', 'normal');
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
