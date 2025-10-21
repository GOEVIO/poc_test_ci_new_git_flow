import {
  EVIO_EMAIL_FROM,
  EVIO_EMAIL_HOST,
  EVIO_EMAIL_PASS,
  EVIO_EMAIL_PORT,
  EVIO_EMAIL_USER,
} from '../constants';
import nodemailer from 'nodemailer';

export async function sendEmail(
  to: string,
  pdf: Buffer,
  translationKeys: Record<string, string>,
) {
  const transporter = nodemailer.createTransport({
    host: EVIO_EMAIL_HOST,
    port: Number(EVIO_EMAIL_PORT || 587),
    secure: false,
    auth: {
      user: EVIO_EMAIL_USER,
      pass: EVIO_EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"${EVIO_EMAIL_FROM}" <${EVIO_EMAIL_USER}>`,
    to,
    subject:
      translationKeys['EMAIL_REPORT_IS_READY_SUBJECT'] ??
      'Your report is ready',
    attachments: [{ filename: 'report.pdf', content: pdf }],
  });

  console.log(`Email sent to ${to}`);
}
