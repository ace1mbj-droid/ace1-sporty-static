#!/usr/bin/env node
const crypto = require('crypto');

function generatePassword(len = 16) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let pwd = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) pwd += charset[bytes[i] % charset.length];
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
