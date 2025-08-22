import { exchangeLogger } from './logger';

/**
 * Configuration validation for Exchange integration
 * Node.js 24 optimized with comprehensive environment validation
 */

export interface ExchangeAppConfig {
  // Microsoft 365 Configuration
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
  redirectUri: string;
  
  // Database Configuration
  databaseUrl: string;
  
  // Security Configuration
  encryptionKey: string;
  jwtSecret: string;
  
  // Feature Flags
  enableEmailProcessing: boolean;
  enableWebhooks: boolean;
  enableRateLimiting: boolean;
  
  // Processing Configuration
  maxEmailBatchSize: number;
  emailProcessingInterval: number;
  tokenRefreshBuffer: number;
  
  // Logging Configuration
  logLevel: string;
  enableStructuredLogging: boolean;
  
  // API Configuration
  graphApiVersion: string;
  graphApiBaseUrl: string;
  requestTimeout: number;
  maxRetries: number;
  
  // Rate Limiting Configuration
  oauthRateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  emailProcessingRateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  graphApiRateLimit: {
    windowMs: number;
    maxRequests: number;
  };
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  config?: ExchangeAppConfig;
}

interface EnvironmentVariable {
  name: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean' | 'url' | 'uuid';
  defaultValue?: any;
  validator?: (value: any) => boolean;
  description: string;
}

class ExchangeConfigValidator {
  private environmentVariables: EnvironmentVariable[] = [
    // Required Microsoft 365 Configuration
    {
      name: 'MICROSOFT_CLIENT_ID',
      required: false, // Can be set per-connection
      type: 'uuid',
      description: 'Microsoft 365 Application (client) ID from Azure AD',
    },
    {
      name: 'MICROSOFT_CLIENT_SECRET',
      required: false, // Can be set per-connection
      type: 'string',
      description: 'Microsoft 365 Client secret from Azure AD',
    },
    {
      name: 'MICROSOFT_TENANT_ID',
      required: false, // Can be set per-connection
      type: 'uuid',
      description: 'Microsoft 365 Directory (tenant) ID from Azure AD',
    },
    {
      name: 'MICROSOFT_REDIRECT_URI',
      required: true,
      type: 'url',
      defaultValue: 'http://localhost:3000/admin/exchange/callback',
      description: 'OAuth redirect URI configured in Azure AD',
    },
    
    // Required Security Configuration
    {
      name: 'DATABASE_URL',
      required: true,
      type: 'string',
      description: 'PostgreSQL database connection URL',
    },
    {
      name: 'EXCHANGE_ENCRYPTION_KEY',
      required: true,
      type: 'string',
      validator: (value: string) => value.length >= 32,
      description: 'Encryption key for token storage (minimum 32 characters)',
    },
    {
      name: 'JWT_SECRET',
      required: true,
      type: 'string',
      validator: (value: string) => value.length >= 32,
      description: 'JWT secret key for session management (minimum 32 characters)',
    },
    
    // Optional Feature Configuration
    {
      name: 'EXCHANGE_ENABLE_EMAIL_PROCESSING',
      required: false,
      type: 'boolean',
      defaultValue: true,
      description: 'Enable automatic email processing and ticket creation',
    },
    {
      name: 'EXCHANGE_ENABLE_WEBHOOKS',
      required: false,
      type: 'boolean',
      defaultValue: false,
      description: 'Enable webhook support for real-time notifications',
    },
    {
      name: 'EXCHANGE_ENABLE_RATE_LIMITING',
      required: false,
      type: 'boolean',
      defaultValue: true,
      description: 'Enable rate limiting for API endpoints',
    },
    
    // Optional Processing Configuration
    {
      name: 'EXCHANGE_MAX_EMAIL_BATCH_SIZE',
      required: false,
      type: 'number',
      defaultValue: 50,
      validator: (value: number) => value > 0 && value <= 1000,
      description: 'Maximum number of emails to process in a single batch (1-1000)',
    },
    {
      name: 'EXCHANGE_EMAIL_PROCESSING_INTERVAL',
      required: false,
      type: 'number',
      defaultValue: 300000, // 5 minutes
      validator: (value: number) => value >= 60000, // Minimum 1 minute
      description: 'Email processing interval in milliseconds (minimum 60000)',
    },
    {
      name: 'EXCHANGE_TOKEN_REFRESH_BUFFER',
      required: false,
      type: 'number',
      defaultValue: 300000, // 5 minutes
      validator: (value: number) => value >= 60000, // Minimum 1 minute
      description: 'Token refresh buffer time in milliseconds (minimum 60000)',
    },
    
    // Optional Logging Configuration
    {
      name: 'LOG_LEVEL',
      required: false,
      type: 'string',
      defaultValue: 'info',
      validator: (value: string) => ['error', 'warn', 'info', 'debug', 'trace'].includes(value),
      description: 'Logging level (error, warn, info, debug, trace)',
    },
    {
      name: 'EXCHANGE_ENABLE_STRUCTURED_LOGGING',
      required: false,
      type: 'boolean',
      defaultValue: true,
      description: 'Enable structured JSON logging',
    },
    
    // Optional API Configuration
    {
      name: 'EXCHANGE_GRAPH_API_VERSION',
      required: false,
      type: 'string',
      defaultValue: 'v1.0',
      validator: (value: string) => ['v1.0', 'beta'].includes(value),
      description: 'Microsoft Graph API version (v1.0 or beta)',
    },
    {
      name: 'EXCHANGE_GRAPH_API_BASE_URL',
      required: false,
      type: 'url',
      defaultValue: 'https://graph.microsoft.com',
      description: 'Microsoft Graph API base URL',
    },
    {
      name: 'EXCHANGE_REQUEST_TIMEOUT',
      required: false,
      type: 'number',
      defaultValue: 30000,
      validator: (value: number) => value >= 5000 && value <= 120000,
      description: 'HTTP request timeout in milliseconds (5000-120000)',
    },
    {
      name: 'EXCHANGE_MAX_RETRIES',
      required: false,
      type: 'number',
      defaultValue: 3,
      validator: (value: number) => value >= 0 && value <= 10,
      description: 'Maximum number of request retries (0-10)',
    },
    
    // Optional Rate Limiting Configuration
    {
      name: 'EXCHANGE_OAUTH_RATE_LIMIT_WINDOW',
      required: false,
      type: 'number',
      defaultValue: 900000, // 15 minutes
      description: 'OAuth rate limit window in milliseconds',
    },
    {
      name: 'EXCHANGE_OAUTH_RATE_LIMIT_MAX',
      required: false,
      type: 'number',
      defaultValue: 5,
      description: 'Maximum OAuth requests per window',
    },
    {
      name: 'EXCHANGE_EMAIL_RATE_LIMIT_WINDOW',
      required: false,
      type: 'number',
      defaultValue: 60000, // 1 minute
      description: 'Email processing rate limit window in milliseconds',
    },
    {
      name: 'EXCHANGE_EMAIL_RATE_LIMIT_MAX',
      required: false,
      type: 'number',
      defaultValue: 30,
      description: 'Maximum email processing requests per window',
    },
    {
      name: 'EXCHANGE_GRAPH_RATE_LIMIT_WINDOW',
      required: false,
      type: 'number',
      defaultValue: 60000, // 1 minute
      description: 'Graph API rate limit window in milliseconds',
    },
    {
      name: 'EXCHANGE_GRAPH_RATE_LIMIT_MAX',
      required: false,
      type: 'number',
      defaultValue: 100,
      description: 'Maximum Graph API requests per window',
    },
  ];

  /**
   * Validate all configuration settings
   */
  validateConfiguration(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const config: Partial<ExchangeAppConfig> = {};

    exchangeLogger.info('Starting Exchange integration configuration validation');

    // Validate each environment variable
    for (const envVar of this.environmentVariables) {
      const result = this.validateEnvironmentVariable(envVar);
      
      if (result.error) {
        errors.push(result.error);
      }
      
      if (result.warning) {
        warnings.push(result.warning);
      }
      
      if (result.value !== undefined) {
        this.setConfigValue(config, envVar.name, result.value);
      }
    }

    // Additional validation logic
    this.validateDependentSettings(config, errors, warnings);

    const isValid = errors.length === 0;
    
    if (isValid) {
      exchangeLogger.info('Configuration validation successful', {
        warnings: warnings.length,
        operation: 'config_validation',
      });
    } else {
      exchangeLogger.warn('Configuration validation failed', {
        errors: errors.length,
        warnings: warnings.length,
        operation: 'config_validation',
      });
    }

    return {
      isValid,
      errors,
      warnings,
      config: isValid ? config as ExchangeAppConfig : undefined,
    };
  }

  /**
   * Validate a single environment variable
   */
  private validateEnvironmentVariable(envVar: EnvironmentVariable): {
    value?: any;
    error?: string;
    warning?: string;
  } {
    const rawValue = process.env[envVar.name];
    
    // Check if required variable is missing
    if (envVar.required && !rawValue) {
      return {
        error: `Required environment variable ${envVar.name} is not set. ${envVar.description}`,
      };
    }
    
    // Use default value if not set
    if (!rawValue) {
      if (envVar.defaultValue !== undefined) {
        return {
          value: envVar.defaultValue,
          warning: `Using default value for ${envVar.name}: ${envVar.defaultValue}`,
        };
      }
      return {}; // Optional variable not set, no default
    }
    
    // Parse and validate the value
    const parsedValue = this.parseEnvironmentValue(rawValue, envVar.type);
    
    if (parsedValue === null) {
      return {
        error: `Invalid ${envVar.type} value for ${envVar.name}: "${rawValue}". ${envVar.description}`,
      };
    }
    
    // Run custom validator if provided
    if (envVar.validator && !envVar.validator(parsedValue)) {
      return {
        error: `Validation failed for ${envVar.name}: "${rawValue}". ${envVar.description}`,
      };
    }
    
    return { value: parsedValue };
  }

  /**
   * Parse environment variable value based on type
   */
  private parseEnvironmentValue(value: string, type: EnvironmentVariable['type']): any {
    try {
      switch (type) {
        case 'string':
          return value;
        
        case 'number':
          const num = parseInt(value, 10);
          return isNaN(num) ? null : num;
        
        case 'boolean':
          return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
        
        case 'url':
          try {
            new URL(value);
            return value;
          } catch {
            return null;
          }
        
        case 'uuid':
          return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) 
            ? value 
            : null;
        
        default:
          return value;
      }
    } catch {
      return null;
    }
  }

  /**
   * Set configuration value using environment variable name mapping
   */
  private setConfigValue(config: Partial<ExchangeAppConfig>, envName: string, value: any): void {
    const mapping: Record<string, keyof ExchangeAppConfig> = {
      'MICROSOFT_CLIENT_ID': 'clientId',
      'MICROSOFT_CLIENT_SECRET': 'clientSecret',
      'MICROSOFT_TENANT_ID': 'tenantId',
      'MICROSOFT_REDIRECT_URI': 'redirectUri',
      'DATABASE_URL': 'databaseUrl',
      'EXCHANGE_ENCRYPTION_KEY': 'encryptionKey',
      'JWT_SECRET': 'jwtSecret',
      'EXCHANGE_ENABLE_EMAIL_PROCESSING': 'enableEmailProcessing',
      'EXCHANGE_ENABLE_WEBHOOKS': 'enableWebhooks',
      'EXCHANGE_ENABLE_RATE_LIMITING': 'enableRateLimiting',
      'EXCHANGE_MAX_EMAIL_BATCH_SIZE': 'maxEmailBatchSize',
      'EXCHANGE_EMAIL_PROCESSING_INTERVAL': 'emailProcessingInterval',
      'EXCHANGE_TOKEN_REFRESH_BUFFER': 'tokenRefreshBuffer',
      'LOG_LEVEL': 'logLevel',
      'EXCHANGE_ENABLE_STRUCTURED_LOGGING': 'enableStructuredLogging',
      'EXCHANGE_GRAPH_API_VERSION': 'graphApiVersion',
      'EXCHANGE_GRAPH_API_BASE_URL': 'graphApiBaseUrl',
      'EXCHANGE_REQUEST_TIMEOUT': 'requestTimeout',
      'EXCHANGE_MAX_RETRIES': 'maxRetries',
    };

    const configKey = mapping[envName];
    if (configKey) {
      (config as any)[configKey] = value;
    }

    // Handle rate limiting configuration
    if (envName.includes('RATE_LIMIT')) {
      this.setRateLimitConfig(config, envName, value);
    }
  }

  /**
   * Set rate limiting configuration
   */
  private setRateLimitConfig(config: Partial<ExchangeAppConfig>, envName: string, value: any): void {
    if (!config.oauthRateLimit) {
      config.oauthRateLimit = { windowMs: 900000, maxRequests: 5 };
    }
    if (!config.emailProcessingRateLimit) {
      config.emailProcessingRateLimit = { windowMs: 60000, maxRequests: 30 };
    }
    if (!config.graphApiRateLimit) {
      config.graphApiRateLimit = { windowMs: 60000, maxRequests: 100 };
    }

    switch (envName) {
      case 'EXCHANGE_OAUTH_RATE_LIMIT_WINDOW':
        config.oauthRateLimit.windowMs = value;
        break;
      case 'EXCHANGE_OAUTH_RATE_LIMIT_MAX':
        config.oauthRateLimit.maxRequests = value;
        break;
      case 'EXCHANGE_EMAIL_RATE_LIMIT_WINDOW':
        config.emailProcessingRateLimit.windowMs = value;
        break;
      case 'EXCHANGE_EMAIL_RATE_LIMIT_MAX':
        config.emailProcessingRateLimit.maxRequests = value;
        break;
      case 'EXCHANGE_GRAPH_RATE_LIMIT_WINDOW':
        config.graphApiRateLimit.windowMs = value;
        break;
      case 'EXCHANGE_GRAPH_RATE_LIMIT_MAX':
        config.graphApiRateLimit.maxRequests = value;
        break;
    }
  }

  /**
   * Validate dependent settings and cross-references
   */
  private validateDependentSettings(
    config: Partial<ExchangeAppConfig>, 
    errors: string[], 
    warnings: string[]
  ): void {
    // Validate email processing dependencies
    if (config.enableEmailProcessing) {
      if (!config.maxEmailBatchSize) {
        warnings.push('Email processing enabled but batch size not configured, using default');
      }
      if (!config.emailProcessingInterval) {
        warnings.push('Email processing enabled but interval not configured, using default');
      }
    }

    // Validate webhook dependencies
    if (config.enableWebhooks && !config.clientSecret) {
      warnings.push('Webhooks enabled but client secret not configured - webhook verification will fail');
    }

    // Validate rate limiting configuration
    if (config.enableRateLimiting) {
      if (!config.oauthRateLimit || !config.emailProcessingRateLimit || !config.graphApiRateLimit) {
        warnings.push('Rate limiting enabled but not fully configured, using defaults');
      }
    }

    // Validate Graph API configuration
    if (config.graphApiVersion === 'beta') {
      warnings.push('Using Microsoft Graph beta API - features may be unstable in production');
    }

    // Security validation
    if (config.encryptionKey && config.encryptionKey === config.jwtSecret) {
      warnings.push('Encryption key and JWT secret are identical - consider using different keys');
    }
  }

  /**
   * Generate configuration documentation
   */
  generateConfigurationDocs(): string {
    let docs = '# Exchange Integration Configuration\n\n';
    docs += 'The following environment variables configure the Exchange integration:\n\n';

    for (const envVar of this.environmentVariables) {
      docs += `## ${envVar.name}\n`;
      docs += `- **Required:** ${envVar.required ? 'Yes' : 'No'}\n`;
      docs += `- **Type:** ${envVar.type}\n`;
      if (envVar.defaultValue !== undefined) {
        docs += `- **Default:** ${envVar.defaultValue}\n`;
      }
      docs += `- **Description:** ${envVar.description}\n\n`;
    }

    return docs;
  }
}

// Singleton instance
export const configValidator = new ExchangeConfigValidator();

// Validate configuration on module load (in development)
if (process.env.NODE_ENV === 'development') {
  const result = configValidator.validateConfiguration();
  
  if (!result.isValid) {
    console.error('❌ Exchange Integration Configuration Errors:');
    result.errors.forEach(error => console.error(`  - ${error}`));
  }
  
  if (result.warnings.length > 0) {
    console.warn('⚠️  Exchange Integration Configuration Warnings:');
    result.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
}

export { ExchangeConfigValidator, type ValidationResult };