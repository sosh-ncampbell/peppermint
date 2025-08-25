import { PrismaClient } from '@prisma/client';
import type { 
  IEmailProvider,
  EmailMessage,
  SendEmailResult,
  EmailProviderConfig,
  TicketEmailContext
} from '../../types/email';
import { ExchangeEmailProvider } from './ExchangeEmailProvider';
import { SMTPEmailProvider } from './SMTPEmailProvider';
import { exchangeLogger } from '../exchange/logger';

export class EmailService {
  private prisma: PrismaClient;
  private provider: IEmailProvider | null = null;
  private config: EmailProviderConfig | null = null;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Initialize the email provider based on configuration
   */
  async initializeProvider(config?: EmailProviderConfig): Promise<void> {
    if (config) {
      this.config = config;
    } else {
      // Load configuration from environment or database
      this.config = await this.loadConfiguration();
    }

    if (!this.config) {
      throw new Error('No email provider configuration found');
    }

    switch (this.config.provider) {
      case 'exchange':
        if (!this.config.connectionId) {
          throw new Error('Exchange connection ID is required');
        }
        this.provider = new ExchangeEmailProvider(
          this.prisma,
          this.config.connectionId
        );
        break;

      case 'smtp':
        if (!this.config.smtpConfig) {
          throw new Error('SMTP configuration is required');
        }
        this.provider = new SMTPEmailProvider(this.config.smtpConfig);
        break;

      default:
        throw new Error(`Unsupported email provider: ${this.config.provider}`);
    }
  }

  /**
   * Get the current email provider
   */
  getProvider(): IEmailProvider | null {
    return this.provider;
  }

  /**
   * Send an email using the configured provider
   */
  async sendEmail(message: EmailMessage): Promise<SendEmailResult> {
    if (!this.provider) {
      await this.initializeProvider();
    }

    if (!this.provider) {
      throw new Error('Email provider not initialized');
    }

    return await this.provider.sendEmail(message);
  }

  /**
   * Send a ticket notification email
   */
  async sendTicketEmail(
    to: string | string[],
    subject: string,
    htmlContent: string,
    context: TicketEmailContext
  ): Promise<SendEmailResult> {
    const message: EmailMessage = {
      to,
      subject: `[Ticket #${context.ticketNumber}] ${subject}`,
      html: htmlContent,
      threadId: context.threadId,
      inReplyTo: context.originalMessageId,
    };

    // Add references for proper threading
    if (context.originalMessageId) {
      message.references = context.originalMessageId;
    }

    // Add RFC-compliant custom headers for ticket tracking resilience
    message.headers = {
      'X-Peppermint-Ticket-ID': context.ticketId,
      'X-Peppermint-Ticket-Number': context.ticketNumber,
      'X-Peppermint-System': 'peppermint-helpdesk',
      'X-Auto-Response-Suppress': 'OOF, DR, RN, NRN, AutoReply',
      ...(context.threadId && { 'X-Peppermint-Thread-ID': context.threadId }),
      ...(context.originalMessageId && { 'X-Peppermint-Original-Message-ID': context.originalMessageId }),
      ...(context.isReply && { 'X-Peppermint-Message-Type': 'reply' }),
      ...(!context.isReply && { 'X-Peppermint-Message-Type': 'notification' }),
    };

    const result = await this.sendEmail(message);

    // Log the outbound email for tracking
    if (result.success) {
      await this.logOutboundEmail({
        ticketId: context.ticketId,
        messageId: result.messageId,
        recipient: Array.isArray(to) ? to.join(',') : to,
        subject: message.subject,
        provider: this.provider?.getProviderName() || 'unknown'
      });
    }

    return result;
  }

  /**
   * Test the current provider connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.provider) {
      await this.initializeProvider();
    }

    if (!this.provider) {
      return false;
    }

    return await this.provider.testConnection();
  }

  /**
   * Load email provider configuration
   */
  private async loadConfiguration(): Promise<EmailProviderConfig> {
    const emailProvider = process.env.EMAIL_PROVIDER as 'smtp' | 'exchange';
    
    if (emailProvider === 'exchange') {
      // Find the first active Exchange connection for this tenant
      const connection = await this.prisma.exchangeConnection.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      });

      if (!connection) {
        throw new Error('No active Exchange connection found');
      }

      return {
        provider: 'exchange',
        connectionId: connection.id
      };
    } else {
      // Default to SMTP with environment variables
      return {
        provider: 'smtp',
        smtpConfig: {
          host: process.env.EMAIL_HOST || 'localhost',
          port: parseInt(process.env.EMAIL_PORT || '587'),
          secure: process.env.EMAIL_SECURE === 'true',
          auth: {
            user: process.env.EMAIL_USER || '',
            pass: process.env.EMAIL_PASS || ''
          }
        }
      };
    }
  }

  /**
   * Log outbound email for tracking and debugging
   */
  private async logOutboundEmail(data: {
    ticketId: string;
    messageId?: string;
    recipient: string;
    subject: string;
    provider: string;
  }): Promise<void> {
    try {
      // You could create a table for outbound email logs
      exchangeLogger.info('Outbound email sent:', {
        ticketId: data.ticketId,
        messageId: data.messageId,
        recipient: data.recipient,
        subject: data.subject,
        provider: data.provider,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      exchangeLogger.error('Failed to log outbound email:', { error: error as Error });
    }
  }
}