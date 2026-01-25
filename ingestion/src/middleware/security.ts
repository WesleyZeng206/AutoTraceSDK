import { Request, Response, NextFunction } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';


const blockedIPs = new Set<string>();
const suspiciousIPs = new Map<string, { count: number; firstSeen: number }>();

export function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip'];

  if (cfConnectingIP && typeof cfConnectingIP === 'string') {
    return cfConnectingIP.split(',')[0].trim();
  }

  if (realIP && typeof realIP === 'string') {
    return realIP.split(',')[0].trim();
  }

  if (forwarded) {
    const forwardedArray = Array.isArray(forwarded) ? forwarded : [forwarded];
    return forwardedArray[0].split(',')[0].trim();
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function ipBlockingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const clientIP = getClientIP(req);

  if (blockedIPs.has(clientIP)) {
    console.warn(`[SECURITY] Blocked request from banned IP: ${clientIP}`);
    res.status(403).json({
      error: 'Forbidden',
      message: 'Your IP address has been blocked due to suspicious activity',
    });
    return;
  }

  next();
}

export function blockIP(ip: string, reason: string): void {
  blockedIPs.add(ip);
  console.warn(`[SECURITY] IP blocked: ${ip} - Reason: ${reason}`);
}

export function unblockIP(ip: string): void {
  blockedIPs.delete(ip);
  console.info(`[SECURITY] IP unblocked: ${ip}`);
}

export function trackSuspiciousActivity(ip: string): void {
  const now = Date.now();
  const existing = suspiciousIPs.get(ip);

  if (existing) {
    existing.count++;

    if (existing.count > 10 && (now - existing.firstSeen) < 3600000) {
      blockIP(ip, `Too many suspicious requests: ${existing.count}`);
      suspiciousIPs.delete(ip);
    }
  } else {
    suspiciousIPs.set(ip, { count: 1, firstSeen: now });
  }

  if (suspiciousIPs.size > 100) {
    cleanupSuspiciousIPs();
  }
}

function cleanupSuspiciousIPs(): void {
  const now = Date.now();
  const oneHourAgo = now - 3600000;

  for (const [ip, data] of suspiciousIPs.entries()) {
    if (data.firstSeen < oneHourAgo) {
      suspiciousIPs.delete(ip);
    }
  }
}

export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again in 15 minutes',
  },
  handler: (req, res) => {
    const clientIP = getClientIP(req);
    console.warn(`[SECURITY] Auth rate limit exceeded for IP: ${clientIP}`);
    trackSuspiciousActivity(clientIP);

    res.status(429).json({error: 'Too many requests',
      message: 'Too many authentication attempts. Please try again in 15 minutes.',
    });
  },
  skip: (req) => {
    return req.path === '/health' || req.path === '/me' || req.path === '/refresh';
  },
});

export const registrationRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, handler: (req, res) => {
    const clientIP = getClientIP(req);
    console.warn(`[SECURITY] Registration rate limit exceeded for IP: ${clientIP}`);
    trackSuspiciousActivity(clientIP);

    res.status(429).json({
      error: 'Too many requests',
      message: 'Too many registration attempts. Please try again in 1 hour.',
    });
  },
});


export const apiRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: Number(process.env.RATE_LIMIT_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please slow down.',
  },
  handler: (req, res) => {
    const clientIP = getClientIP(req);
    console.warn(`[SECURITY] API rate limit exceeded for IP: ${clientIP} on ${req.path}`);

    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please slow down.',
    });
  },
});

export const telemetryRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: Number(process.env.TELEMETRY_RATE_LIMIT) || 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests',
    message: 'Telemetry rate limit exceeded',
  },
  handler: (req, res) => {
    const clientIP = getClientIP(req);
    console.warn(`[SECURITY] Telemetry rate limit exceeded for IP: ${clientIP}`);

    res.status(429).json({
      error: 'Too many requests',
      message: 'Telemetry ingestion rate limit exceeded. Please implement batching or slow down.',
    });
  },
});


export function requestSizeValidator(req: Request, res: Response, next: NextFunction): void {
  const contentLength = req.headers['content-length'];

  if (contentLength) {
    const size = parseInt(contentLength, 10);
    const maxSize = 2 * 1024 * 1024; // 2MB max

    if (size > maxSize) {
      const clientIP = getClientIP(req);
      console.warn(`[SECURITY] Oversized request rejected: ${size} bytes from ${clientIP}`);
      trackSuspiciousActivity(clientIP);

      res.status(413).json({
        error: 'Payload too large',
        message: 'Request body exceeds maximum size of 2MB',
      });
      return;
    }
  }

  next();
}


export function maliciousPatternDetection(req: Request, res: Response, next: NextFunction): void {
  const clientIP = getClientIP(req);
  const userAgent = req.headers['user-agent'] || '';
  const path = req.path.toLowerCase();

  const sqlPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
  ];

  const xssPatterns = [ /<script[^>]*>.*?<\/script>/gi, /javascript:/gi, /on\w+\s*=/gi,];

  // Check for path traversal
  const pathTraversalPatterns = [ /\.\.\//g, /\.\.\\/g,];

  const queryString = req.url;

  const allPatterns = [...sqlPatterns, ...xssPatterns, ...pathTraversalPatterns];

  for (const pattern of allPatterns) {
    if (pattern.test(queryString) || pattern.test(path)) {
      console.error(`[SECURITY] Malicious pattern detected from ${clientIP}: ${req.method} ${req.url}`);
      trackSuspiciousActivity(clientIP);

      res.status(400).json({
        error: 'Bad Request',
        message: 'Request contains invalid characters',
      });
      return;
    }
  }

  const suspiciousAgents = ['nikto','sqlmap', 'nmap', 'masscan',
    'nessus',
    'openvas',
    'metasploit',
    'havij',
    'acunetix',
  ];

  if (suspiciousAgents.some(agent => userAgent.toLowerCase().includes(agent))) {
    console.warn(`[SECURITY] Suspicious user agent from ${clientIP}: ${userAgent}`);
    trackSuspiciousActivity(clientIP);
  }

  next();
}

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Frame-Options', 'DENY');

  res.setHeader('X-Content-Type-Options', 'nosniff');

  res.setHeader('X-XSS-Protection', '1; mode=block');

  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
}


export function securityLogger(req: Request, res: Response, next: NextFunction): void {
  const clientIP = getClientIP(req);
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    if (req.path.includes('/auth/') && res.statusCode === 401) {
      console.warn(`[SECURITY] Failed auth attempt from ${clientIP}: ${req.method} ${req.path}`);
      trackSuspiciousActivity(clientIP);
    }

    if (res.statusCode === 403 || res.statusCode === 429) {
      console.warn(`[SECURITY] ${res.statusCode} response to ${clientIP}: ${req.method} ${req.path}`);
    }

    if (duration > 5000) {
      console.warn(`[SECURITY] Slow request from ${clientIP}: ${duration}ms for ${req.method} ${req.path}`);
    }
  });

  next();
}

const apiKeyAttempts = new Map<string, { count: number; firstAttempt: number }>();

export function trackAPIKeyAttempt(ip: string, success: boolean): void {
  if (success) {
    apiKeyAttempts.delete(ip);
    return;
  }

  const now = Date.now();
  const existing = apiKeyAttempts.get(ip);

  if (existing) {
    existing.count++;

    if (existing.count > 20 && (now - existing.firstAttempt) < 600000) {
      blockIP(ip, `Too many failed API key attempts: ${existing.count}`);
      apiKeyAttempts.delete(ip);
    }
  } else {
    apiKeyAttempts.set(ip, { count: 1, firstAttempt: now });
  }

  if (apiKeyAttempts.size > 1000) {
    cleanupAPIKeyAttempts();
  }
}

function cleanupAPIKeyAttempts(): void {
  const now = Date.now();
  const tenMinutesAgo = now - 600000;

  for (const [ip, data] of apiKeyAttempts.entries()) {
    if (data.firstAttempt < tenMinutesAgo) {
      apiKeyAttempts.delete(ip);
    }
  }
}
