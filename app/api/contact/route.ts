import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const projectType = formData.get('projectType') as string;
    const message = formData.get('message') as string;
    const attachment = formData.get('attachment') as File | null;

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required.' },
        { status: 400 }
      );
    }

    // Configure transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const htmlBody = `
      <h2>New Project Inquiry from Dreamable.studio</h2>
      <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Name</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${name}</td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Email</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;"><a href="mailto:${email}">${email}</a></td>
        </tr>
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Project Type</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${projectType || 'Not specified'}</td>
        </tr>
        <tr>
          <td style="padding: 10px; font-weight: bold; color: #555; vertical-align: top;">Message</td>
          <td style="padding: 10px; white-space: pre-wrap;">${message}</td>
        </tr>
      </table>
      <br/>
      <p style="color: #999; font-size: 12px;">Sent from the Dreamable.studio contact form</p>
    `;

    // Build attachments array if file was uploaded
    const attachments: { filename: string; content: Buffer }[] = [];
    if (attachment && attachment.size > 0) {
      const buffer = Buffer.from(await attachment.arrayBuffer());
      attachments.push({ filename: attachment.name, content: buffer });
    }

    await transporter.sendMail({
      from: `"Dreamable.studio" <${process.env.SMTP_USER}>`,
      to: 'bkr_92_02@yahoo.com',
      replyTo: email,
      subject: 'Dreamable: New Project Inquiry',
      html: htmlBody,
      attachments,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Failed to send message. Please try again later.' },
      { status: 500 }
    );
  }
}
