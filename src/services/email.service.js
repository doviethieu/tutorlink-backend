const createTransporter = require('../config/mail');

async function sendMail(options) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[mail] EMAIL_USER/EMAIL_PASS chưa cấu hình, bỏ qua gửi email');
    return null;
  }

  return transporter.sendMail(options);
}

module.exports = { sendMail };
