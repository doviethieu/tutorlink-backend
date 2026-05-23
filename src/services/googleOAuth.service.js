const axios = require('axios');
const env = require('../config/env');

function decodeJwtPayload(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;

  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(payload, 'base64').toString('utf8');
  return JSON.parse(json);
}

function normalizePayload(payload) {
  if (!payload) return null;
  return {
    sub: payload.sub,
    email: payload.email,
    email_verified: payload.email_verified,
    name: payload.name,
    picture: payload.picture,
  };
}

async function getGoogleUserFromIdToken(idToken) {
  const payload = decodeJwtPayload(idToken);
  if (!payload) {
    throw new Error('GOOGLE_TOKEN_INVALID');
  }

  if (payload.aud !== env.googleClientId) {
    throw new Error('GOOGLE_AUDIENCE_MISMATCH');
  }

  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new Error('GOOGLE_TOKEN_EXPIRED');
  }

  return normalizePayload(payload);
}

async function getGoogleUser(accessToken) {
  const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return data;
}

async function getGoogleUserFromToken(token) {
  try {
    return await getGoogleUserFromIdToken(token);
  } catch (idTokenError) {
    return getGoogleUser(token);
  }
}

module.exports = { getGoogleUser, getGoogleUserFromToken };
