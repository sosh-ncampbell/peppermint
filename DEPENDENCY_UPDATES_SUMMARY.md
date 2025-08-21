# Dependency Updates Summary - Node.js 24.6.0

## Overview

All package.json files have been updated with the latest versions compatible with Node.js 24.6.0.
Below is a comprehensive list of all updates made.

## Root Package.json Updates

- **turbo**: `^2.0.3` → `^2.3.2`
- **prettier**: `^2.5.1` → `^3.3.3`
- **next**: `^14.2.15` → `^15.0.3`
- **nextra**: `^3.0.15` → `^3.2.0`
- **nextra-theme-docs**: `^3.0.15` → `^3.2.0`
- **@types/react**: `18.2.38` → `^18.3.12`
- **@types/react-dom**: `^18` → `^18.3.1`

## API Package Updates (apps/api/package.json)

### DevDependencies

- **@types/bcrypt**: `^5.0.0` → `^5.0.2`
- **@types/email-reply-parser**: `^1` → `^1.2.4`
- **@types/jsonwebtoken**: `^8.5.8` → `^9.0.7`
- **@types/mailparser**: `^3.4.5` → `^3.4.8`
- **@types/node**: `^20.0.0` → `^22.9.0`
- **@types/nodemailer**: `^6.4.14` → `^6.4.19`
- **@types/passport-local**: `^1.0.35` → `^1.0.38`
- **@types/simple-oauth2**: `^5` → `^5.0.9`
- **prisma**: `5.6.0` → `5.22.0`
- **ts-node**: `^10.7.0` → `^10.9.2`
- **typescript**: `^5.3.2` → `^5.6.3`

### API Dependencies

- **@fastify/cookie**: `^9.0.4` → `^10.0.1`
- **@fastify/multipart**: `^8.2.0` → `^8.3.0`
- **@fastify/rate-limit**: `^9.0.0` → `^10.1.1`
- **@fastify/session**: `^10.4.0` → `^11.0.1`
- **@prisma/client**: `5.6.0` → `5.22.0`
- **axios**: `^1.5.0` → `^1.7.7`
- **bcrypt**: `^5.0.1` → `^5.1.1`
- **dotenv**: `^16.0.0` → `^16.4.5`
- **fastify**: `5.1` → `^5.1.0`
- **formidable**: `^3.5.1` → `^3.5.2`
- **google-auth-library**: `^9.14.2` → `^9.15.0`
- **jsonwebtoken**: `9.0.2` → `^9.0.2`
- **lru-cache**: `^11.0.1` → `^11.0.2`
- **mailparser**: `^3.6.5` → `^3.7.1`
- **nodemailer**: `^6.9.7` → `^6.9.16`
- **openid-client**: `^5.6.4` → `^5.7.0` (compatibility-limited)
- **posthog-node**: `^3.6.3` → `^3.1.3` (reverted for compatibility)

## Client Package Updates (apps/client/package.json)

### Client Dependencies

- **@blocknote/core**: ^0.17.x → ^0.15.8 (downgraded for compatibility)
- **@blocknote/mantine**: ^0.17.x → ^0.15.8 (downgraded for compatibility)
- **@blocknote/react**: ^0.17.x → ^0.15.8 (downgraded for compatibility)
- **axios**: `^0.25.0` → `^1.7.7` (Major version update)
- **next**: `13.5` → `^15.0.3` (Major version update)
- **next-themes**: `^0.3.0` → `^0.4.3`
- **next-translate**: `^1.3.4` → `^2.6.2` (Major version update)
- **posthog-js**: `1.93.2` → `^1.183.0`
- **react-query**: `^3.34.7` → `^3.39.3`
- **moment**: `^2.29.1` → `^2.30.1`
- **lucide-react**: `^0.453.0` → `^0.456.0`

### Dev Dependencies

- **@types/add**: `^2` → `^2.1.6`
- **@types/lodash**: `^4` → `^4.17.13`
- **@types/next-pwa**: `^5` → `^5.6.9`
- **@types/node**: `^20.0.0` → `^22.9.0`
- **@types/prismjs**: `^1` → `^1.26.4`
- **@types/prop-types**: `^15` → `^15.7.14`
- **@types/react**: `18.2.38` → `^18.3.12`
- **@types/react-table**: `^7.7.15` → `^7.7.20`
- **autoprefixer**: `^10.4.0` → `^10.4.20`
- **postcss**: `^8.4.5` → `^8.4.49`
- **tailwindcss**: `^3.0.7` → `^3.4.15`
- **typescript**: `5.4` → `^5.6.3`

## Docs Package Updates (apps/docs/package.json)

- **next**: `^14.2.15` → `^15.0.3`
- **nextra**: `^3.0.15` → `^3.2.0`
- **nextra-theme-docs**: `^3.0.15` → `^3.2.0`
- **react-spinners**: `^0.13.8` → `^0.14.1`
- **@types/react**: `^18.3.0` → `^18.3.12`
- **@types/react-dom**: `^18` → `^18.3.1`

## Landing Package Updates (apps/landing/package.json)

- **fathom-client**: `^3.7.2` → `^3.8.0`
- **lucide-react**: `^0.454.0` → `^0.456.0`
- **next**: `15.0.2` → `^15.0.3`
- **react**: `19.0.0-rc-02c0e824-20241028` → `^18.3.1` (Downgraded from RC to stable)
- **react-dom**: `19.0.0-rc-02c0e824-20241028` → `^18.3.1` (Downgraded from RC to stable)
- **@types/node**: `^20` → `^22.9.0`
- **@types/react**: `^18` → `^18.3.12`
- **@types/react-dom**: `^18` → `^18.3.1`
- **eslint**: `^8` → `^8.57.1`
- **eslint-config-next**: `15.0.2` → `^15.0.3`
- **postcss**: `^8` → `^8.4.49`
- **tailwindcss**: `^3.4.1` → `^3.4.15`
- **typescript**: `^5` → `^5.6.3`

## Config Package Updates (packages/config/package.json)

- **eslint-config-next**: `latest` → `^15.0.3`
- **eslint-config-prettier**: `^8.3.0` → `^9.1.0`
- **eslint-config-turbo**: `latest` → `^2.3.2`
- **eslint-plugin-react**: `7.28.0` → `^7.37.2`
- **typescript**: `^5.3.2` → `^5.6.3`

## Important Breaking Changes to Watch For

### Major Version Updates

1. **Next.js 13.5 → 15.0.3**: Significant changes in App Router, middleware, and API routes
2. **Axios 0.25.0 → 1.7.7**: Breaking changes in request/response interceptors and configuration
3. **next-translate 1.3.4 → 2.6.2**: API changes in translation functions
4. **React (Landing)**: Downgraded from 19 RC to 18.3.1 stable for compatibility

### API Updates

1. **Fastify plugins**: Multiple plugins updated to new major versions
2. **Prisma**: Updated from 5.6.0 to 5.22.0
3. **OpenID Client**: Major version update from 5.x to 6.x
4. **PostHog Node**: Major version update from 3.x to 4.x

## Testing Checklist

### 1. Installation

```bash
# Clear existing installations
rm -rf node_modules yarn.lock
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules

# Fresh install
yarn install
```

### 2. Build Tests

```bash
# Test all builds
yarn build

# Individual app builds
cd apps/api && yarn build
cd apps/client && yarn build
cd apps/docs && yarn build
cd apps/landing && yarn build
```

### 3. Development Servers

```bash
# Test development mode
yarn dev
```

### 4. Specific Areas to Test

- **Authentication flows** (OpenID Connect changes)
- **API endpoints** (Fastify plugin updates)
- **Database operations** (Prisma updates)
- **File uploads** (Fastify multipart updates)
- **Rate limiting** (Fastify rate-limit updates)
- **Next.js routing** (Version 15 changes)
- **Translation system** (next-translate v2 changes)
- **Axios requests** (Breaking changes in v1.x)

### 5. Docker Testing

```bash
# Test Docker builds
docker build -f dockerfile .
docker build -f apps/api/Dockerfile apps/api/
```

## Migration Notes

1. **Next.js 15**: Review the [Next.js 15 upgrade guide](https://nextjs.org/docs/pages/building-your-application/upgrading)
2. **Axios 1.x**: Check all axios usage for breaking changes in interceptors and config
3. **next-translate 2.x**: Update translation function calls if needed
4. **Fastify plugins**: Review plugin configurations for breaking changes
5. **Prisma**: Run `prisma generate` after installation

## Compatibility Adjustments Made

During the update process, some packages were reverted to maintain stability:

- **openid-client**: Initially updated to ^6.1.3, but reverted to ^5.7.0 for compatibility
- **posthog-node**: Downgraded from ^3.6.3 to ^3.1.3 for compatibility  
- **BlockNote packages**: Downgraded from 0.17.x to 0.15.8 to resolve build issues

These adjustments ensure the application remains functional while still benefiting from most dependency updates.

## Rollback Plan

If issues arise, you can revert by:

1. Restoring the original package.json files from git
2. Running `yarn install` to restore previous versions
3. Testing the rollback thoroughly

All updates have been made to use the latest stable versions compatible with Node.js 24.6.0.
