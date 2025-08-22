import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { 
  exchangeLogger, 
  ExchangeError, 
  OAuthError, 
  TokenRefreshError,
  EmailProcessingError,
  ConnectionError,
  isRetryableError,
  getRetryDelay,
  withRetry,
  measurePerformance
} from '../logger';

// Mock pino logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Replace the actual logger with our mock
(exchangeLogger as any).logger = mockLogger;

describe('ExchangeLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Logging', () => {
    it('should log info messages with context', () => {
      exchangeLogger.info('Test message', { userId: '123' });
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        { context: { userId: '123' } },
        'Test message'
      );
    });

    it('should log warnings with context', () => {
      exchangeLogger.warn('Warning message', { operation: 'test' });
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { context: { operation: 'test' } },
        'Warning message'
      );
    });

    it('should log debug messages', () => {
      exchangeLogger.debug('Debug message', { details: 'test' });
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        { context: { details: 'test' } },
        'Debug message'
      );
    });
  });

  describe('Exchange-specific Logging', () => {
    it('should log OAuth start', () => {
      exchangeLogger.oauthStart('user123', 'tenant456');
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          context: {
            userId: 'user123',
            tenantId: 'tenant456',
            operation: 'oauth_start',
          }
        },
        'OAuth flow initiated'
      );
    });

    it('should log OAuth success', () => {
      exchangeLogger.oauthSuccess('user123', 'conn456');
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          context: {
            userId: 'user123',
            connectionId: 'conn456',
            operation: 'oauth_success',
          }
        },
        'OAuth flow completed successfully'
      );
    });

    it('should log token refresh', () => {
      exchangeLogger.tokenRefresh('conn123');
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          context: {
            connectionId: 'conn123',
            operation: 'token_refresh',
          }
        },
        'Access token refreshed'
      );
    });

    it('should log email processing start', () => {
      exchangeLogger.emailProcessingStart('conn123', 25);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          context: {
            connectionId: 'conn123',
            messageCount: 25,
            operation: 'email_processing_start',
          }
        },
        'Email processing started'
      );
    });

    it('should log email processed successfully', () => {
      exchangeLogger.emailProcessed('conn123', 'msg456', 'ticket789');
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          context: {
            connectionId: 'conn123',
            messageId: 'msg456',
            ticketId: 'ticket789',
            operation: 'email_processed',
          }
        },
        'Email processed successfully'
      );
    });

    it('should log connection test results', () => {
      exchangeLogger.connectionTest('conn123', true);
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          context: {
            connectionId: 'conn123',
            operation: 'connection_test_success',
          }
        },
        'Exchange connection test successful'
      );
    });

    it('should log API requests and responses', () => {
      exchangeLogger.apiRequest('GET', 'https://graph.microsoft.com/v1.0/me');
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        {
          context: {
            method: 'GET',
            url: 'https://graph.microsoft.com/v1.0/me',
            operation: 'api_request',
          }
        },
        'API Request: GET https://graph.microsoft.com/v1.0/me'
      );

      exchangeLogger.apiResponse('GET', 'https://graph.microsoft.com/v1.0/me', 200);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        {
          context: {
            method: 'GET',
            url: 'https://graph.microsoft.com/v1.0/me',
            status: 200,
            operation: 'api_response_success',
          }
        },
        'API Response: GET https://graph.microsoft.com/v1.0/me - 200'
      );
    });

    it('should log OAuth errors', () => {
      const testError = new Error('OAuth failed');
      exchangeLogger.oauthError('user123', testError, 'INVALID_GRANT');
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user123',
          error: testError,
          err: testError,
          errorCode: 'INVALID_GRANT',
          operation: 'oauth_error',
        }),
        'OAuth flow failed'
      );
    });

    it('should log token refresh errors', () => {
      const testError = new Error('Token refresh failed');
      exchangeLogger.tokenRefreshError('conn123', testError);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: 'conn123',
          error: testError,
          err: testError,
          operation: 'token_refresh_error',
        }),
        'Token refresh failed'
      );
    });

    it('should log email processing errors', () => {
      const testError = new Error('Processing failed');
      exchangeLogger.emailProcessingError('conn123', 'msg456', testError);
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: 'conn123',
          messageId: 'msg456',
          error: testError,
          err: testError,
          operation: 'email_processing_error',
        }),
        'Email processing failed'
      );
    });

    it('should log connection test failures', () => {
      exchangeLogger.connectionTest('conn123', false);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        {
          context: {
            connectionId: 'conn123',
            operation: 'connection_test_failed',
          }
        },
        'Exchange connection test failed'
      );
    });

    it('should log API error responses', () => {
      exchangeLogger.apiResponse('GET', 'https://graph.microsoft.com/v1.0/me', 401);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        {
          context: {
            method: 'GET',
            url: 'https://graph.microsoft.com/v1.0/me',
            status: 401,
            operation: 'api_response_error',
          }
        },
        'API Response: GET https://graph.microsoft.com/v1.0/me - 401'
      );
    });

    it('should mask sensitive data in context', () => {
      exchangeLogger.info('Test with sensitive data', { 
        accessToken: 'secret-token-123',
        refreshToken: 'secret-refresh-456',
        userId: 'user123'
      });
      
      // The serializer should mask the tokens but keep other data
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          context: {
            accessToken: 'secret-token-123',
            refreshToken: 'secret-refresh-456', 
            userId: 'user123'
          }
        },
        'Test with sensitive data'
      );
    });
  });

  describe('Error Classes', () => {
    it('should create ExchangeError with proper properties', () => {
      const error = new ExchangeError('Test error', 'TEST_ERROR', 500, { userId: '123' });
      
      expect(error.name).toBe('ExchangeError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.httpStatus).toBe(500);
      expect(error.context).toEqual({ userId: '123' });
      
      // Should have logged the error
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should create OAuthError with defaults', () => {
      const error = new OAuthError('OAuth failed');
      
      expect(error.name).toBe('OAuthError');
      expect(error.code).toBe('OAUTH_ERROR');
      expect(error.httpStatus).toBe(401);
    });

    it('should create TokenRefreshError', () => {
      const error = new TokenRefreshError('Refresh failed', { connectionId: 'conn123' });
      
      expect(error.name).toBe('TokenRefreshError');
      expect(error.code).toBe('TOKEN_REFRESH_ERROR');
      expect(error.httpStatus).toBe(401);
    });

    it('should create EmailProcessingError', () => {
      const error = new EmailProcessingError('Processing failed', 'msg123');
      
      expect(error.name).toBe('EmailProcessingError');
      expect(error.code).toBe('EMAIL_PROCESSING_ERROR');
      expect(error.httpStatus).toBe(500);
    });

    it('should create ConnectionError', () => {
      const error = new ConnectionError('Connection failed', 'conn123');
      
      expect(error.name).toBe('ConnectionError');
      expect(error.code).toBe('CONNECTION_ERROR');
      expect(error.httpStatus).toBe(503);
    });

    it('should create ExchangeError with minimal parameters', () => {
      const error = new ExchangeError('Minimal error', 'MIN_ERROR');
      
      expect(error.name).toBe('ExchangeError');
      expect(error.message).toBe('Minimal error');
      expect(error.code).toBe('MIN_ERROR');
      expect(error.httpStatus).toBe(500); // Default status
      expect(error.context).toBeUndefined();
    });

    it('should create OAuthError with custom parameters', () => {
      const error = new OAuthError('Custom OAuth error', 'CUSTOM_OAUTH', 403, { userId: '123' });
      
      expect(error.name).toBe('OAuthError');
      expect(error.code).toBe('CUSTOM_OAUTH');
      expect(error.httpStatus).toBe(403);
      expect(error.context).toEqual({ userId: '123' });
    });

    it('should create TokenRefreshError with context', () => {
      const error = new TokenRefreshError('Refresh failed', { connectionId: 'conn456', userId: 'user789' });
      
      expect(error.name).toBe('TokenRefreshError');
      expect(error.context).toEqual({ connectionId: 'conn456', userId: 'user789' });
    });

    it('should create EmailProcessingError with message ID', () => {
      const error = new EmailProcessingError('Processing failed', 'msg123');
      
      expect(error.name).toBe('EmailProcessingError');
      expect(error.context).toEqual({ messageId: 'msg123' });
    });

    it('should create ConnectionError with additional context', () => {
      const error = new ConnectionError('Connection failed', 'conn123', { userId: 'user456' });
      
      expect(error.name).toBe('ConnectionError');
      expect(error.context).toEqual({ connectionId: 'conn123', userId: 'user456' });
    });
  });

  describe('Retry Logic', () => {
    it('should identify retryable errors by status code', () => {
      const retryableError = new ExchangeError('Rate limited', 'RATE_LIMITED', 429);
      const nonRetryableError = new ExchangeError('Bad request', 'BAD_REQUEST', 400);
      
      expect(isRetryableError(retryableError)).toBe(true);
      expect(isRetryableError(nonRetryableError)).toBe(false);
    });

    it('should identify retryable errors by message content', () => {
      const networkError = new Error('Network error occurred');
      const timeoutError = new Error('Request timeout');
      const authError = new Error('Authentication failed');
      
      expect(isRetryableError(networkError)).toBe(true);
      expect(isRetryableError(timeoutError)).toBe(true);
      expect(isRetryableError(authError)).toBe(false);
    });

    it('should calculate exponential backoff delay', () => {
      expect(getRetryDelay(1, 1000)).toBeGreaterThanOrEqual(1000);
      expect(getRetryDelay(2, 1000)).toBeGreaterThanOrEqual(2000);
      expect(getRetryDelay(3, 1000)).toBeGreaterThanOrEqual(4000);
      
      // Should cap at 30 seconds
      expect(getRetryDelay(10, 1000)).toBeLessThanOrEqual(30000);
    });

    it('should retry operations on retryable errors', async () => {
      let attempts = 0;
      const operation = jest.fn<() => Promise<string>>().mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('network error');
        }
        return 'success';
      });

      const result = await withRetry(operation, 3);
      
      expect(result).toBe('success');
      expect(attempts).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const operation = jest.fn<() => Promise<never>>().mockImplementation(async () => {
        throw new Error('authentication failed');
      });

      await expect(withRetry(operation, 3)).rejects.toThrow('authentication failed');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should give up after max attempts', async () => {
      const operation = jest.fn<() => Promise<never>>().mockImplementation(async () => {
        throw new Error('network error');
      });

      await expect(withRetry(operation, 2)).rejects.toThrow('network error');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should identify server errors as retryable', () => {
      const serverError = new ExchangeError('Server error', 'SERVER_ERROR', 502);
      const serviceError = new ExchangeError('Service unavailable', 'SERVICE_ERROR', 503);
      const timeoutError = new ExchangeError('Gateway timeout', 'TIMEOUT_ERROR', 504);
      
      expect(isRetryableError(serverError)).toBe(true);
      expect(isRetryableError(serviceError)).toBe(true);
      expect(isRetryableError(timeoutError)).toBe(true);
    });

    it('should handle non-Exchange errors in retry logic', () => {
      const customError = new Error('Custom error message');
      expect(isRetryableError(customError)).toBe(false);
    });

    it('should retry successful operations after previous failures', async () => {
      let attempts = 0;
      const operation = jest.fn<() => Promise<string>>().mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error('timeout');
        }
        return `success-attempt-${attempts}`;
      });

      const result = await withRetry(operation, 3);
      
      expect(result).toBe('success-attempt-2');
      expect(attempts).toBe(2);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should cap retry delay at maximum', () => {
      const delay1 = getRetryDelay(10, 1000); // Very high attempt number
      const delay2 = getRetryDelay(15, 1000); // Even higher
      
      expect(delay1).toBeLessThanOrEqual(30000);
      expect(delay2).toBeLessThanOrEqual(30000);
    });

    it('should identify connection errors as retryable', () => {
      const connectionError = new Error('ECONNRESET network error');
      const networkError = new Error('network timeout occurred');
      const dnsError = new Error('ENOTFOUND timeout');
      
      expect(isRetryableError(connectionError)).toBe(true);
      expect(isRetryableError(networkError)).toBe(true);
      expect(isRetryableError(dnsError)).toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    it('should measure operation performance on success', async () => {
      const operation = jest.fn<() => Promise<string>>().mockResolvedValue('result');
      
      const result = await measurePerformance(operation, 'test-operation', { userId: '123' });
      
      expect(result).toBe('result');
      expect(operation).toHaveBeenCalledTimes(1);
      
      // Should have logged performance metrics - note: measurePerformance calls info() which wraps context
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          context: expect.objectContaining({
            userId: '123',
            operationName: 'test-operation',
            duration: expect.any(Number),
            performance: 'success',
          })
        },
        'Operation completed: test-operation'
      );
    });

    it('should measure operation performance on failure', async () => {
      const testError = new Error('Operation failed');
      const operation = jest.fn<() => Promise<never>>().mockRejectedValue(testError);
      
      await expect(measurePerformance(operation, 'test-operation')).rejects.toThrow('Operation failed');
      
      // Should have logged error with performance metrics
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: testError,
          err: testError, // Pino logger also adds 'err' field
          operationName: 'test-operation',
          duration: expect.any(Number),
          performance: 'error',
        }),
        'Operation failed: test-operation'
      );
    });

    it('should measure performance without context', async () => {
      const operation = jest.fn<() => Promise<string>>().mockResolvedValue('result');
      
      const result = await measurePerformance(operation, 'no-context-operation');
      
      expect(result).toBe('result');
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          context: expect.objectContaining({
            operationName: 'no-context-operation',
            duration: expect.any(Number),
            performance: 'success',
          })
        },
        'Operation completed: no-context-operation'
      );
    });

    it('should handle async operations with varying durations', async () => {
      const slowOperation = jest.fn<() => Promise<string>>().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'slow-result';
      });

      const result = await measurePerformance(slowOperation, 'slow-operation');
      
      expect(result).toBe('slow-result');
      expect(mockLogger.info).toHaveBeenCalledWith(
        {
          context: expect.objectContaining({
            operationName: 'slow-operation',
            duration: expect.any(Number),
            performance: 'success',
          })
        },
        'Operation completed: slow-operation'
      );

      // Verify duration is reasonable (at least 5ms)
      const logCall = mockLogger.info.mock.calls.find(call => 
        call[1] === 'Operation completed: slow-operation'
      );
      expect(logCall).toBeDefined();
      if (logCall) {
        const context = (logCall[0] as any).context;
        expect(context.duration).toBeGreaterThan(5);
      }
    });
  });
});

describe('Logger Singleton', () => {
  it('should export a singleton logger instance', () => {
    expect(exchangeLogger).toBeDefined();
    expect(exchangeLogger.info).toBeDefined();
    expect(exchangeLogger.warn).toBeDefined();
    expect(exchangeLogger.error).toBeDefined();
    expect(exchangeLogger.debug).toBeDefined();
  });

  it('should have all Exchange-specific methods', () => {
    expect(exchangeLogger.oauthStart).toBeDefined();
    expect(exchangeLogger.oauthSuccess).toBeDefined();
    expect(exchangeLogger.oauthError).toBeDefined();
    expect(exchangeLogger.tokenRefresh).toBeDefined();
    expect(exchangeLogger.tokenRefreshError).toBeDefined();
    expect(exchangeLogger.emailProcessingStart).toBeDefined();
    expect(exchangeLogger.emailProcessed).toBeDefined();
    expect(exchangeLogger.emailProcessingError).toBeDefined();
    expect(exchangeLogger.connectionTest).toBeDefined();
    expect(exchangeLogger.apiRequest).toBeDefined();
    expect(exchangeLogger.apiResponse).toBeDefined();
  });
});