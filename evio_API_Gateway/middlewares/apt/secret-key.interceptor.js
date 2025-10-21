const { retrieveSecretKey } = require('evio-library-identity');

// APT Secret Key Interceptor Middleware
module.exports = async function aptSecretKeyInterceptor(req, res, next) {
  const context = "[aptSecretKeyInterceptor]";

  console.log(`${context} hash: ${req?.query?.hash}`);

  try {
    if (!req.body || !req.query.hash) {
      const error = 'No Hash found in request query';
      console.warn(`${context} ${error}`);
      return res.status(400).send({ error });
    }
    const { secretKey, clientName } = await retrieveSecretKey(req.query.hash);

    if (secretKey) return res.status(200).send({ secretKey, clientName });

    return res.status(401).send({ error: 'Invalid Hash' });
  } catch (error) {
    if (error.message === 'Token expired') {
      return res.status(498).send({ error: error.message });
    }
    console.error(`${context} Error:`, req.body, error.message || error);
    return res.status(401).send({ error: error.message || 'Error validating Hash' });
  }
}