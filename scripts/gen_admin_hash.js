#!/usr/bin/env node
const crypto = require('crypto');

function generatePassword(len = 16) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let pwd = '';
  while (pwd.length < len) {
    const byte = crypto.randomBytes(1)[0];
    // Accept values in [0,247], so that modulo 62 is uniform
    if (byte < 248) {
      pwd += charset[byte % charset.length];
    }
  }
  return pwd;
}

function genHash(password, iterations = 100000) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), iterations, 32, 'sha256').toString('hex');
  const hash = `$pbkdf2$${iterations}$${salt}$${key}`;
  return { password, hash };
}

const pwd = process.env.ADMIN_PASSWORD || generatePassword(16);
const out = genHash(pwd);
console.log(JSON.stringify(out));
