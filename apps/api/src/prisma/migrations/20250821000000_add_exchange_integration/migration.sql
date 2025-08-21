-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "ExchangeConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeToken" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenType" TEXT NOT NULL DEFAULT 'Bearer',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeOAuthSession" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeOAuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailProcessingLog" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "subject" TEXT,
    "sender" TEXT,
    "status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "ticketId" TEXT,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailProcessingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketEmailMapping" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "threadId" TEXT,
    "connectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketEmailMapping_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "ExchangeConnection_userId_tenantId_clientId_key" ON "ExchangeConnection"("userId", "tenantId", "clientId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "ExchangeToken_connectionId_key" ON "ExchangeToken"("connectionId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "ExchangeOAuthSession_state_key" ON "ExchangeOAuthSession"("state");

-- CreateIndex
CREATE INDEX "ExchangeOAuthSession_connectionId_idx" ON "ExchangeOAuthSession"("connectionId");

-- CreateIndex
CREATE INDEX "ExchangeOAuthSession_expiresAt_idx" ON "ExchangeOAuthSession"("expiresAt");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "EmailProcessingLog_connectionId_messageId_key" ON "EmailProcessingLog"("connectionId", "messageId");

-- CreateIndex
CREATE INDEX "EmailProcessingLog_connectionId_idx" ON "EmailProcessingLog"("connectionId");

-- CreateIndex
CREATE INDEX "EmailProcessingLog_ticketId_idx" ON "EmailProcessingLog"("ticketId");

-- CreateIndex
CREATE INDEX "EmailProcessingLog_processedAt_idx" ON "EmailProcessingLog"("processedAt");

-- CreateIndex
CREATE INDEX "EmailProcessingLog_status_idx" ON "EmailProcessingLog"("status");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "TicketEmailMapping_ticketId_messageId_key" ON "TicketEmailMapping"("ticketId", "messageId");

-- CreateIndex
CREATE INDEX "TicketEmailMapping_connectionId_idx" ON "TicketEmailMapping"("connectionId");

-- CreateIndex
CREATE INDEX "TicketEmailMapping_threadId_idx" ON "TicketEmailMapping"("threadId");

-- AddForeignKey
ALTER TABLE "ExchangeConnection" ADD CONSTRAINT "ExchangeConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeToken" ADD CONSTRAINT "ExchangeToken_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ExchangeConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeOAuthSession" ADD CONSTRAINT "ExchangeOAuthSession_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ExchangeConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeOAuthSession" ADD CONSTRAINT "ExchangeOAuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailProcessingLog" ADD CONSTRAINT "EmailProcessingLog_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ExchangeConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailProcessingLog" ADD CONSTRAINT "EmailProcessingLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEmailMapping" ADD CONSTRAINT "TicketEmailMapping_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketEmailMapping" ADD CONSTRAINT "TicketEmailMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ExchangeConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
