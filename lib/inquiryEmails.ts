import { escapeHtml, headerText, multilineHtml, safeEmailAddress } from './html';

export interface InquiryEmailData {
  inquiryId: string;
  name: string;
  email: string;
  company: string | null;
  website: string | null;
  service: string;
  description: string;
  budgetRange: string | null;
  timeline: string | null;
  phone: string | null;
  projectName: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  referrer: string | null;
  /** Files kept in storage rather than attached to the email; listed so nobody has to guess they exist. */
  storedAttachments?: { name: string; size: number }[];
}

export interface BuiltMail {
  subject: string;
  html: string;
  text: string;
  /** Present only when the visitor's address is a clean single mailbox. */
  replyTo?: { name: string; address: string };
}

/** Notification sent to the studio when someone submits the form. Every visitor-supplied value is escaped exactly once here. */
export function buildAdminInquiryEmail(i: InquiryEmailData): BuiltMail {
  const address = safeEmailAddress(i.email);

  const row = (label: string, valueHtml: string | null) =>
    valueHtml
      ? `<tr>
           <td style="padding:8px 12px;font-weight:600;color:#555;white-space:nowrap;vertical-align:top;border-bottom:1px solid #eee;">${label}</td>
           <td style="padding:8px 12px;border-bottom:1px solid #eee;word-break:break-word;">${valueHtml}</td>
         </tr>`
      : '';
  const plain = (v: string | null | undefined) => (v ? escapeHtml(v) : null);

  const html = `
      <h2 style="font-family:sans-serif;margin-bottom:16px;">New Inquiry — Dreamable.studio</h2>
      <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;max-width:640px;width:100%;">
        ${row('Inquiry ID', plain(i.inquiryId))}
        ${row('Name', plain(i.name))}
        ${row('Email', address ? `<a href="mailto:${escapeHtml(address)}">${escapeHtml(address)}</a>` : plain(i.email))}
        ${row('Phone', plain(i.phone))}
        ${row('Project Name', plain(i.projectName))}
        ${row('Company', plain(i.company))}
        ${row('Website', plain(i.website))}
        ${row('Service', plain(i.service))}
        ${row('Budget', plain(i.budgetRange))}
        ${row('Timeline', plain(i.timeline))}
        ${row('UTM Source', plain(i.utmSource))}
        ${row('UTM Medium', plain(i.utmMedium))}
        ${row('UTM Campaign', plain(i.utmCampaign))}
        ${row('UTM Term', plain(i.utmTerm))}
        ${row('UTM Content', plain(i.utmContent))}
        ${row('Referrer', plain(i.referrer))}
      </table>
      <h3 style="font-family:sans-serif;margin-top:24px;margin-bottom:8px;">Description</h3>
      <p style="font-family:sans-serif;font-size:14px;line-height:1.5;background:#f9f9f9;padding:12px;border-radius:4px;max-width:640px;word-break:break-word;">${multilineHtml(i.description)}</p>
      ${i.storedAttachments?.length ? `<h3 style="font-family:sans-serif;margin-top:24px;margin-bottom:8px;">Attachments (${i.storedAttachments.length})</h3>
      <ul style="font-family:sans-serif;font-size:14px;max-width:640px;">${i.storedAttachments.map((f) => `<li>${escapeHtml(f.name)} — ${Math.max(1, Math.round(f.size / 1024))} KB</li>`).join('')}</ul>
      <p style="font-family:sans-serif;font-size:13px;color:#555;">Open the inquiry in the admin portal to view or download these files.</p>` : ''}
      <p style="font-family:sans-serif;font-size:12px;color:#999;margin-top:24px;">Sent from Dreamable.studio contact form</p>
    `;

  const lines: (string | null)[] = [
    'New Inquiry — Dreamable.studio', '',
    `Name: ${i.name}`, `Email: ${i.email}`,
    i.phone ? `Phone: ${i.phone}` : null, i.projectName ? `Project: ${i.projectName}` : null, i.company ? `Company: ${i.company}` : null,
    i.website ? `Website: ${i.website}` : null, `Service: ${i.service}`, i.budgetRange ? `Budget: ${i.budgetRange}` : null,
    i.timeline ? `Timeline: ${i.timeline}` : null, '', i.description,
  ];
  const text = lines.filter((l): l is string => l !== null).join('\n');

  return {
    subject: `New Inquiry: ${headerText(i.name, 80)} — ${headerText(i.service, 80)}`,
    html,
    text,
    replyTo: address ? { name: headerText(i.name, 80), address } : undefined,
  };
}

/** Acknowledgement sent to the person who submitted the form. */
export function buildConfirmationEmail(name: string, projectName: string | null): BuiltMail {
  const firstName = escapeHtml(headerText(name.split(' ')[0], 60));
  const project = projectName ? ` for <strong>${escapeHtml(projectName)}</strong>` : '';
  const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1a1a1a;">
        <h2 style="font-size:22px;font-weight:600;margin-bottom:16px;">Thanks, ${firstName}!</h2>
        <p style="color:#555;line-height:1.6;">
          We received your inquiry${project}. Our team will review it and get back to you within 24 hours.
          Once it's approved, you'll receive a code to log into the client portal.
        </p>
        <p style="color:#aaa;font-size:12px;line-height:1.6;margin-top:28px;">
          You're receiving this because this email address was used on dreamable.studio.
        </p>
      </div>
    `;
  return {
    subject: 'We received your inquiry — Dreamable.studio',
    html,
    text: `Thanks, ${headerText(name.split(' ')[0], 60)}! We received your inquiry${projectName ? ` for ${headerText(projectName, 120)}` : ''}. Our team will review it and get back to you within 24 hours.`,
  };
}
