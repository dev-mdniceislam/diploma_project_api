// utils/emailTemplates.js
const escapeHtml = require('./escapeHTML');

const year = () => new Date().getFullYear();

// ---------- chhoto reusable block gulo ----------
const box = (inner) => `
  <div style="display:inline-block;background-color:#eef2ff;border:2px dashed #6366f1;border-radius:12px;padding:16px 32px;">
    ${inner}
  </div>`;

const otpBox = (otp) =>
  box(
    `<span style="font-size:34px;font-weight:bold;letter-spacing:10px;color:#4f46e5;font-family:'Courier New',monospace;">${otp}</span>`,
  );

const validityRow = `
  <tr>
    <td align="center" style="padding:0 28px 24px;">
      <p style="margin:0;font-size:14px;color:#4b5563;">
        This code is valid for <b style="color:#4f46e5;">10 minutes</b>.
      </p>
    </td>
  </tr>`;

const whatsNextRow = `
  <tr>
    <td style="padding:0 28px 24px;color:#4b5563;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:bold;color:#374151;">What's next?</p>
      <ul style="margin:0;padding-left:20px;font-size:14px;line-height:1.8;">
        <li>Complete your profile</li>
        <li>Browse the latest job feed</li>
        <li>Connect with other professionals</li>
      </ul>
    </td>
  </tr>`;

// ---------- main layout (shob email e ekoi) ----------
const layout = ({ subtitle, name, intro, highlight, extra = '', note }) => `
  <div style="background-color:#f3f4f8;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%" style="max-width:480px;margin:0 auto;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
      <tr>
        <td align="center" style="background:linear-gradient(135deg,#4f46e5,#7c3aed);background-color:#4f46e5;padding:28px 24px;">
          <h1 style="margin:0;font-size:24px;color:#ffffff;letter-spacing:0.5px;">Career Orbit</h1>
          <p style="margin:6px 0 0;font-size:13px;color:#e0e7ff;">${subtitle}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:32px 28px 8px;color:#374151;">
          ${name ? `<p style="margin:0 0 12px;font-size:16px;">Hi <b>${escapeHtml(name)}</b>,</p>` : ''}
          <p style="margin:0;font-size:15px;line-height:1.6;color:#4b5563;">${intro}</p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding:20px 28px;">${highlight}</td>
      </tr>
      ${extra}
      <tr>
        <td style="padding:0 28px 28px;">
          <div style="background-color:#fef2f2;border-left:4px solid #ef4444;border-radius:6px;padding:12px 14px;">
            <p style="margin:0;font-size:13px;line-height:1.5;color:#991b1b;">${note}</p>
          </div>
        </td>
      </tr>
      <tr>
        <td align="center" style="background-color:#f9fafb;padding:16px 24px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; ${year()} Career Orbit. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </div>`;

// ---------- export: sendEmail e ...spread kore dewa jabe ----------
exports.registerOtpEmail = (otp) => ({
  subject: 'Verify your email (Career Orbit)',
  message: `Your Career Orbit verification code is: ${otp}\nThis code is valid for 10 minutes.\n\nIf you did not request this, ignore this email.`,
  html: layout({
    subtitle: 'Email Verification',
    intro: 'Use the code below to verify your email and complete registration.',
    highlight: otpBox(otp),
    extra: validityRow,
    note: "If you didn't request this, ignore this email. Never share this code with anyone.",
  }),
});

exports.resetOtpEmail = (user, otp) => ({
  subject: 'Password Reset OTP (Career Orbit)',
  message: `Hi ${user.name},\n\nYour password reset OTP is: ${otp}\nThis OTP is valid for 10 minutes.\n\nIf you did not request this, ignore this email.`,
  html: layout({
    subtitle: 'Password Reset Request',
    name: user.name,
    intro: 'Use the code below to reset your password.',
    highlight: otpBox(otp),
    extra: validityRow,
    note: "If you didn't request this, you can safely ignore this email. Never share this code with anyone.",
  }),
});

exports.welcomeEmail = (user) => ({
  subject: 'Welcome to Career Orbit 🎉',
  message: `Hi ${user.name},\n\nYour Career Orbit account has been created successfully.\n\nYou can now log in and start exploring jobs and growing your professional network.\n\nIf you did not create this account, please contact our support immediately.`,
  html: layout({
    subtitle: 'Registration Successful',
    name: user.name,
    intro:
      "Welcome to <b>Career Orbit</b>! Your account has been created successfully. You're all set to explore job opportunities and grow your professional network.",
    highlight: box(
      `<span style="font-size:18px;font-weight:bold;color:#4f46e5;">✅ Account Created</span>
       <p style="margin:6px 0 0;font-size:13px;color:#6b7280;">${escapeHtml(user.email)}</p>`,
    ),
    extra: whatsNextRow,
    note: "If you didn't create this account, please ignore this email or contact our support team.",
  }),
});
