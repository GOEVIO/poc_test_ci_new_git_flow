import { Request, Response, NextFunction } from "express";

const blockedPatterns = [
  /\/vendor\/phpunit/i,
  /\/debug/i,
  /\/wp-admin/i,
  /\/phpmyadmin/i,
  /\/\.env/i,
  /\/\.git/i,
  /\/.aspx/i,
  /\/.php/i,
  /\/.yaml/i,
  /\/.yml/i,
  /\/.json/i,
  /\/config/i,
  /\/eval/i,
];

export function securityMiddleware(req: Request, res: Response, next: NextFunction) {
  const url = req.originalUrl.toLowerCase();

  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
    req.socket.remoteAddress;

  if (blockedPatterns.some((pattern) => pattern.test(url))) {
    console.warn(`🚨 Acesso bloqueado: ${url} - agent=${req.headers["user-agent"]} - IP=${ip}`);

    return res.status(403).json({
      code: "forbidden",
      message: "Access denied",
    });
  }

  next();
}
