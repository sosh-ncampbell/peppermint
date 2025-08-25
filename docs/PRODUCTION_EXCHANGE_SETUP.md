# Peppermint Exchange Integration - Production Setup Guide

## Overview
This guide helps you deploy Peppermint with Microsoft 365 Exchange integration to your existing production Docker environment with Traefik.

## Prerequisites
- Existing Docker environment with Traefik (✅ You have this)
- Microsoft 365 Exchange Online subscription
- Azure Active Directory tenant
- Domain access for OAuth redirect URI

## Setup Steps

### 1. Azure App Registration

1. **Go to Azure Portal**: https://portal.azure.com
2. **Navigate to**: Azure Active Directory → App registrations → New registration
3. **Configure the app**:
   ```
   Name: Peppermint Helpdesk Exchange Integration
   Supported account types: Accounts in this organizational directory only
   Redirect URI: https://saruman.smartservices.tech/admin/exchange/callback
   ```

4. **Note down these values**:
   - Application (client) ID → `MICROSOFT_CLIENT_ID`
   - Directory (tenant) ID → `MICROSOFT_TENANT_ID`

5. **Create a client secret**:
   - Go to "Certificates & secrets" → "New client secret"
   - Description: "Peppermint Production"
   - Expires: 24 months (recommended)
   - Copy the secret value → `MICROSOFT_CLIENT_SECRET`

6. **Configure API permissions**:
   - Go to "API permissions" → "Add a permission" → "Microsoft Graph"
   - **Delegated permissions** (required):
     - `Mail.Read` - Read user mail
     - `Mail.Send` - Send mail as user
     - `User.Read` - Sign in and read user profile
     - `offline_access` - Maintain access to data you have given it access to

7. **Grant admin consent** (if required by your organization)

### 2. Exchange Mailbox Setup

1. **Create dedicated service account** (recommended):
   ```
   Email: tickets@smartofficesinc.com
   Purpose: Dedicated account for Peppermint email processing
   License: Exchange Online Plan 1 (minimum)
   ```

2. **Set up distribution group** (optional but recommended):
   ```
   Distribution Group: support@smartofficesinc.com
   Members: Your support team
   Purpose: Reply-To address for better ticket management
   ```

3. **Configure mailbox permissions**:
   - Ensure the service account has necessary permissions
   - Test email sending/receiving capabilities

### 3. Update Your Production Environment

1. **Update your `.env` file** with the values from Azure:
   ```bash
   # Copy .env.production template and fill in your values
   cp .env.production .env.production.local
   
   # Edit with your specific values:
   MICROSOFT_CLIENT_ID=your_actual_client_id
   MICROSOFT_CLIENT_SECRET=your_actual_client_secret
   MICROSOFT_TENANT_ID=your_actual_tenant_id
   
   # Configure Exchange settings
   EMAIL_PROVIDER=exchange
   EXCHANGE_FROM_EMAIL=tickets@smartofficesinc.com
   EXCHANGE_REPLY_TO_EMAIL=support@smartofficesinc.com
   ```

2. **Update your docker-compose.yml**:
   - The new environment variables are already included in the updated template
   - Add `env_file` to your peppermint service:
   ```yaml
   peppermint:
     # ... existing configuration
     env_file:
       - .env.production.local
   ```

### 4. Deployment Process

1. **Backup existing data**:
   ```bash
   # Backup your PostgreSQL database
   docker exec peppermint_postgres pg_dump -U peppermint peppermint > backup_$(date +%Y%m%d).sql
   ```

2. **Deploy with Exchange integration**:
   ```bash
   # Pull latest image with Exchange support
   docker-compose pull peppermint
   
   # Restart with new configuration
   docker-compose up -d peppermint
   
   # Check logs for successful startup
   docker-compose logs -f peppermint
   ```

3. **Verify deployment**:
   - Check https://saruman.smartservices.tech
   - Log in as admin
   - Navigate to Settings → Exchange Integration
   - Test the connection

### 5. Initial Exchange Setup

1. **Access Peppermint admin panel**:
   - Go to https://saruman.smartservices.tech/admin
   - Navigate to "Exchange Integration" section

2. **Initiate OAuth flow**:
   - Click "Connect to Exchange"
   - Sign in with your service account (tickets@smartofficesinc.com)
   - Grant permissions when prompted

3. **Test email processing**:
   - Send a test email to tickets@smartofficesinc.com
   - Check if it creates a ticket in Peppermint
   - Reply to the ticket and verify email is sent

### 6. Production Configuration

1. **Email processing schedule**:
   ```
   Current: Every 5 minutes (EXCHANGE_EMAIL_POLL_INTERVAL=300000)
   Recommendation: Keep default for production
   ```

2. **Rate limiting**:
   ```
   Current: 100 requests per minute (EXCHANGE_RATE_LIMIT=100)
   Microsoft Graph limit: 10,000 requests per 10 minutes per app
   Recommendation: Keep default, monitor usage
   ```

3. **Security settings**:
   ```
   EXCHANGE_COOKIE_SECURE=true (HTTPS only)
   EXCHANGE_COOKIE_HTTPONLY=true (XSS protection)
   EXCHANGE_COOKIE_SAMESITE=strict (CSRF protection)
   ```

### 7. Monitoring & Troubleshooting

1. **Check application logs**:
   ```bash
   # View real-time logs
   docker-compose logs -f peppermint
   
   # Filter Exchange-specific logs
   docker-compose logs peppermint | grep -i exchange
   ```

2. **Health checks**:
   - Monitor OAuth token expiry
   - Check email processing queues
   - Verify API rate limit compliance

3. **Common issues**:
   - **OAuth failures**: Check redirect URI matches exactly
   - **Permission errors**: Verify API permissions and admin consent
   - **Email not processing**: Check service account credentials
   - **Rate limiting**: Monitor Microsoft Graph API usage

### 8. Security Considerations

1. **Network security**:
   - Exchange API calls are made over HTTPS
   - OAuth tokens are stored encrypted in database
   - Session cookies are secure and HTTP-only

2. **Access control**:
   - IP allowlist is already configured in your Traefik labels
   - Exchange integration requires admin privileges

3. **Monitoring**:
   - Set up alerts for OAuth token expiry
   - Monitor unusual API usage patterns
   - Log authentication events

## Production Checklist

- [ ] Azure App Registration created and configured
- [ ] API permissions granted and admin consent provided
- [ ] Service account (tickets@smartofficesinc.com) created
- [ ] Distribution group (support@smartofficesinc.com) configured
- [ ] Environment variables configured in `.env.production.local`
- [ ] Docker Compose updated with new environment variables
- [ ] Database backed up before deployment
- [ ] Application deployed and running successfully
- [ ] OAuth connection established and tested
- [ ] Test email sent and ticket created
- [ ] Reply functionality tested
- [ ] Monitoring and alerting configured

## Support

For issues during setup:
1. Check application logs for specific error messages
2. Verify Azure app registration configuration
3. Test OAuth flow manually through admin interface
4. Ensure all environment variables are correctly set

The Exchange integration adds robust email processing capabilities to your existing Peppermint deployment while maintaining your current security and networking setup.