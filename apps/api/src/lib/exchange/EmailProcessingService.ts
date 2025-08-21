import { PrismaClient } from '@prisma/client';
import type { 
  GraphEmailMessage, 
  IEmailProcessingService 
} from '../../types/exchange';
import { MicrosoftGraphService } from './MicrosoftGraphService';
import { extractPlainText, sanitizeEmailContent } from './crypto';

export class EmailProcessingService implements IEmailProcessingService {
  private prisma: PrismaClient;
  private graphService: MicrosoftGraphService;
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.graphService = new MicrosoftGraphService(prisma);
  }

  /**
   * Process emails from Exchange and create tickets
   */
  async processEmails(connectionId: string, limit: number = 50): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      // Verify connection exists and is active
      const connection = await this.prisma.exchangeConnection.findUnique({
        where: { id: connectionId }
      });

      if (!connection || !connection.isActive) {
        throw new Error('Connection not found or inactive');
      }

      // Fetch emails from Microsoft Graph
      const emails = await this.graphService.getEmails(connectionId, limit);
      
      console.log(`Processing ${emails.length} emails for connection ${connectionId}`);

      for (const email of emails) {
        try {
          await this.processEmail(email, connectionId);
          processed++;
        } catch (error) {
          console.error(`Error processing email ${email.id}:`, error);
          errors++;
          
          // Log the error for tracking
          await this.logEmailProcessing(
            connectionId,
            email.id,
            email.subject,
            email.from?.emailAddress?.address,
            'FAILED',
            null,
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      }

      console.log(`Email processing complete: ${processed} processed, ${errors} errors`);
      return { processed, errors };

    } catch (error) {
      console.error('Error in processEmails:', error);
      throw error;
    }
  }

  /**
   * Process a single email message
   */
  private async processEmail(message: GraphEmailMessage, connectionId: string): Promise<void> {
    // Check if this email has already been processed
    const existingLog = await this.prisma.emailProcessingLog.findUnique({
      where: { messageId: message.id }
    });

    if (existingLog) {
      console.log(`Email ${message.id} already processed, skipping`);
      return;
    }

    // Log processing attempt
    await this.logEmailProcessing(
      connectionId,
      message.id,
      message.subject,
      message.from?.emailAddress?.address,
      'PROCESSING'
    );

    try {
      // Check if this email is part of an existing conversation
      const existingMapping = await this.prisma.ticketEmailMapping.findFirst({
        where: {
          OR: [
            { messageId: message.id },
            { threadId: message.conversationId }
          ]
        },
        include: { ticket: true }
      });

      let ticketId: string;

      if (existingMapping) {
        // Add to existing ticket
        ticketId = existingMapping.ticketId;
        await this.addCommentToTicket(ticketId, message);
      } else {
        // Create new ticket
        ticketId = await this.createTicketFromEmail(message, connectionId);
      }

      // Create email-ticket mapping
      await this.linkEmailToTicket(message.id, ticketId, message.conversationId);

      // Update processing log
      await this.logEmailProcessing(
        connectionId,
        message.id,
        message.subject,
        message.from?.emailAddress?.address,
        'SUCCESS',
        ticketId
      );

    } catch (error) {
      console.error(`Error processing email ${message.id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new ticket from an email message
   */
  async createTicketFromEmail(message: GraphEmailMessage, connectionId: string): Promise<string> {
    try {
      // Get connection details to determine the assigned user
      const connection = await this.prisma.exchangeConnection.findUnique({
        where: { id: connectionId },
        include: { user: true }
      });

      if (!connection) {
        throw new Error('Connection not found');
      }

      // Extract and sanitize email content
      const htmlContent = message.body?.content || '';
      const plainTextContent = extractPlainText(htmlContent);
      const sanitizedContent = sanitizeEmailContent(htmlContent);

      // Create the ticket
      const ticket = await this.prisma.ticket.create({
        data: {
          title: message.subject || 'No Subject',
          detail: plainTextContent.substring(0, 1000), // Limit detail length
          note: sanitizedContent,
          priority: 'Low', // Default priority, could be enhanced with email analysis
          status: 'needs_support',
          isComplete: false,
          userId: connection.userId, // Assign to the connection owner
          email: message.from?.emailAddress?.address,
          name: message.from?.emailAddress?.name || message.from?.emailAddress?.address,
          // You might want to set clientId based on email domain or other logic
        }
      });

      console.log(`Created ticket ${ticket.id} from email ${message.id}`);
      return ticket.id;

    } catch (error) {
      console.error('Error creating ticket from email:', error);
      throw error;
    }
  }

  /**
   * Add a comment to an existing ticket
   */
  private async addCommentToTicket(ticketId: string, message: GraphEmailMessage): Promise<void> {
    try {
      // Get the connection user for the comment
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { user: true }
      });

      if (!ticket) {
        throw new Error(`Ticket ${ticketId} not found`);
      }

      const plainTextContent = extractPlainText(message.body?.content || '');

      await this.prisma.comment.create({
        data: {
          text: plainTextContent,
          ticketId: ticketId,
          userId: ticket.userId,
          public: false, // Email comments default to private
          // Note: You might want to create a special "system" user for email-generated comments
        }
      });

      console.log(`Added comment to ticket ${ticketId} from email ${message.id}`);

    } catch (error) {
      console.error('Error adding comment to ticket:', error);
      throw error;
    }
  }

  /**
   * Link an email to a ticket
   */
  async linkEmailToTicket(messageId: string, ticketId: string, threadId?: string): Promise<void> {
    try {
      await this.prisma.ticketEmailMapping.create({
        data: {
          ticketId,
          messageId,
          threadId
        }
      });
    } catch (error) {
      // Handle unique constraint violations gracefully
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        console.log(`Email ${messageId} already linked to ticket ${ticketId}`);
        return;
      }
      throw error;
    }
  }

  /**
   * Log email processing status
   */
  private async logEmailProcessing(
    connectionId: string,
    messageId: string,
    subject?: string,
    sender?: string,
    status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'SKIPPED' = 'PENDING',
    ticketId?: string | null,
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.prisma.emailProcessingLog.upsert({
        where: { messageId },
        update: {
          status,
          ticketId,
          errorMessage,
          processedAt: status === 'SUCCESS' || status === 'FAILED' ? new Date() : null
        },
        create: {
          connectionId,
          messageId,
          subject,
          sender,
          status,
          ticketId,
          errorMessage,
          processedAt: status === 'SUCCESS' || status === 'FAILED' ? new Date() : null
        }
      });
    } catch (error) {
      console.error('Error logging email processing:', error);
      // Don't throw here as this is just logging
    }
  }

  /**
   * Get processing statistics for a connection
   */
  async getProcessingStats(connectionId: string): Promise<{
    total: number;
    pending: number;
    processing: number;
    success: number;
    failed: number;
    skipped: number;
  }> {
    const stats = await this.prisma.emailProcessingLog.groupBy({
      by: ['status'],
      where: { connectionId },
      _count: { status: true }
    });

    const result = {
      total: 0,
      pending: 0,
      processing: 0,
      success: 0,
      failed: 0,
      skipped: 0
    };

    stats.forEach(stat => {
      const count = stat._count.status;
      result.total += count;
      switch (stat.status) {
        case 'PENDING':
          result.pending = count;
          break;
        case 'PROCESSING':
          result.processing = count;
          break;
        case 'SUCCESS':
          result.success = count;
          break;
        case 'FAILED':
          result.failed = count;
          break;
        case 'SKIPPED':
          result.skipped = count;
          break;
      }
    });

    return result;
  }

  /**
   * Clean up old processing logs
   */
  async cleanupOldLogs(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    await this.prisma.emailProcessingLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate
        },
        status: {
          in: ['SUCCESS', 'FAILED', 'SKIPPED']
        }
      }
    });
  }
}
