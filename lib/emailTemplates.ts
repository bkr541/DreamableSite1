// The email templates an admin can send from Message Hub → Templates. Each template is a set of fields (what the admin
// fills in) plus a render function that pours them into the shared branded layout (lib/emailLayout.ts). Templates live in
// code so their markup is reviewed and every typed value is escaped. To add one: add an entry to TEMPLATES (and a test case
// picks it up automatically).
import { paragraphs, renderEmail } from './emailLayout';
import { escapeHtml } from './html';

export type TemplateCategory = 'Onboarding' | 'Delivery' | 'Updates' | 'General';

export interface TemplateField {
  key: string;
  label: string;
  kind: 'text' | 'textarea' | 'url';
  placeholder?: string;
  /** The value the composer starts with; a function gets the site's address (for portal links). */
  initial: string | ((baseUrl: string) => string);
}

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  /** The subject the composer starts with (the admin can change it). */
  subject: string;
  fields: TemplateField[];
  render: (values: Record<string, string>, baseUrl: string) => string;
}

const first: TemplateField = { key: 'firstName', label: 'First name', kind: 'text', placeholder: 'Jane', initial: 'there' };
const message = (initial: string): TemplateField => ({ key: 'message', label: 'Message', kind: 'textarea', initial });
const buttonLabel = (initial: string): TemplateField => ({ key: 'buttonLabel', label: 'Button text', kind: 'text', placeholder: 'Leave empty for no button', initial });
const buttonUrl = (path: string): TemplateField => ({ key: 'buttonUrl', label: 'Button link', kind: 'url', placeholder: 'https://…', initial: (base) => `${base.replace(/\/+$/, '')}${path}` });
const project: TemplateField = { key: 'projectName', label: 'Project name', kind: 'text', placeholder: 'Brand Identity Refresh', initial: '' };

const v = (values: Record<string, string>, key: string) => (values[key] ?? '').trim();
const greeting = (values: Record<string, string>) => paragraphs(`Hi ${v(values, 'firstName') || 'there'},`);
const projectLine = (values: Record<string, string>) =>
  v(values, 'projectName') ? `<p style="margin:0 0 16px;font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#4f6df5;">${escapeHtml(v(values, 'projectName'))}</p>` : '';
const button = (values: Record<string, string>) => (v(values, 'buttonLabel') ? { label: v(values, 'buttonLabel'), url: v(values, 'buttonUrl') } : null);

export const TEMPLATES: EmailTemplate[] = [
  {
    id: 'welcome', name: 'Welcome', category: 'Onboarding',
    description: 'A warm hello for a new client, pointing them to their portal.',
    subject: 'Welcome to Dreamable.studio',
    fields: [first, message('We’re excited to start working with you. Your client portal is where you’ll find your projects, files and updates in one place.'), buttonLabel('Open your portal'), buttonUrl('/portal')],
    render: (x, base) => renderEmail({ title: 'Welcome aboard', preheader: 'We’re excited to start working with you.', bodyHtml: greeting(x) + paragraphs(v(x, 'message')), button: button(x), baseUrl: base }),
  },
  {
    id: 'project-kickoff', name: 'Project Kickoff', category: 'Onboarding',
    description: 'Confirms a project is starting and what happens next.',
    subject: 'Let’s kick off your project',
    fields: [first, project, message('Your project is officially underway. Here’s what to expect next: we’ll share early direction for your feedback, and you’ll see every update in your portal.'), buttonLabel('Open your portal'), buttonUrl('/dashboard')],
    render: (x, base) => renderEmail({ title: 'Your project is kicking off', preheader: 'Here’s what happens next.', bodyHtml: greeting(x) + projectLine(x) + paragraphs(v(x, 'message')), button: button(x), baseUrl: base }),
  },
  {
    id: 'order-delivery', name: 'Order Delivery', category: 'Delivery',
    description: 'Tells a client their finished files are ready to view and download.',
    subject: 'Your files are ready',
    fields: [first, project, message('Your deliverables are ready to review. Sign in to your portal to view and download everything, and let us know if you’d like any changes.'), buttonLabel('View your files'), buttonUrl('/dashboard')],
    render: (x, base) => renderEmail({ title: 'Your files are ready', preheader: 'Everything is waiting in your portal.', bodyHtml: greeting(x) + projectLine(x) + paragraphs(v(x, 'message')), button: button(x), baseUrl: base }),
  },
  {
    id: 'project-update', name: 'Project Update', category: 'Updates',
    description: 'A progress note on an active project.',
    subject: 'An update on your project',
    fields: [first, project, message('Quick update on where things stand: the work is moving along well. Here’s what’s done, and what comes next.'), buttonLabel('View project'), buttonUrl('/dashboard')],
    render: (x, base) => renderEmail({ title: 'A quick project update', preheader: 'Here’s where things stand.', bodyHtml: greeting(x) + projectLine(x) + paragraphs(v(x, 'message')), button: button(x), baseUrl: base }),
  },
  {
    id: 'check-in', name: 'Check-in', category: 'General',
    description: 'A friendly follow-up to keep a conversation moving.',
    subject: 'Checking in',
    fields: [first, message('Just checking in to see how things are going on your side. If you have questions or feedback, reply to this email and we’ll get right back to you.')],
    render: (x, base) => renderEmail({ title: 'Just checking in', bodyHtml: greeting(x) + paragraphs(v(x, 'message')), baseUrl: base }),
  },
  {
    id: 'blank', name: 'Blank Message', category: 'General',
    description: 'The Dreamable.studio frame with nothing in it: write your own.',
    subject: '',
    fields: [first, { key: 'heading', label: 'Heading', kind: 'text', initial: '' }, message(''), buttonLabel(''), buttonUrl('/')],
    render: (x, base) => renderEmail({ title: v(x, 'heading') || 'A message from Dreamable.studio', bodyHtml: greeting(x) + paragraphs(v(x, 'message')), button: button(x), baseUrl: base }),
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id);

/** What the composer's fields start with. */
export function initialValues(t: EmailTemplate, baseUrl: string): Record<string, string> {
  return Object.fromEntries(t.fields.map((f) => [f.key, typeof f.initial === 'function' ? f.initial(baseUrl) : f.initial]));
}
