import pino from 'pino';

export interface LogContext {
  userId?: string;
  connectionId?: string;
  messageId?: string;
  operation?: string;
  error?: Error;
  [key: string]: any;
}

export interface ErrorContext extends LogContext {
  error: Error;
  errorCode?: string;
  httpStatus?: number;
}

class ExchangeLogger {
  private logger: pino.Logger;

  constructor() {
    this.logger = pino({
      name: 'exchange-integration',
      level: process.env.LOG_LEVEL || 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => {
          return { level: label };
        },
      },
      serializers: {
        ...pino.stdSerializers,
        context: (context: LogContext) => ({
          ...context,
          // Mask sensitive data
          accessToken: context.accessToken ? '***masked***' : undefined,
          refreshToken: context.refreshToken ? '***masked***' : undefined,
        }),
      },
    });
  }

  info(message: string, context?: LogContext) {
    this.logger.info({ context }, message);
  }

  warn(message: string, context?: LogContext) {
    this.logger.warn({ context }, message);
  }

  error(message: string, context: ErrorContext) {
    this.logger.error(
      { 
        ...context,
        err: context.error,
      }, 
      message
    );
  }

  debug(message: string, context?: LogContext) {
    this.logger.debug({ context }, message);
  }

  // Exchange-specific logging methods
  oauthStart(userId: string, tenantId: string) {
    this.info('OAuth flow initiated', {
      userId,
      tenantId,
      operation: 'oauth_start',
    });
  }

  oauthSuccess(userId: string, connectionId: string) {
    this.info('OAuth flow completed successfully', {
      userId,
      connectionId,
      operation: 'oauth_success',
    });
  }

  oauthError(userId: string, error: Error, errorCode?: string) {
    this.error('OAuth flow failed', {
      userId,
      error,
      errorCode,
      operation: 'oauth_error',
    });
  }

  tokenRefresh(connectionId: string) {
    this.info('Access token refreshed', {
      connectionId,
      operation: 'token_refresh',
    });
  }

  tokenRefreshError(connectionId: string, error: Error) {
    this.error('Token refresh failed', {
      connectionId,
      error,
      operation: 'token_refresh_error',
    });
  }

  emailProcessingStart(connectionId: string, messageCount: number) {
    this.info('Email processing started', {
      connectionId,
      messageCount,
      operation: 'email_processing_start',
    });
  }

  emailProcessed(connectionId: string, messageId: string, ticketId?: string) {
    this.info('Email processed successfully', {
      connectionId,
      messageId,
      ticketId,
      operation: 'email_processed',
    });
  }

  emailProcessingError(connectionId: string, messageId: string, error: Error) {
    this.error('Email processing failed', {
      connectionId,
      messageId,
      error,
      operation: 'email_processing_error',
    });
  }

  connectionTest(connectionId: string, success: boolean) {
    if (success) {
      this.info('Exchange connection test successful', {
        connectionId,
        operation: 'connection_test_success',
      });
    } else {
      this.warn('Exchange connection test failed', {
        connectionId,
        operation: 'connection_test_failed',
      });
    }
  }

  apiRequest(method: string, url: string, context?: LogContext) {
    this.debug(`API Request: ${method} ${url}`, {
      ...context,
      method,
      url,
      operation: 'api_request',
    });
  }

  apiResponse(method: string, url: string, status: number, context?: LogContext) {
    const message = `API Response: ${method} ${url} - ${status}`;
    
    if (status >= 400) {
      this.warn(message, {
        ...context,
        method,
        url,
        status,
        operation: 'api_response_error',
      });
    } else {
      this.debug(message, {
        ...context,
        method,
        url,
        status,
        operation: 'api_response_success',
      });
    }
  }
}

// Singleton instance
export const exchangeLogger = new ExchangeLogger();

// Error classes for better error handling
export class ExchangeError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly context?: LogContext;

  constructor(message: string, code: string, httpStatus: number = 500, context?: LogContext) {
    super(message);
    this.name = 'ExchangeError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.context = context;

    // Log the error immediately
    exchangeLogger.error(`Exchange Error: ${message}`, {
      error: this,
      errorCode: code,
      httpStatus,
      ...context,
    });
  }
}

export class OAuthError extends ExchangeError {
  constructor(message: string, code: string = 'OAUTH_ERROR', httpStatus: number = 401, context?: LogContext) {
    super(message, code, httpStatus, context);
    this.name = 'OAuthError';
  }
}

export class TokenRefreshError extends ExchangeError {
  constructor(message: string, context?: LogContext) {
    super(message, 'TOKEN_REFRESH_ERROR', 401, context);
    this.name = 'TokenRefreshError';
  }
}

export class EmailProcessingError extends ExchangeError {
  constructor(message: string, messageId?: string, context?: LogContext) {
    super(message, 'EMAIL_PROCESSING_ERROR', 500, { ...context, messageId });
    this.name = 'EmailProcessingError';
  }
}

export class ConnectionError extends ExchangeError {
  constructor(message: string, connectionId?: string, context?: LogContext) {
    super(message, 'CONNECTION_ERROR', 503, { ...context, connectionId });
    this.name = 'ConnectionError';
  }
}

// Utility functions for error handling
export function isRetryableError(error: Error): boolean {
  if (error instanceof ExchangeError) {
    // Network errors, rate limits, temporary server errors are retryable
    return [429, 502, 503, 504].includes(error.httpStatus);
  }
  
  // Check for specific error messages that indicate retryable conditions
  const retryableMessages = [
    'network error',
    'timeout',
    'rate limit',
    'temporarily unavailable',
    'service unavailable',
  ];
  
  return retryableMessages.some(msg => 
    error.message.toLowerCase().includes(msg.toLowerCase())
  );
}

export function getRetryDelay(attempt: number, baseDelay: number = 1000): number {
  // Exponential backoff with jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.1 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  context?: LogContext
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      exchangeLogger.debug(`Attempting operation (${attempt}/${maxAttempts})`, {
        ...context,
        attempt,
        maxAttempts,
      });

      const result = await operation();

      if (attempt > 1) {
        exchangeLogger.info(`Operation succeeded after ${attempt} attempts`, {
          ...context,
          attempt,
        });
      }

      return result;
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts || !isRetryableError(lastError)) {
        exchangeLogger.error(`Operation failed after ${attempt} attempts`, {
          ...context,
          error: lastError,
          attempt,
          maxAttempts,
        });
        throw lastError;
      }

      const delay = getRetryDelay(attempt);
      exchangeLogger.warn(`Operation failed, retrying in ${delay}ms`, {
        ...context,
        error: lastError,
        attempt,
        delay,
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Performance monitoring
export function measurePerformance<T>(
  operation: () => Promise<T>,
  operationName: string,
  context?: LogContext
): Promise<T> {
  const startTime = Date.now();
  
  return operation()
    .then((result) => {
      const duration = Date.now() - startTime;
      exchangeLogger.info(`Operation completed: ${operationName}`, {
        ...context,
        operationName,
        duration,
        performance: 'success',
      });
      return result;
    })
    .catch((error) => {
      const duration = Date.now() - startTime;
      exchangeLogger.error(`Operation failed: ${operationName}`, {
        ...context,
        error,
        operationName,
        duration,
        performance: 'error',
      });
      throw error;
    });
}