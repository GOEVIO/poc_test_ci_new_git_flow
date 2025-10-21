const httpProxy = require('express-http-proxy');

function createProxyRoute(app, path, target) {
  const proxyMiddleware = httpProxy(target, {
    forwardPath: (req) => `${target}${req.originalUrl}`,
    
    proxyErrorHandler: (err, res, next) => {
        switch (err && err.code) {
            default: {
              let updateLog = {
                responseDate: Date.now(),
                //responseBody: err.message,
                responseCode: "500",
              };
              //updateResponseLogs(req.headers["reqID"], updateLog);
    
              console.log("[/api/authenticate] Error", err.message);
              next(err);
            }
        }
    },

    skipToNextHandlerFilter: (proxyRes) => {
        return new Promise(function (resolve, reject) {
          if (proxyRes.statusCode === 304) {
            let updateLog = {
              responseDate: Date.now(),
              //responseBody: 'Updated failed',
              responseCode: "304",
            };
            //updateResponseLogs(req.headers["reqID"], updateLog);
            resolve();
          } else {
            resolve();
          }
        });
      },
      userResDecorator: function (proxyRes, proxyResData) {
        return new Promise(function (resolve) {
          let updateLog = {
            responseDate: Date.now(),
            //responseBody: proxyResData.toString('utf8'),
            responseCode: proxyRes.statusCode,
          };
          //updateResponseLogs(req.headers["reqID"], updateLog);
          resolve(proxyResData);
        });
      },
  });

  app.use(path, (req, res) => {
    console.log(`[Proxy] ${target}${req.originalUrl}`);
    proxyMiddleware(req, res, (err, result) => {
      if (err) {
        console.log(`[${path}] Proxy Error`, err.message);
        return res.status(500).send(err.message);
      } else {
        console.log(`[${path}] Proxy Success`, result);
      }
    });
  });
}


module.exports = createProxyRoute;