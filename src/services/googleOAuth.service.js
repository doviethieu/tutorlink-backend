const axios = require('axios');

async function getGoogleUser(accessToken) {
  const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
    params: { access_token: accessToken },
  });

  return data;
}

module.exports = { getGoogleUser };
