import nodemailer from 'nodemailer';

function parseBoolean(value) {
  return String(value).toLowerCase() === 'true';
}

function getEmailTransportOptions() {
  const host = process.env.EMAIL_HOST?.trim();
  const port = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 587;
  const secure = process.env.EMAIL_SECURE ? parseBoolean(process.env.EMAIL_SECURE) : port === 465;
  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASS?.trim();

  if (!host || !user || !pass) {
    throw new Error('Missing email configuration. Set EMAIL_HOST, EMAIL_USER, and EMAIL_PASS in the environment.');
  }

  return {
    host,
    port,
    secure,
    auth: { user, pass },
  };
}

const transporter = nodemailer.createTransport(getEmailTransportOptions());

export async function sendPasswordResetEmail(email, resetUrl) {
  const from = process.env.EMAIL_FROM?.trim() || 'BookMind AI <noreply@localhost>';
  const subject = 'Reset your BookMind AI password';
  const text = `You requested a password reset for your BookMind AI account.\n\n` +
    `Click the link below to reset your password:\n${resetUrl}\n\n` +
    `If you did not request this, you can ignore this email.`;
  const html = `
    <p>You requested a password reset for your <strong>BookMind AI</strong> account.</p>
    <p><a href="${resetUrl}" target="_blank" rel="noreferrer noopener">Reset your password</a></p>
    <p>If the link does not work, copy and paste the following URL into your browser:</p>
    <p><code>${resetUrl}</code></p>
    <p>If you did not request this, you can ignore this email.</p>
  `;

  return transporter.sendMail({
    from,
    to: email,
    subject,
    text,
    html,
  });
}
