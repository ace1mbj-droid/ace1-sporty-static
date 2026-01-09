#!/usr/bin/env node
// Sends a test email using SMTP; set SMTP_URL env (e.g., smtp://localhost:1025 for MailHog)
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const smtpUrl = process.env.SMTP_URL || 'smtp://localhost:1025';
const to = process.env.TEST_EMAIL_TO || 'dev@localhost';

(async function main() {
  const transporter = nodemailer.createTransport(smtpUrl);

  const html = fs.readFileSync(path.join(__dirname, '..', 'emails', 'order_confirmation.html'), 'utf8');
  const text = fs.readFileSync(path.join(__dirname, '..', 'emails', 'order_confirmation.txt'), 'utf8');

  await transporter.sendMail({
    from: 'noreply@ace1.test',
    to,
    subject: 'Test Order Confirmation',
    text: text.replace('{{name}}', 'Test User').replace('{{order_id}}', 'test-123'),
    html: html.replace('{{name}}', 'Test User').replace('{{order_id}}', 'test-123')
  });
  console.log('Sent test email to', to);
})();