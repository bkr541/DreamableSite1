// Checks the SMTP settings without deploying: connects, logs in, and (optionally) sends one test message.
//
//   node --env-file=.env.local scripts/verify-smtp.mjs                 connect + log in only (sends nothing)
//   node --env-file=.env.local scripts/verify-smtp.mjs --to you@x.com  also sends a short test email to that address
//
// Reads the same variables as the app (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, INQUIRY_FROM_EMAIL). Never prints the password.
import nodemailer from 'nodemailer';

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, INQUIRY_FROM_EMAIL } = process.env;
if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.error('Missing SMTP_HOST, SMTP_USER or SMTP_PASS. Put them in .env.local and run with --env-file=.env.local.');
  process.exit(1);
}
const port = Number(SMTP_PORT) || 587;
const transporter = nodemailer.createTransport({
  host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS },
  connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
});

try {
  await transporter.verify();
  console.log(`OK: connected to ${SMTP_HOST}:${port} and logged in as ${SMTP_USER}.`);
} catch (e) {
  console.error(`FAILED: ${e.message}`);
  if (/535|auth/i.test(e.message)) console.error('Hint: use a Zoho APP PASSWORD (Accounts > Security > App Passwords), and the SMTP host for your Zoho region.');
  process.exit(1);
}

const to = process.argv[process.argv.indexOf('--to') + 1];
if (process.argv.includes('--to') && to) {
  const from = INQUIRY_FROM_EMAIL || SMTP_USER;
  const info = await transporter.sendMail({ from: { name: 'Dreamable.studio', address: from }, to, subject: 'Dreamable.studio test email', text: 'If you can read this, outgoing email from the site works.' });
  console.log(`Sent test email from ${from} to ${to} (${info.messageId}).`);
}
