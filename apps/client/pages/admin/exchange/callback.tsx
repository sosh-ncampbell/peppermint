import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { AdminLayout } from '../../../layouts/adminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/shadcn/ui/card';
import { Button } from '@/shadcn/ui/button';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';

export default function ExchangeOAuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      const { code, state, error } = router.query;

      if (error) {
        setStatus('error');
        setMessage(`Authentication failed: ${error}`);
        return;
      }

      if (!code || !state) {
        setStatus('error');
        setMessage('Missing required authentication parameters');
        return;
      }

      try {
        const response = await fetch(`/api/v1/exchange/oauth/callback?code=${code}&state=${state}`, {
          credentials: 'include',
        });

        if (response.ok) {
          setStatus('success');
          setMessage('Exchange connection authenticated successfully!');
          
          // Redirect to Exchange management page after 3 seconds
          setTimeout(() => {
            router.push('/admin/exchange');
          }, 3000);
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Authentication failed');
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Authentication failed');
      }
    };

    if (router.isReady) {
      handleCallback();
    }
  }, [router]);

  const handleReturnToManagement = () => {
    router.push('/admin/exchange');
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center space-x-2">
              {status === 'loading' && <RefreshCw className="h-6 w-6 animate-spin" />}
              {status === 'success' && <CheckCircle className="h-6 w-6 text-green-600" />}
              {status === 'error' && <XCircle className="h-6 w-6 text-red-600" />}
              <span>
                {status === 'loading' && 'Processing...'}
                {status === 'success' && 'Success!'}
                {status === 'error' && 'Error'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">{message}</p>
            
            {status === 'success' && (
              <p className="text-sm text-muted-foreground">
                Redirecting to Exchange management in 3 seconds...
              </p>
            )}
            
            {status !== 'loading' && (
              <Button onClick={handleReturnToManagement} className="w-full">
                Return to Exchange Management
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

ExchangeOAuthCallback.getLayout = (page: React.ReactElement) => page;
