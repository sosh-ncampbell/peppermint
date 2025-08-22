import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MicrosoftGraphService } from '../MicrosoftGraphService';
import { 
  ExchangeConnectionData, 
  ExchangeTokenData,
  GraphEmailMessage 
} from '../../../types/exchange/index';

// Mock environment variable
process.env.MICROSOFT_CLIENT_SECRET = 'test-client-secret';

describe('MicrosoftGraphService', () => {
  let service: MicrosoftGraphService;
  let mockConnection: ExchangeConnectionData;
  let mockToken: ExchangeTokenData;

  // Manual mock state
  let mockPrismaState: any = {};
  let mockFetchState: any = {};

  // Create manual mocks
  const mockPrisma = {
    exchangeConnection: {
      findUnique: async () => mockPrismaState.connectionResult,
      update: async () => mockPrismaState.updateResult,
    },
    exchangeToken: {
      update: async () => mockPrismaState.tokenUpdateResult,
      create: async () => mockPrismaState.tokenCreateResult,
      findFirst: async () => mockPrismaState.tokenFindResult,
    },
  };

  // Mock fetch
  const originalFetch = global.fetch;
  const mockFetch = async () => mockFetchState.response;

  beforeEach(() => {
    // Setup global fetch mock
    global.fetch = mockFetch as any;
    
    // Create service instance
    service = new MicrosoftGraphService(mockPrisma as any);
    
    mockConnection = {
      id: 'conn_123',
      userId: 'user_123',
      tenantId: 'tenant_123',
      clientId: 'client_123',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockToken = {
      id: 'token_123',
      connectionId: 'conn_123',
      accessToken: 'access_token_123',
      refreshToken: 'refresh_token_123',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      scope: 'https://graph.microsoft.com/Mail.Read',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Reset mock state
    mockPrismaState = {};
    mockFetchState = {};
  });

  afterEach(() => {
    // Restore global fetch
    global.fetch = originalFetch;
  });

  describe('getEmails', () => {
    it('should fetch emails successfully', async () => {
      const mockEmails: GraphEmailMessage[] = [
        {
          id: 'email_1',
          subject: 'Test Email',
          from: { 
            emailAddress: { 
              address: 'test@example.com',
              name: 'Test User'
            } 
          },
          toRecipients: [],
          body: { 
            contentType: 'html',
            content: 'Test email content' 
          },
          receivedDateTime: '2025-08-21T10:00:00Z',
          conversationId: 'conv_123',
          internetMessageId: 'msg_123',
          hasAttachments: false,
        }
      ];

      // Setup mock state
      mockPrismaState.connectionResult = {
        ...mockConnection,
        tokens: [mockToken]
      };

      mockFetchState.response = {
        ok: true,
        json: async () => ({ value: mockEmails }),
      };

      const result = await service.getEmails('conn_123', 10);

      expect(result).toEqual(mockEmails);
    });

    it('should handle API errors gracefully', async () => {
      // Setup mock state
      mockPrismaState.connectionResult = {
        ...mockConnection,
        tokens: [mockToken]
      };

      mockFetchState.response = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Token expired',
      };

      await expect(service.getEmails('conn_123'))
        .rejects
        .toThrow();
    });

    it('should handle missing connection', async () => {
      mockPrismaState.connectionResult = null;

      await expect(service.getEmails('invalid_conn'))
        .rejects
        .toThrow('No valid connection or tokens found');
    });

    it('should handle connection without tokens', async () => {
      mockPrismaState.connectionResult = {
        ...mockConnection,
        tokens: []
      };

      await expect(service.getEmails('conn_123'))
        .rejects
        .toThrow('No valid connection or tokens found');
    });

    it('should refresh expired token and retry', async () => {
      const expiredToken = {
        ...mockToken,
        expiresAt: new Date(Date.now() - 3600000) // 1 hour ago (expired)
      };

      // Track call sequence
      let callCount = 0;
      const originalFindUnique = mockPrisma.exchangeConnection.findUnique;
      mockPrisma.exchangeConnection.findUnique = async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ...mockConnection,
            tokens: [expiredToken]
          };
        }
        return {
          ...mockConnection,
          tokens: [mockToken] // Return fresh token on second call
        };
      };

      let fetchCallCount = 0;
      const originalFetch = global.fetch;
      global.fetch = (async () => {
        fetchCallCount++;
        if (fetchCallCount === 1) {
          // Token refresh response
          return {
            ok: true,
            json: async () => ({
              access_token: 'new_access_token_123',
              refresh_token: 'new_refresh_token_123',
              expires_in: 3600,
              token_type: 'Bearer',
              scope: 'https://graph.microsoft.com/Mail.Read',
            }),
          };
        } else if (fetchCallCount === 2) {
          // Successful email fetch with new token
          return {
            ok: true,
            json: async () => ({ 
              value: [
                {
                  id: 'email_1',
                  subject: 'Test Email',
                  from: { emailAddress: { address: 'test@example.com', name: 'Test User' } },
                  toRecipients: [],
                  body: { contentType: 'html', content: 'Test email content' },
                  receivedDateTime: '2025-08-21T10:00:00Z',
                  conversationId: 'conv_123',
                  internetMessageId: 'msg_123',
                  hasAttachments: false,
                }
              ] 
            }),
          };
        }
      }) as any;

      mockPrismaState.tokenCreateResult = {
        ...mockToken,
        accessToken: 'new_access_token_123',
        refreshToken: 'new_refresh_token_123',
      };

      mockPrismaState.tokenFindResult = {
        ...mockToken,
        accessToken: 'new_access_token_123',
        refreshToken: 'new_refresh_token_123',
      };

      const result = await service.getEmails('conn_123', 10);

      expect(result).toHaveLength(1);
      expect(result[0].subject).toBe('Test Email');
      expect(fetchCallCount).toBe(2); // Token refresh + email fetch
      
      // Restore
      global.fetch = originalFetch;
      mockPrisma.exchangeConnection.findUnique = originalFindUnique;
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      mockPrismaState.connectionResult = {
        ...mockConnection,
        tokens: [mockToken]
      };

      mockFetchState.response = {
        ok: true,
        json: async () => ({ '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#me' }),
      };

      const result = await service.testConnection('conn_123');

      expect(result).toBe(true);
    });

    it('should handle connection test failure', async () => {
      mockPrismaState.connectionResult = {
        ...mockConnection,
        tokens: [mockToken]
      };

      mockFetchState.response = {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      };

      const result = await service.testConnection('conn_123');

      expect(result).toBe(false);
    });
  });

  describe('getUserProfile', () => {
    it('should get user profile successfully', async () => {
      mockPrismaState.connectionResult = {
        ...mockConnection,
        tokens: [mockToken]
      };

      const mockProfile = {
        id: 'user_123',
        displayName: 'Test User',
        mail: 'test@example.com',
        userPrincipalName: 'test@example.com',
      };

      mockFetchState.response = {
        ok: true,
        json: async () => mockProfile,
      };

      const result = await service.getUserProfile('conn_123');

      expect(result).toEqual(mockProfile);
    });

    it('should handle profile fetch failure', async () => {
      mockPrismaState.connectionResult = {
        ...mockConnection,
        tokens: [mockToken]
      };

      mockFetchState.response = {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'Access denied',
      };

      await expect(service.getUserProfile('conn_123'))
        .rejects
        .toThrow();
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh token successfully', async () => {
      const refreshTokenResponse = {
        access_token: 'new_access_token_123',
        refresh_token: 'new_refresh_token_123',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'https://graph.microsoft.com/Mail.Read offline_access',
      };

      // Setup mock state for connection with refresh token
      mockPrismaState.connectionResult = {
        ...mockConnection,
        tokens: [{
          ...mockToken,
          refreshToken: 'existing_refresh_token_123'
        }]
      };

      mockFetchState.response = {
        ok: true,
        json: async () => refreshTokenResponse,
      };

      mockPrismaState.tokenCreateResult = {
        ...mockToken,
        accessToken: 'new_access_token_123',
        refreshToken: 'new_refresh_token_123',
      };

      const result = await service.refreshAccessToken('conn_123');

      expect(result).toBe(true); // Method returns boolean, not token data
    });

    it('should handle refresh token failure', async () => {
      // Setup mock state for connection with refresh token
      mockPrismaState.connectionResult = {
        ...mockConnection,
        tokens: [{
          ...mockToken,
          refreshToken: 'invalid_refresh_token_123'
        }]
      };

      mockFetchState.response = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid refresh token',
      };

      const result = await service.refreshAccessToken('conn_123');

      expect(result).toBe(false); // Method returns false on failure
    });

    it('should handle missing refresh token', async () => {
      // Connection without refresh token
      mockPrismaState.connectionResult = {
        ...mockConnection,
        tokens: [{
          ...mockToken,
          refreshToken: null
        }]
      };

      const result = await service.refreshAccessToken('conn_123');

      expect(result).toBe(false);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle network errors', async () => {
      mockPrismaState.connectionResult = {
        ...mockConnection,
        tokens: [mockToken]
      };

      // Mock network failure
      const originalFetch = global.fetch;
      global.fetch = (async () => {
        throw new Error('Network error');
      }) as any;

      await expect(service.getEmails('conn_123'))
        .rejects
        .toThrow('Network error');

      // Restore
      global.fetch = originalFetch;
    });

    it('should handle malformed JSON response', async () => {
      mockPrismaState.connectionResult = {
        ...mockConnection,
        tokens: [mockToken]
      };

      mockFetchState.response = {
        ok: true,
        json: async () => { 
          throw new Error('Invalid JSON'); 
        },
      };

      await expect(service.getEmails('conn_123'))
        .rejects
        .toThrow('Invalid JSON');
    });

    it('should handle database connection errors', async () => {
      // Mock database failure
      const originalFindUnique = mockPrisma.exchangeConnection.findUnique;
      mockPrisma.exchangeConnection.findUnique = async () => {
        throw new Error('Database connection failed');
      };

      await expect(service.getEmails('conn_123'))
        .rejects
        .toThrow('Database connection failed');

      // Restore
      mockPrisma.exchangeConnection.findUnique = originalFindUnique;
    });
  });
});