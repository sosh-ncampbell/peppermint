import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { checkToken } from "../lib/jwt";
import { requirePermission } from "../lib/roles";
import { EmailService } from "../lib/email/EmailService";
import { prisma } from "../prisma";

interface EmailProviderConfigRequest {
  provider: 'smtp' | 'exchange';
  connectionId?: string;
  testEmail?: string;
}

export function emailProviderRoutes(fastify: FastifyInstance) {
  // Get current email provider configuration
  fastify.get(
    "/api/v1/email-provider/config",
    {
      preHandler: requirePermission(["integration::manage"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const emailService = new EmailService(prisma);
        await emailService.initializeProvider();
        
        const provider = emailService.getProvider();
        const providerName = provider?.getProviderName() || 'Not configured';
        
        // Get Exchange connections if available
        const exchangeConnections = await prisma.exchangeConnection.findMany({
          where: { isActive: true },
          select: {
            id: true,
            tenantId: true,
            isActive: true,
            createdAt: true,
            user: {
              select: {
                name: true,
                email: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        });

        return reply.send({
          success: true,
          data: {
            currentProvider: providerName,
            environment: {
              EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || 'smtp',
              EXCHANGE_FROM_EMAIL: process.env.EXCHANGE_FROM_EMAIL,
              EXCHANGE_FROM_NAME: process.env.EXCHANGE_FROM_NAME,
              EXCHANGE_REPLY_TO_EMAIL: process.env.EXCHANGE_REPLY_TO_EMAIL,
            },
            exchangeConnections
          }
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: `Failed to get email provider config: ${error}`
        });
      }
    }
  );

  // Test email provider connection
  fastify.post(
    "/api/v1/email-provider/test",
    {
      preHandler: requirePermission(["integration::manage"]),
    },
    async (request: FastifyRequest<{ Body: EmailProviderConfigRequest }>, reply: FastifyReply) => {
      try {
        const { provider, connectionId, testEmail } = request.body;
        
        const emailService = new EmailService(prisma);
        
        // Initialize with specific config for testing
        const testConfig = {
          provider,
          connectionId: provider === 'exchange' ? connectionId : undefined,
          smtpConfig: provider === 'smtp' ? {
            host: process.env.EMAIL_HOST || 'localhost',
            port: parseInt(process.env.EMAIL_PORT || '587'),
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
              user: process.env.EMAIL_USER || '',
              pass: process.env.EMAIL_PASS || ''
            }
          } : undefined
        };

        await emailService.initializeProvider(testConfig);
        const connectionTest = await emailService.testConnection();
        
        if (!connectionTest) {
          return reply.send({
            success: false,
            error: 'Connection test failed'
          });
        }

        // If test email provided, send a test email
        if (testEmail) {
          const result = await emailService.sendEmail({
            to: testEmail,
            subject: 'Test Email from Peppermint',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Email Provider Test</h2>
                <p>This is a test email from your Peppermint helpdesk system.</p>
                <p><strong>Provider:</strong> ${provider}</p>
                <p><strong>Date:</strong> ${new Date().toISOString()}</p>
                <p>If you received this email, your ${provider} configuration is working correctly!</p>
              </div>
            `
          });

          return reply.send({
            success: result.success,
            message: result.success ? 'Test email sent successfully' : 'Test email failed to send',
            error: result.error
          });
        }

        return reply.send({
          success: true,
          message: 'Connection test passed'
        });

      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: `Test failed: ${error}`
        });
      }
    }
  );

  // Get email provider statistics
  fastify.get(
    "/api/v1/email-provider/stats",
    {
      preHandler: requirePermission(["integration::manage"]),
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Get basic email statistics
        const totalTickets = await prisma.ticket.count();
        const emailTickets = await prisma.ticket.count({
          where: { fromImap: true }
        });

        // Get Exchange-specific statistics if Exchange is being used
        const exchangeStats = await prisma.emailProcessingLog.groupBy({
          by: ['status'],
          _count: true
        });

        const exchangeConnections = await prisma.exchangeConnection.count({
          where: { isActive: true }
        });

        const processedStats = exchangeStats.reduce((acc, stat) => {
          acc[stat.status.toLowerCase()] = stat._count;
          return acc;
        }, {} as Record<string, number>);

        return reply.send({
          success: true,
          data: {
            totalTickets,
            emailTickets,
            exchangeConnections,
            emailProcessing: {
              total: exchangeStats.reduce((sum, stat) => sum + stat._count, 0),
              ...processedStats
            }
          }
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: `Failed to get stats: ${error}`
        });
      }
    }
  );
}