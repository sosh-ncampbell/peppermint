import { PrismaClient } from '@prisma/client';
import type { 
  IEmailProvider, 
  EmailMessage, 
  SendEmailResult 
} from '../../types/email';
import { MicrosoftGraphService } from '../exchange/MicrosoftGraphService';

export class ExchangeEmailProvider implements IEmailProvider {
  private prisma: PrismaClient;
  private graphService: MicrosoftGraphService;
  private connectionId: string;
  private fromEmail: string;
  private fromName: string;

  constructor(
    prisma: PrismaClient, 
    connectionId: string, 
    fromEmail: string = process.env.EXCHANGE_FROM_EMAIL || 'support@yourdomain.com',
    fromName: string = process.env.EXCHANGE_FROM_NAME || 'Support Team'
  ) {
    this.prisma = prisma;
    this.graphService = new MicrosoftGraphService(prisma);
    this.connectionId = connectionId;
    this.fromEmail = fromEmail;
    this.fromName = fromName;
  }

  getProviderName(): string {
    return 'Exchange';
  }

  async testConnection(): Promise<boolean> {
    try {
      return await this.graphService.testConnection(this.connectionId);
    } catch (error) {
      console.error('Exchange provider connection test failed:', error);
      return false;
    }
  }

  async sendEmail(message: EmailMessage): Promise<SendEmailResult> {
    try {
      // Handle multiple recipients
      const recipients = Array.isArray(message.to) ? message.to : [message.to];
      let success = true;
      const errors: string[] = [];

      for (const recipient of recipients) {
        try {
          const result = await this.graphService.sendEmail(
            this.connectionId,
            recipient,
            message.subject,
            message.html || message.text || '',
            message.inReplyTo,
            message.headers // Pass custom headers for RFC-compliant ticket tracking
          );

          if (!result) {
            success = false;
            errors.push(`Failed to send to ${recipient}`);
          }
        } catch (error) {
          success = false;
          errors.push(`Error sending to ${recipient}: ${error}`);
        }
      }

      return {
        success,
        error: errors.length > 0 ? errors.join('; ') : undefined
      };

    } catch (error) {
      console.error('Exchange email sending failed:', error);
      return {
        success: false,
        error: `Exchange sending failed: ${error}`
      };
    }
  }
}