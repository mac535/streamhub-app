const nodemailer = require('nodemailer');
const { env } = require('../config/env');

let transporter = null;

const createTransporter = () => {
  // Use dedicated Admin credentials (process.env.ADMIN_EMAIL & process.env.ADMIN_PASSWORD) or SMTP settings
  const smtpUser = process.env.ADMIN_EMAIL || env.SMTP_USER || env.ADMIN_EMAIL;
  const smtpPass = process.env.ADMIN_PASSWORD || env.SMTP_PASS || env.ADMIN_PASSWORD;

  if (smtpUser && smtpPass) {
    const port = Number(process.env.SMTP_PORT || env.SMTP_PORT || 465);
    const host = process.env.SMTP_HOST || env.SMTP_HOST || 'mail.stream.net.in';
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465 (SSL), false for 587 (STARTTLS)
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: env.NODE_ENV === 'production',
      },
    });
  }
  return null;
};


exports.sendInvite = async (email, name, inviteLink, role = 'EXPERT') => {
  const mailTransporter = createTransporter();
  
  if (!mailTransporter) {
    console.warn(`[MAILER] SMTP not configured. Skipping email to ${email}. Invite link: ${inviteLink}`);
    return null;
  }

  const roleTitle = role === 'ADMIN' ? 'System Administrator' : 'STREAM Expert';

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaeb; border-radius: 12px;">
      <h2 style="color: #1a1a1a;">Welcome to STREAM, ${name}!</h2>
      <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
        You have been invited to join the STREAM Ecosystem platform as a <strong>${roleTitle}</strong>. To complete your registration and activate your account, please click the button below:
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${inviteLink}" style="background-color: #0056b3; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
          Complete Onboarding
        </a>
      </div>
      <p style="color: #71717a; font-size: 14px;">
        If the button above does not work, copy and paste this link into your browser:<br/>
        <a href="${inviteLink}" style="color: #0056b3;">${inviteLink}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #eaeaeb; margin: 20px 0;" />
      <p style="color: #a1a1aa; font-size: 12px; text-align: center;">
        &copy; ${new Date().getFullYear()} STREAM Ecosystem. All rights reserved.
      </p>
    </div>
  `;

  try {
    const fromEmail = process.env.ADMIN_EMAIL || env.SMTP_FROM_EMAIL || env.ADMIN_EMAIL || 'support@stream.net.in';
    await mailTransporter.sendMail({
      from: `"STREAM Administration" <${fromEmail}>`,
      to: email,
      subject: `You have been invited to STREAM Ecosystem as ${roleTitle}`,
      html: htmlContent,
    });
    
    console.log(`[MAILER] Invite sent to ${email} as ${roleTitle}`);
    return null;
  } catch (error) {
    console.error(`[MAILER] Failed to send invite to ${email}:`, error);
    throw new Error('Failed to send email');
  }
};

exports.sendPasswordReset = async (email, name, resetLink) => {
  const mailTransporter = createTransporter();
  
  if (!mailTransporter) {
    console.warn(`[MAILER] SMTP not configured. Skipping email to ${email}. Reset link: ${resetLink}`);
    return null;
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaeb; border-radius: 12px;">
      <h2 style="color: #1a1a1a;">Password Reset Request</h2>
      <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
        Hi ${name},<br/><br/>
        We received a request to reset your password for your STREAM Ecosystem account. If you didn't make this request, you can safely ignore this email.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #0056b3; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
          Reset Password
        </a>
      </div>
      <p style="color: #71717a; font-size: 14px;">
        This link will expire in 1 hour.<br/>
        If the button above does not work, copy and paste this link into your browser:<br/>
        <a href="${resetLink}" style="color: #0056b3;">${resetLink}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #eaeaeb; margin: 20px 0;" />
      <p style="color: #a1a1aa; font-size: 12px; text-align: center;">
        &copy; ${new Date().getFullYear()} STREAM Ecosystem. All rights reserved.
      </p>
    </div>
  `;

  try {
    const fromEmail = process.env.ADMIN_EMAIL || env.SMTP_FROM_EMAIL || env.ADMIN_EMAIL || 'support@stream.net.in';
    await mailTransporter.sendMail({
      from: `"STREAM Administration" <${fromEmail}>`,
      to: email,
      subject: 'Password Reset - STREAM Ecosystem',
      html: htmlContent,
    });
    
    console.log(`[MAILER] Password reset sent to ${email}`);
    return null;
  } catch (error) {
    console.error(`[MAILER] Failed to send password reset to ${email}:`, error);
    throw new Error('Failed to send email');
  }
};

exports.sendFormAssignmentEmail = async (email, name, formName, formLink) => {
  const mailTransporter = createTransporter();
  
  if (!mailTransporter) {
    console.warn(`[MAILER] SMTP not configured. Skipping form assignment email to ${email}. Link: ${formLink}`);
    return null;
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaeb; border-radius: 12px;">
      <h2 style="color: #1a1a1a;">New Form Assignment</h2>
      <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
        Hi ${name},<br/><br/>
        A new form <strong>${formName}</strong> has been assigned to your STREAM Hub by the administrator.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${formLink}" style="background-color: #0056b3; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
          Access Form
        </a>
      </div>
      <p style="color: #71717a; font-size: 14px;">
        If the button above does not work, copy and paste this link into your browser:<br/>
        <a href="${formLink}" style="color: #0056b3;">${formLink}</a>
      </p>
      <hr style="border: none; border-top: 1px solid #eaeaeb; margin: 20px 0;" />
      <p style="color: #a1a1aa; font-size: 12px; text-align: center;">
        &copy; ${new Date().getFullYear()} STREAM Ecosystem. All rights reserved.
      </p>
    </div>
  `;

  try {
    const fromEmail = process.env.ADMIN_EMAIL || env.SMTP_FROM_EMAIL || env.ADMIN_EMAIL || 'support@stream.net.in';
    await mailTransporter.sendMail({
      from: `"STREAM Administration" <${fromEmail}>`,
      to: email,
      subject: `New Form Assigned: ${formName}`,
      html: htmlContent,
    });
    
    console.log(`[MAILER] Form assignment sent to ${email}`);
    return null;
  } catch (error) {
    console.error(`[MAILER] Failed to send form assignment to ${email}:`, error);
  }
};
