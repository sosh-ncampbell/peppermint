import { PrismaClient } from '@prisma/client';
import { exchangeLogger } from './logger';
import { exchangeSecurity } from './security';
import { configValidator } from './config';
import type { ExchangeConnectionData } from '../../types/exchange';

/**
 * Health monitoring system for Exchange integration
 * Node.js 24 optimized with comprehensive system checks
 */

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  version: string;
  checks: HealthCheck[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  duration: number;
  metadata?: Record<string, any>;
}

export interface SystemMetrics {
  database: {
    connections: number;
    activeConnections: number;
    emailsProcessedToday: number;
    failedProcessingToday: number;
    avgResponseTime: number;
  };
  exchange: {
    totalConnections: number;
    activeConnections: number;
    expiredTokens: number;
    rateLimitHits: number;
    lastEmailSync: Date | null;
  };
  performance: {
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
    nodeVersion: string;
    cpuUsage: NodeJS.CpuUsage;
  };
}

class ExchangeHealthMonitor {
  private prisma: PrismaClient;
  private version: string = '1.0.0';

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: HealthCheck[] = [];

    exchangeLogger.info('Starting health check', { operation: 'health_check' });

    // Run all health checks
    const checkPromises = [
      this.checkDatabase(),
      this.checkConfiguration(),
      this.checkExchangeConnections(),
      this.checkSystemResources(),
      this.checkSecurityServices(),
      this.checkExternalServices(),
    ];

    const results = await Promise.allSettled(checkPromises);

    // Process results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        checks.push(result.value);
      } else {
        checks.push({
          name: this.getCheckName(index),
          status: 'unhealthy',
          message: `Health check failed: ${result.reason}`,
          duration: 0,
        });
      }
    });

    // Calculate summary
    const summary = {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length,
    };

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (summary.unhealthy > 0) {
      overallStatus = 'unhealthy';
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const totalDuration = Date.now() - startTime;

    exchangeLogger.info('Health check completed', {
      status: overallStatus,
      duration: totalDuration,
      summary,
      operation: 'health_check',
    });

    return {
      status: overallStatus,
      timestamp: new Date(),
      version: this.version,
      checks,
      summary,
    };
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const [
      totalConnections,
      activeConnections,
      expiredTokens,
      emailsToday,
      failedToday,
      lastEmailSync,
    ] = await Promise.all([
      this.prisma.exchangeConnection.count(),
      this.prisma.exchangeConnection.count({ where: { isActive: true } }),
      this.prisma.exchangeToken.count({
        where: { expiresAt: { lt: new Date() } }
      }),
      this.prisma.emailProcessingLog.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          },
          status: 'SUCCESS'
        }
      }),
      this.prisma.emailProcessingLog.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          },
          status: 'FAILED'
        }
      }),
      this.prisma.emailProcessingLog.findFirst({
        where: { status: 'SUCCESS' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      }),
    ]);

    return {
      database: {
        connections: totalConnections,
        activeConnections,
        emailsProcessedToday: emailsToday,
        failedProcessingToday: failedToday,
        avgResponseTime: 0, // Could be implemented with performance monitoring
      },
      exchange: {
        totalConnections,
        activeConnections,
        expiredTokens,
        rateLimitHits: 0, // Could be tracked in rate limiting service
        lastEmailSync: lastEmailSync?.createdAt || null,
      },
      performance: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        nodeVersion: process.version,
        cpuUsage: process.cpuUsage(),
      },
    };
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message = 'Database is responsive';
    const metadata: Record<string, any> = {};

    try {
      // Test basic connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      
      // Test Exchange-specific tables
      const connectionCount = await this.prisma.exchangeConnection.count();
      metadata.connectionCount = connectionCount;

      // Check for any connection issues
      const recentErrors = await this.prisma.emailProcessingLog.count({
        where: {
          status: 'FAILED',
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
          }
        }
      });

      metadata.recentErrors = recentErrors;

      if (recentErrors > 10) {
        status = 'degraded';
        message = `Database is responsive but ${recentErrors} recent errors detected`;
      }

      const duration = Date.now() - startTime;
      metadata.responseTime = duration;

      if (duration > 5000) { // > 5 seconds
        status = 'degraded';
        message = 'Database is responsive but slow';
      }

    } catch (error) {
      status = 'unhealthy';
      message = `Database connection failed: ${(error as Error).message}`;
      
      exchangeLogger.error('Database health check failed', {
        error: error as Error,
        operation: 'health_check_database',
      });
    }

    return {
      name: 'Database',
      status,
      message,
      duration: Date.now() - startTime,
      metadata,
    };
  }

  /**
   * Check configuration validity
   */
  private async checkConfiguration(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const validation = configValidator.validateConfiguration();
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      let message: string;

      if (!validation.isValid) {
        status = 'unhealthy';
        message = `Configuration errors: ${validation.errors.join(', ')}`;
      } else if (validation.warnings.length > 0) {
        status = 'degraded';
        message = `Configuration has warnings: ${validation.warnings.length} warnings`;
      } else {
        status = 'healthy';
        message = 'Configuration is valid';
      }

      return {
        name: 'Configuration',
        status,
        message,
        duration: Date.now() - startTime,
        metadata: {
          errors: validation.errors.length,
          warnings: validation.warnings.length,
        },
      };
    } catch (error) {
      return {
        name: 'Configuration',
        status: 'unhealthy',
        message: `Configuration check failed: ${(error as Error).message}`,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Check Exchange connections health
   */
  private async checkExchangeConnections(): Promise<HealthCheck> {
    const startTime = Date.now();
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message = 'Exchange connections are healthy';
    const metadata: Record<string, any> = {};

    try {
      const connections = await this.prisma.exchangeConnection.findMany({
        where: { isActive: true },
        include: { 
          tokens: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      metadata.totalConnections = connections.length;

      if (connections.length === 0) {
        return {
          name: 'Exchange Connections',
          status: 'healthy',
          message: 'No active Exchange connections configured',
          duration: Date.now() - startTime,
          metadata,
        };
      }

      let expiredTokens = 0;
      let healthyConnections = 0;

      for (const connection of connections) {
        if (connection.tokens.length > 0) {
          const token = connection.tokens[0];
          if (token.expiresAt <= new Date()) {
            expiredTokens++;
          } else {
            healthyConnections++;
          }
        }
      }

      metadata.expiredTokens = expiredTokens;
      metadata.healthyConnections = healthyConnections;

      if (expiredTokens > connections.length * 0.5) {
        status = 'unhealthy';
        message = `Most Exchange tokens are expired (${expiredTokens}/${connections.length})`;
      } else if (expiredTokens > 0) {
        status = 'degraded';
        message = `Some Exchange tokens are expired (${expiredTokens}/${connections.length})`;
      }

    } catch (error) {
      status = 'unhealthy';
      message = `Exchange connections check failed: ${(error as Error).message}`;
    }

    return {
      name: 'Exchange Connections',
      status,
      message,
      duration: Date.now() - startTime,
      metadata,
    };
  }

  /**
   * Check system resources
   */
  private async checkSystemResources(): Promise<HealthCheck> {
    const startTime = Date.now();
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message = 'System resources are healthy';
    const metadata: Record<string, any> = {};

    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
      const heapUsagePercent = (heapUsedMB / heapTotalMB) * 100;

      metadata.memoryUsage = {
        heapUsedMB: Math.round(heapUsedMB),
        heapTotalMB: Math.round(heapTotalMB),
        heapUsagePercent: Math.round(heapUsagePercent),
      };
      metadata.uptime = process.uptime();
      metadata.nodeVersion = process.version;

      if (heapUsagePercent > 90) {
        status = 'unhealthy';
        message = `High memory usage: ${Math.round(heapUsagePercent)}%`;
      } else if (heapUsagePercent > 75) {
        status = 'degraded';
        message = `Elevated memory usage: ${Math.round(heapUsagePercent)}%`;
      }

    } catch (error) {
      status = 'unhealthy';
      message = `System resources check failed: ${(error as Error).message}`;
    }

    return {
      name: 'System Resources',
      status,
      message,
      duration: Date.now() - startTime,
      metadata,
    };
  }

  /**
   * Check security services
   */
  private async checkSecurityServices(): Promise<HealthCheck> {
    const startTime = Date.now();
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message = 'Security services are operational';

    try {
      // Test encryption/decryption
      const testData = 'test-token-data';
      const encrypted = exchangeSecurity.encryptToken(testData);
      const decrypted = exchangeSecurity.decryptToken(encrypted);
      
      if (decrypted !== testData) {
        throw new Error('Encryption/decryption test failed');
      }

      // Test state generation and validation
      const testUserId = 'test-user-123';
      const state = exchangeSecurity.generateSecureState(testUserId);
      const isValid = exchangeSecurity.validateState(state, testUserId);
      
      if (!isValid) {
        throw new Error('State validation test failed');
      }

    } catch (error) {
      status = 'unhealthy';
      message = `Security services check failed: ${(error as Error).message}`;
    }

    return {
      name: 'Security Services',
      status,
      message,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Check external services (Microsoft Graph API)
   */
  private async checkExternalServices(): Promise<HealthCheck> {
    const startTime = Date.now();
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message = 'External services are reachable';
    const metadata: Record<string, any> = {};

    try {
      // Test Microsoft Graph API endpoint
      const response = await fetch('https://graph.microsoft.com/v1.0/$metadata', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      metadata.graphApiStatus = response.status;
      metadata.graphApiResponseTime = Date.now() - startTime;

      if (!response.ok) {
        status = 'degraded';
        message = `Microsoft Graph API returned status ${response.status}`;
      }

      // Test OAuth endpoint
      const oauthResponse = await fetch('https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      metadata.oauthEndpointStatus = oauthResponse.status;

      if (!oauthResponse.ok) {
        status = status === 'healthy' ? 'degraded' : 'unhealthy';
        message += `; OAuth endpoint returned status ${oauthResponse.status}`;
      }

    } catch (error) {
      status = 'unhealthy';
      message = `External services check failed: ${(error as Error).message}`;
      metadata.error = (error as Error).message;
    }

    return {
      name: 'External Services',
      status,
      message,
      duration: Date.now() - startTime,
      metadata,
    };
  }

  /**
   * Get check name by index (for error handling)
   */
  private getCheckName(index: number): string {
    const names = [
      'Database',
      'Configuration', 
      'Exchange Connections',
      'System Resources',
      'Security Services',
      'External Services'
    ];
    return names[index] || `Check ${index}`;
  }

  /**
   * Test specific Exchange connection
   */
  async testConnection(connectionId: string): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const connection = await this.prisma.exchangeConnection.findUnique({
        where: { id: connectionId },
        include: { 
          tokens: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!connection) {
        return {
          name: 'Connection Test',
          status: 'unhealthy',
          message: 'Connection not found',
          duration: Date.now() - startTime,
        };
      }

      if (!connection.isActive) {
        return {
          name: 'Connection Test',
          status: 'degraded',
          message: 'Connection is inactive',
          duration: Date.now() - startTime,
        };
      }

      if (connection.tokens.length === 0 || connection.tokens[0].expiresAt <= new Date()) {
        return {
          name: 'Connection Test',
          status: 'degraded',
          message: 'Connection token is expired',
          duration: Date.now() - startTime,
        };
      }

      // Test actual API call
      const token = connection.tokens[0];
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        return {
          name: 'Connection Test',
          status: 'healthy',
          message: 'Connection test successful',
          duration: Date.now() - startTime,
        };
      } else {
        return {
          name: 'Connection Test',
          status: 'unhealthy',
          message: `API call failed with status ${response.status}`,
          duration: Date.now() - startTime,
        };
      }

    } catch (error) {
      return {
        name: 'Connection Test',
        status: 'unhealthy',
        message: `Connection test failed: ${(error as Error).message}`,
        duration: Date.now() - startTime,
      };
    }
  }
}

export { ExchangeHealthMonitor };