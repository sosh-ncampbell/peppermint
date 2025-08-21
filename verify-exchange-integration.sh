#!/bin/bash

# Exchange Integration Verification Script
print_info "Verifying Exchange integration installation..."

# Check if all required files exist
FILES=(
    "apps/api/src/lib/types/exchange.ts"
    "apps/api/src/lib/crypto/pkce.ts"
    "apps/api/src/lib/services/MicrosoftGraphService.ts"
    "apps/api/src/lib/services/OAuthService.ts"
    "apps/api/src/lib/services/EmailProcessingService.ts"
    "apps/api/src/controllers/exchange/ExchangeController.ts"
    "apps/api/src/routes/exchange/index.ts"
    "apps/client/pages/admin/exchange/index.tsx"
    "apps/client/pages/admin/exchange/callback.tsx"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "✓ $file"
    else
        print_error "✗ $file - Missing!"
    fi
done

# Check Prisma schema
if grep -q "model ExchangeConnection" apps/api/src/prisma/schema.prisma; then
    print_success "✓ Prisma schema updated"
else
    print_error "✗ Prisma schema not updated"
fi

# Check migration
if [ -d "apps/api/src/prisma/migrations/20250120000000_add_exchange_integration" ]; then
    print_success "✓ Migration directory exists"
else
    print_error "✗ Migration directory missing"
fi

# Check dependencies
print_info "Checking dependencies..."

cd apps/api
if yarn list @azure/msal-node > /dev/null 2>&1; then
    print_success "✓ @azure/msal-node installed"
else
    print_warning "⚠ @azure/msal-node not installed - run: yarn add @azure/msal-node"
fi

if yarn list axios > /dev/null 2>&1; then
    print_success "✓ axios installed"
else
    print_warning "⚠ axios not installed - run: yarn add axios"
fi

cd ../client
if yarn list sonner > /dev/null 2>&1; then
    print_success "✓ sonner installed"
else
    print_warning "⚠ sonner not installed - run: yarn add sonner"
fi

cd ../..

print_info "Verification complete!"
print_info "Next steps:"
echo "1. Install any missing dependencies"
echo "2. Run database migration: cd apps/api && yarn db:migrate"
echo "3. Configure Azure app registration"
echo "4. Update environment variables"
echo "5. Start the development server: yarn dev"
echo "6. Visit http://localhost:3000/admin/exchange"
