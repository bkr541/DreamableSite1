// A plain-text version of an HTML email. Every email should carry one: some inboxes show only text, and spam filters
// distrust HTML-only messages. Good enough for the simple, table-based emails this site sends.
import { decodeEntities } from './zohoMail';

export function htmlToText(html: string): string {
  return decodeEntities(
    String(html ?? '')
      .replace(/<(head|style|script|title)[\s\S]*?<\/\1>/gi, '')
      .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
        const text = label.replace(/<[^>]+>/g, '').trim();
        const url = decodeEntities(href);
        return /^https?:/i.test(url) && text && text !== url ? `${text} (${url})` : text || url;
      })
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|h[1-6]|div|tr|li|table)>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
