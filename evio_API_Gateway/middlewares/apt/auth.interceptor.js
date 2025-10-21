const { saveNewAptToken } = require('evio-library-identity');

// APT Auth Interceptor Middleware
module.exports = async function aptAuthInterceptor(req, res, next) {
  const context = "[aptAuthInterceptor]";

  console.log(`${context} hmac: ${req?.query?.hmac}`);
  try {
    if (!req.body || !req.body.hmac) {
      const error = 'No HMAC Token found in request body';
      console.warn(`${context} ${error}`);
      return res.status(400).send({ error });
    }
    const tokenData = await saveNewAptToken(req.body.hmac);

    if (tokenData) return res.status(200).send(tokenData);

    return res.status(401).send({ error: 'Invalid HMAC Token' });
  } catch (error) {
    if (error.message === 'Token expired') {
      return res.status(498).send({ error: error.message });
    }
    console.error(`${context} Error`, req.body, error.message || error);
    return res.status(401).send({ error: error.message || 'Error validating HMAC Token' });
  }
}