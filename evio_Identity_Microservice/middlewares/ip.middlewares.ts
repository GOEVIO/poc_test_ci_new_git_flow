import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import constants from '../constants/env';

// 1. Memory storage for advanced tracking
const attemptTracker = new Map<string, {ips: any; count: number, firstAttempt: number, fingerprints: string[] }>();

const rateLimitWindowMs = typeof constants.middlewareIp.rateLimitWindowMs === 'string' ? constants.middlewareIp.rateLimitWindowMs.split('*').map(Number).reduce((a, b) => a * b) : constants.middlewareIp.rateLimitWindowMs

// 2. Device fingerprint generator
const generateFingerprint = (req: Request): string => {

  const components = [
    req.headers['user-agent'],
    req.headers['accept-language'],
    req.headers['sec-ch-ua-platform'],
    req.cookies?.session_id || 'none'
  ];
  
  return crypto.createHash('sha256')
    .update(components.join('|'))
    .digest('hex')
    .substring(0, 16);
};

// 3. Main middleware
const advancedAccountLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip;
  const fingerprint = generateFingerprint(req);
  const now = Date.now();
  const windowMs = rateLimitWindowMs; // 24 hours

  // Initialize or update tracking for this fingerprint
  if (!attemptTracker.has(fingerprint)) {
    attemptTracker.set(fingerprint, {
        count: 0,
        firstAttempt: now,
        fingerprints: [fingerprint],
        ips: undefined
    });
  }

  const tracker = attemptTracker.get(fingerprint)!;
  tracker.count += 1;

  // Clear old attempts
  if (now - tracker.firstAttempt > windowMs) {
    tracker.count = 1;
    tracker.firstAttempt = now;
  }

  // Check if there are multiple IPs associated with the same fingerprint
  if (tracker.ips && !tracker.ips.includes(ip)) {
    tracker.ips.push(ip);
  } else if (!tracker.ips) {
    tracker.ips = [ip];
  }


  if (tracker.count > Number(constants.middlewareIp.MAX_ATTEMPTS_PER_FINGERPRINT)) {
    return res.status(400).json({
      auth: false,
      code: 'server_limit_reached_for_device',
      message: 'Attempt limit reached for this device',
      restriction: 'fingerprint-based',
      retryAfter: windowMs - (now - tracker.firstAttempt)
    });
  }

  if (tracker.ips.length > Number(constants.middlewareIp.MAX_UNIQUE_IPS_PER_FINGERPRINT)) {
    return res.status(400).json({
      auth: false,
      code: 'server_limit_reached_for_multiple_ips',
      message: 'Many different IP addresses detecteds',
      restriction: 'ip-rotation-detected',
      retryAfter: windowMs - (now - tracker.firstAttempt)
    });
  }

  next();
};

// 4. Traditional rate limiting middleware as an additional layer
const ipBasedLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: typeof constants.middlewareIp.rateLimitMax === 'string' ? Number(constants.middlewareIp.rateLimitMax) : constants.middlewareIp.rateLimitMax,
  keyGenerator: (req) => {
    return req.ip || '';
  },
  handler: (req, res) => {
    res.status(400).json({
      auth: false,
      code: 'server_limit_reached_too_many_attempts',
      message: 'Too many attempts from this IP address',
      restriction: 'ip-based'
    });
  }
});

// 5. Middleware to periodically clean up old data
setInterval(() => {
  const now = Date.now();
  const oneDay = rateLimitWindowMs;
  
  for (const [key, value] of attemptTracker.entries()) {
    if (now - value.firstAttempt > oneDay) {
      attemptTracker.delete(key);
    }
  }
}, rateLimitWindowMs);




export const advancedAccountLimiterMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    await ipBasedLimiter(req, res, () => advancedAccountLimiter(req, res, next));
}