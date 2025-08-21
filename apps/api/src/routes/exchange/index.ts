import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { requirePermission } from '../../lib/requirePermission';
import { ExchangeController } from '../../controllers/exchange/ExchangeController';
import { checkSession } from '../../lib/checkSession';

export default async function exchangeRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  const controller = new ExchangeController(fastify.prisma);

  // Middleware to check authentication for all routes
  fastify.addHook('preHandler', checkSession);

  /**
   * @route POST /api/v1/exchange/connections
   * @desc Create a new Exchange connection
   * @access Private (requires authentication)
   */
  fastify.post(
    '/connections',
    {
      preHandler: [requirePermission(['admin::manage'])],
      schema: {
        description: 'Create a new Microsoft 365 Exchange connection',
        tags: ['Exchange'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['tenantId', 'clientId'],
          properties: {
            tenantId: {
              type: 'string',
              description: 'Microsoft 365 tenant ID'
            },
            clientId: {
              type: 'string',
              description: 'Azure application client ID'
            }
          }
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              connection: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  tenantId: { type: 'string' },
                  clientId: { type: 'string' },
                  isActive: { type: 'boolean' },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' }
                }
              }
            }
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' }
            }
          }
        }
      }
    },
    controller.createConnection.bind(controller)
  );

  /**
   * @route GET /api/v1/exchange/connections
   * @desc Get all Exchange connections for the current user
   * @access Private
   */
  fastify.get(
    '/connections',
    {
      preHandler: [requirePermission(['admin::manage'])],
      schema: {
        description: 'Get all Exchange connections',
        tags: ['Exchange'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              connections: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    userId: { type: 'string' },
                    tenantId: { type: 'string' },
                    clientId: { type: 'string' },
                    isActive: { type: 'boolean' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' }
                  }
                }
              },
              total: { type: 'number' }
            }
          }
        }
      }
    },
    controller.getConnections.bind(controller)
  );

  /**
   * @route GET /api/v1/exchange/connections/:connectionId
   * @desc Get a specific Exchange connection
   * @access Private
   */
  fastify.get(
    '/connections/:connectionId',
    {
      preHandler: [requirePermission(['admin::manage'])],
      schema: {
        description: 'Get a specific Exchange connection',
        tags: ['Exchange'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['connectionId'],
          properties: {
            connectionId: { type: 'string' }
          }
        }
      }
    },
    controller.getConnection.bind(controller)
  );

  /**
   * @route DELETE /api/v1/exchange/connections/:connectionId
   * @desc Delete an Exchange connection
   * @access Private
   */
  fastify.delete(
    '/connections/:connectionId',
    {
      preHandler: [requirePermission(['admin::manage'])],
      schema: {
        description: 'Delete an Exchange connection',
        tags: ['Exchange'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['connectionId'],
          properties: {
            connectionId: { type: 'string' }
          }
        }
      }
    },
    controller.deleteConnection.bind(controller)
  );

  /**
   * @route POST /api/v1/exchange/connections/:connectionId/oauth/initiate
   * @desc Initiate OAuth flow for a connection
   * @access Private
   */
  fastify.post(
    '/connections/:connectionId/oauth/initiate',
    {
      preHandler: [requirePermission(['admin::manage'])],
      schema: {
        description: 'Initiate OAuth flow for Exchange connection',
        tags: ['Exchange'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['connectionId'],
          properties: {
            connectionId: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              authUrl: { type: 'string' }
            }
          }
        }
      }
    },
    controller.initiateOAuth.bind(controller)
  );

  /**
   * @route GET /api/v1/exchange/oauth/callback
   * @desc Handle OAuth callback from Microsoft
   * @access Public (no auth required for OAuth callback)
   */
  fastify.get(
    '/oauth/callback',
    {
      preHandler: [], // No auth required for OAuth callback
      schema: {
        description: 'OAuth callback handler',
        tags: ['Exchange'],
        querystring: {
          type: 'object',
          required: ['code', 'state'],
          properties: {
            code: { type: 'string' },
            state: { type: 'string' }
          }
        }
      }
    },
    controller.handleOAuthCallback.bind(controller)
  );

  /**
   * @route POST /api/v1/exchange/connections/:connectionId/process-emails
   * @desc Process emails for a connection
   * @access Private
   */
  fastify.post(
    '/connections/:connectionId/process-emails',
    {
      preHandler: [requirePermission(['admin::manage'])],
      schema: {
        description: 'Process emails from Exchange',
        tags: ['Exchange'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['connectionId'],
          properties: {
            connectionId: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              minimum: 1,
              maximum: 200,
              default: 50,
              description: 'Maximum number of emails to process'
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              processed: { type: 'number' },
              errors: { type: 'number' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    controller.processEmails.bind(controller)
  );

  /**
   * @route POST /api/v1/exchange/connections/:connectionId/test
   * @desc Test an Exchange connection
   * @access Private
   */
  fastify.post(
    '/connections/:connectionId/test',
    {
      preHandler: [requirePermission(['admin::manage'])],
      schema: {
        description: 'Test Exchange connection',
        tags: ['Exchange'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['connectionId'],
          properties: {
            connectionId: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' }
            }
          }
        }
      }
    },
    controller.testConnection.bind(controller)
  );
}

// Export route metadata for registration
export const exchangeRoutesMetadata = {
  prefix: '/exchange',
  tags: ['Exchange Integration']
};
