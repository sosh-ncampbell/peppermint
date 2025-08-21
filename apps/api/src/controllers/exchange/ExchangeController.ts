import { FastifyReply, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';
import type {
  CreateConnectionRequest,
  CreateConnectionResponse,
  OAuthInitiateResponse,
  OAuthCallbackRequest,
  OAuthCallbackResponse,
  ProcessEmailsRequest,
  ProcessEmailsResponse,
  ExchangeConnectionListResponse,
  ExchangeConnectionResponse
} from '../../types/exchange';
import { MicrosoftGraphService } from '../../lib/exchange/MicrosoftGraphService';
import { OAuthService } from '../../lib/exchange/OAuthService';
import { EmailProcessingService } from '../../lib/exchange/EmailProcessingService';

export class ExchangeController {
  private prisma: PrismaClient;
  private oauthService: OAuthService;
  private emailService: EmailProcessingService;
  private graphService: MicrosoftGraphService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.oauthService = new OAuthService(prisma);
    this.emailService = new EmailProcessingService(prisma);
    this.graphService = new MicrosoftGraphService(prisma);
  }

  /**
   * Create a new Exchange connection
   */
  async createConnection(
    request: FastifyRequest<{ Body: CreateConnectionRequest }>,
    reply: FastifyReply
  ): Promise<CreateConnectionResponse> {
    try {
      const { tenantId, clientId } = request.body;
      const userId = request.user.id;

      // Validate required fields
      if (!tenantId || !clientId) {
        reply.code(400);
        return {
          success: false,
          error: 'Tenant ID and Client ID are required'
        };
      }

      // Check if connection already exists for this user and tenant
      const existingConnection = await this.prisma.exchangeConnection.findFirst({
        where: {
          userId,
          tenantId,
          isActive: true
        }
      });

      if (existingConnection) {
        reply.code(409);
        return {
          success: false,
          error: 'Connection already exists for this tenant'
        };
      }

      // Create the connection
      const connection = await this.prisma.exchangeConnection.create({
        data: {
          userId,
          tenantId,
          clientId,
          isActive: true
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      reply.code(201);
      return {
        success: true,
        connection: {
          id: connection.id,
          userId: connection.userId,
          tenantId: connection.tenantId,
          clientId: connection.clientId,
          isActive: connection.isActive,
          createdAt: connection.createdAt,
          updatedAt: connection.updatedAt,
          user: connection.user
        }
      };

    } catch (error) {
      console.error('Error creating Exchange connection:', error);
      reply.code(500);
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Initiate OAuth flow
   */
  async initiateOAuth(
    request: FastifyRequest<{ Params: { connectionId: string } }>,
    reply: FastifyReply
  ): Promise<OAuthInitiateResponse> {
    try {
      const { connectionId } = request.params;
      const userId = request.user.id;

      // Verify connection ownership
      const connection = await this.prisma.exchangeConnection.findFirst({
        where: {
          id: connectionId,
          userId,
          isActive: true
        }
      });

      if (!connection) {
        reply.code(404);
        return {
          success: false,
          error: 'Connection not found'
        };
      }

      // Generate OAuth URL
      const { authUrl } = await this.oauthService.generateAuthUrl(
        userId,
        connection.tenantId,
        connection.clientId
      );

      return {
        success: true,
        authUrl
      };

    } catch (error) {
      console.error('Error initiating OAuth:', error);
      reply.code(500);
      return {
        success: false,
        error: 'Failed to initiate OAuth flow'
      };
    }
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(
    request: FastifyRequest<{ Querystring: OAuthCallbackRequest }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { code, state } = request.query;

      if (!code || !state) {
        reply.code(400);
        reply.send({
          success: false,
          error: 'Missing authorization code or state'
        });
        return;
      }

      // Handle the callback
      const connection = await this.oauthService.handleCallback(code, state);

      // Redirect to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      reply.redirect(`${frontendUrl}/admin/exchange?success=true`);

    } catch (error) {
      console.error('OAuth callback error:', error);
      
      // Redirect to frontend with error
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      reply.redirect(`${frontendUrl}/admin/exchange?error=oauth_failed`);
    }
  }

  /**
   * Process emails for a connection
   */
  async processEmails(
    request: FastifyRequest<{ 
      Params: { connectionId: string };
      Body: ProcessEmailsRequest;
    }>,
    reply: FastifyReply
  ): Promise<ProcessEmailsResponse> {
    try {
      const { connectionId } = request.params;
      const { limit = 50 } = request.body;
      const userId = request.user.id;

      // Verify connection ownership
      const connection = await this.prisma.exchangeConnection.findFirst({
        where: {
          id: connectionId,
          userId,
          isActive: true
        }
      });

      if (!connection) {
        reply.code(404);
        return {
          success: false,
          processed: 0,
          errors: 0,
          message: 'Connection not found'
        };
      }

      // Process emails
      const result = await this.emailService.processEmails(connectionId, limit);

      return {
        success: true,
        processed: result.processed,
        errors: result.errors,
        message: `Processed ${result.processed} emails with ${result.errors} errors`
      };

    } catch (error) {
      console.error('Error processing emails:', error);
      reply.code(500);
      return {
        success: false,
        processed: 0,
        errors: 0,
        message: 'Failed to process emails'
      };
    }
  }

  /**
   * Get all connections for the current user
   */
  async getConnections(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<ExchangeConnectionListResponse> {
    try {
      const userId = request.user.id;

      const connections = await this.prisma.exchangeConnection.findMany({
        where: {
          userId,
          isActive: true
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          tokens: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              expiresAt: true,
              tokenType: true,
              scope: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const formattedConnections = connections.map(conn => ({
        id: conn.id,
        userId: conn.userId,
        tenantId: conn.tenantId,
        clientId: conn.clientId,
        isActive: conn.isActive,
        createdAt: conn.createdAt,
        updatedAt: conn.updatedAt,
        user: conn.user,
        tokens: conn.tokens.map(token => ({
          id: token.id,
          connectionId: conn.id,
          accessToken: '', // Don't expose actual token
          refreshToken: undefined,
          tokenType: token.tokenType,
          expiresAt: token.expiresAt,
          scope: token.scope,
          createdAt: conn.createdAt,
          updatedAt: conn.updatedAt
        }))
      }));

      return {
        success: true,
        connections: formattedConnections,
        total: connections.length
      };

    } catch (error) {
      console.error('Error fetching connections:', error);
      reply.code(500);
      return {
        success: false,
        connections: [],
        total: 0
      };
    }
  }

  /**
   * Get a specific connection
   */
  async getConnection(
    request: FastifyRequest<{ Params: { connectionId: string } }>,
    reply: FastifyReply
  ): Promise<ExchangeConnectionResponse> {
    try {
      const { connectionId } = request.params;
      const userId = request.user.id;

      const connection = await this.prisma.exchangeConnection.findFirst({
        where: {
          id: connectionId,
          userId,
          isActive: true
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          tokens: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!connection) {
        reply.code(404);
        return {
          success: false,
          error: 'Connection not found'
        };
      }

      return {
        success: true,
        connection: {
          id: connection.id,
          userId: connection.userId,
          tenantId: connection.tenantId,
          clientId: connection.clientId,
          isActive: connection.isActive,
          createdAt: connection.createdAt,
          updatedAt: connection.updatedAt,
          user: connection.user,
          tokens: connection.tokens.map(token => ({
            id: token.id,
            connectionId: token.connectionId,
            accessToken: '', // Don't expose actual token
            refreshToken: undefined,
            tokenType: token.tokenType,
            expiresAt: token.expiresAt,
            scope: token.scope,
            createdAt: token.createdAt,
            updatedAt: token.updatedAt
          }))
        }
      };

    } catch (error) {
      console.error('Error fetching connection:', error);
      reply.code(500);
      return {
        success: false,
        error: 'Internal server error'
      };
    }
  }

  /**
   * Delete a connection
   */
  async deleteConnection(
    request: FastifyRequest<{ Params: { connectionId: string } }>,
    reply: FastifyReply
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const { connectionId } = request.params;
      const userId = request.user.id;

      // Verify connection ownership
      const connection = await this.prisma.exchangeConnection.findFirst({
        where: {
          id: connectionId,
          userId,
          isActive: true
        }
      });

      if (!connection) {
        reply.code(404);
        return {
          success: false,
          error: 'Connection not found'
        };
      }

      // Revoke tokens
      await this.oauthService.revokeTokens(connectionId);

      // Soft delete the connection
      await this.prisma.exchangeConnection.update({
        where: { id: connectionId },
        data: { isActive: false }
      });

      return {
        success: true,
        message: 'Connection deleted successfully'
      };

    } catch (error) {
      console.error('Error deleting connection:', error);
      reply.code(500);
      return {
        success: false,
        error: 'Failed to delete connection'
      };
    }
  }

  /**
   * Test a connection
   */
  async testConnection(
    request: FastifyRequest<{ Params: { connectionId: string } }>,
    reply: FastifyReply
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const { connectionId } = request.params;
      const userId = request.user.id;

      // Verify connection ownership
      const connection = await this.prisma.exchangeConnection.findFirst({
        where: {
          id: connectionId,
          userId,
          isActive: true
        }
      });

      if (!connection) {
        reply.code(404);
        return {
          success: false,
          error: 'Connection not found'
        };
      }

      // Test the connection
      const isWorking = await this.graphService.testConnection(connectionId);

      if (isWorking) {
        return {
          success: true,
          message: 'Connection is working properly'
        };
      } else {
        reply.code(400);
        return {
          success: false,
          error: 'Connection test failed'
        };
      }

    } catch (error) {
      console.error('Error testing connection:', error);
      reply.code(500);
      return {
        success: false,
        error: 'Failed to test connection'
      };
    }
  }
}
