const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');
const env = require('../config/env');

const googleClient = new OAuth2Client(env.googleClientId);

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
  if (!env.googleClientId) {
    throw new Error('GOOGLE_CLIENT_ID_MISSING');
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.googleClientId,
    });
    return normalizePayload(ticket.getPayload());
  } catch (error) {
    const message = String(error.message || '');
    if (message.includes('Wrong recipient') || message.includes('audience')) {
      throw new Error('GOOGLE_AUDIENCE_MISMATCH');
    }
    if (message.includes('Token used too late') || message.includes('expired')) {
      throw new Error('GOOGLE_TOKEN_EXPIRED');
    }
    throw new Error('GOOGLE_TOKEN_INVALID');
  }
}

async function getGoogleUser(accessToken) {
  const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return data;
}

async function getGoogleUserFromToken(token) {
  const looksLikeJwt = String(token || '').split('.').length === 3;
  if (looksLikeJwt) {
    return getGoogleUserFromIdToken(token);
  }

  return getGoogleUser(token);
}

module.exports = { getGoogleUser, getGoogleUserFromToken };
