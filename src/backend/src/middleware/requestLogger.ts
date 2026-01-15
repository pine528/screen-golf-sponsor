import { Request, Response, NextFunction } from 'express';

interface RequestLogEntry {
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  ip: string;
  userAgent?: string;
  userId?: string;
}

// Simple in-memory log buffer (for production, use a proper logging service)
const logBuffer: RequestLogEntry[] = [];
const MAX_LOG_BUFFER = 1000;

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();

  // Capture original end method
  const originalEnd = res.end.bind(res);

  res.end = function (chunk?: any, encoding?: any, callback?: any): Response {
    const duration = Date.now() - startTime;
    const logEntry: RequestLogEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'],
      userId: (req as any).user?.id,
    };

    // Add to buffer
    logBuffer.push(logEntry);
    if (logBuffer.length > MAX_LOG_BUFFER) {
      logBuffer.shift();
    }

    // Console log for development
    const statusColor = res.statusCode >= 500 ? '\x1b[31m' // Red
      : res.statusCode >= 400 ? '\x1b[33m' // Yellow
      : res.statusCode >= 300 ? '\x1b[36m' // Cyan
      : '\x1b[32m'; // Green

    const resetColor = '\x1b[0m';

    console.log(
      `${statusColor}${req.method}${resetColor} ${req.path} ${statusColor}${res.statusCode}${resetColor} ${duration}ms`
    );

    return originalEnd(chunk, encoding, callback);
  };

  next();
};

// Get recent request logs (for admin dashboard)
export const getRecentLogs = (limit = 100): RequestLogEntry[] => {
  return logBuffer.slice(-limit).reverse();
};

// Get request statistics
export const getRequestStats = (minutes = 60): {
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  requestsPerMinute: number;
  statusCodes: Record<string, number>;
} => {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  const recentLogs = logBuffer.filter(log => new Date(log.timestamp) > cutoff);

  if (recentLogs.length === 0) {
    return {
      totalRequests: 0,
      averageResponseTime: 0,
      errorRate: 0,
      requestsPerMinute: 0,
      statusCodes: {},
    };
  }

  const totalRequests = recentLogs.length;
  const totalDuration = recentLogs.reduce((sum, log) => sum + log.duration, 0);
  const errorCount = recentLogs.filter(log => log.statusCode >= 400).length;

  const statusCodes: Record<string, number> = {};
  recentLogs.forEach(log => {
    const codeGroup = `${Math.floor(log.statusCode / 100)}xx`;
    statusCodes[codeGroup] = (statusCodes[codeGroup] || 0) + 1;
  });

  return {
    totalRequests,
    averageResponseTime: Math.round(totalDuration / totalRequests),
    errorRate: Math.round((errorCount / totalRequests) * 100 * 10) / 10,
    requestsPerMinute: Math.round(totalRequests / minutes * 10) / 10,
    statusCodes,
  };
};
