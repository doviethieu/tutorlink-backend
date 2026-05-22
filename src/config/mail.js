const nodemailer = require('nodemailer');
const env = require('./env');

function createTransporter() {
  if (!env.emailUser || !env.emailPass) return null;

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: env.emailUser,
      pass: env.emailPass,
    },
  });
}

module.exports = createTransporter;
