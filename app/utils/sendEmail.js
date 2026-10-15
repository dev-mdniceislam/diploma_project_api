// const nodemailer = require('nodemailer');

// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// const sendEmail = async (options) => {
//   await transporter.sendMail({
//     from: `"Career Orbit" <${process.env.EMAIL_USER}>`,
//     to: options.email,
//     subject: options.subject,
//     text: options.message,
//     html: options.html,
//   });
// };

// module.exports = sendEmail;

// utils/sendEmail.js
const sendEmail = async (options) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const auth = Buffer.from(
      `${process.env.MAILJET_API_KEY}:${process.env.MAILJET_SECRET_KEY}`,
    ).toString('base64');

    const res = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: process.env.EMAIL_FROM, Name: 'Career Orbit' },
            To: [{ Email: options.email }],
            Subject: options.subject,
            TextPart: options.message,
            HTMLPart: options.html,
          },
        ],
      }),
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(`Mailjet error ${res.status}: ${JSON.stringify(data)}`);
    }

    // Mailjet kokhono 200 diye-o per-message error dey, tai check
    if (data.Messages && data.Messages[0].Status !== 'success') {
      throw new Error(
        `Mailjet send failed: ${JSON.stringify(data.Messages[0])}`,
      );
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
};

module.exports = sendEmail;
