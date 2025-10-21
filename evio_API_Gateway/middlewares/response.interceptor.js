const libraryLanguage = require('evio-library-language').default;

const { FileTransaction } = libraryLanguage;

module.exports = function responseInterceptor(req, res, next) {
  const context = "[responseInterceptor]";
  const originalSend = res.send;
  const originalStatus = res.status;

   // Track the actual status code
   let interceptedStatusCode = res.statusCode;

   // Override status() to capture the code
   res.status = function(code) {
     interceptedStatusCode = code;
     return originalStatus.apply(this, arguments);
   };

    
  res.send = async function (body) {
    if (res._intercepted) return originalSend.call(this, body);
    res._intercepted = true;
    if(req.headers['user-agent'] && req.headers['user-agent'].includes('HealthChecker')) return originalSend.call(this, body);
    if(req.originalUrl.includes('language/v2')) return originalSend.call(this, body);
    if (req.originalUrl === '/') return originalSend.call(this, body);

    // Checks if the body is empty
    if (body === null || body === undefined || body === '' || (typeof body === 'object' && Object.keys(body).length === 0)) {
      return originalSend.call(this, body);
    }

    let newBody = body;

    try {
      if (Buffer.isBuffer(body)) body = body.toString('utf8');
      const parsedBody = typeof body === 'string' ? tryParseJSON(body) : body;

      if (res.statusCode >= 400) {
        const modifiedBody = await modifyErrorMessage(parsedBody, req);
        console.log(`${context} translated error message successfully`);
        return originalSend.call(this, modifiedBody);
      }

      newBody = await modifyResponseBody(parsedBody, req);
      console.log(`${context} translated body sucessfully`);
      return originalSend.call(this, newBody);

    } catch (error) {
      console.error(`${context} Error:`, error.message);
      return originalSend.call(this, body);
    }
  };

  next();
};


const modifyErrorMessage = async (response, req) => {
  const context = "modifyErrorMessage";
  if (typeof response !== 'object' || !response?.code || !response?.message) {return response;}

  try {
    const { language } = req.headers;
    const paramLanguage = req.query['language'];

    const data = await retrieveFileTransaction((language || paramLanguage));
    return  { ...response, message: data[response.code] ?? response.message };
  } catch (error) {
    return response;
  }
};

const modifyResponseBody = async (response, req) => {
  const context = "modifyResponseBody";
  try {
    const { language, component, clientname } = req.headers;
    const paramLanguage = req.query['language'];
    const data = await retrieveFileTransaction((language || paramLanguage), component);
    const newResponse = await applyKeyTranslation(response, data);
    return newResponse ?? response;
  } catch {
    return response;
  }
}

const retrieveFileTransaction = async (language, component) => {
  const context = "retrieveFileTransaction";  
  let data;
  try {
    data = {component: (component || process.env.DEFAULT_COMPONENT), language};
    return await FileTransaction.retrieveFileTranslationByLanguage(data) || {};
  } catch (error) {
    console.error(`[${context}] Translation file search failed: ${error.message} | using default language`);
    data = {component: (component || process.env.DEFAULT_COMPONENT), language: process.env.DEFAULT_LANGUAGE};
    return await FileTransaction.retrieveFileTranslationByLanguage(data) || {};  
  }
}


// 🔁 Function to replace values
const applyKeyTranslation = (obj, translations) => { 
  if(!obj || typeof obj === 'boolean' || typeof obj === 'number') return obj;

  if (typeof obj === 'string' && whitelist.includes(obj)) {
    return obj;
  }

  if (typeof obj === 'object' && Object.keys(obj).includes('code') && Object.keys(obj).includes('message') ) {
    if (whitelist.includes(obj.code)) {
      return obj;
    }
    return { ...obj, message: translations[obj.code] ?? obj.message };
  }
  
  return typeof obj === 'string'
    ? translations[obj] || obj
    : Array.isArray(obj)
    ? obj.map(item => applyKeyTranslation(item, translations))
    : obj === null || typeof obj !== 'object'
    ? obj
    : Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [
          key,
          applyKeyTranslation(value, translations),
        ])
      );
};



// ⚠️ Safe JSON parse
const tryParseJSON = (str) => {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

// Whitelist of keys to not translate
const whitelist = process.env.WHITELIST ? process.env.WHITELIST.split(',') : [];