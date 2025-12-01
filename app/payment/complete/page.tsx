'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Clock, Loader2, ArrowRight, Home } from 'lucide-react';
import Link from 'next/link';

type PaymentStatus = 'loading' | 'success' | 'pending' | 'failed' | 'error';

interface PaymentDetails {
  intentId?: string;
  status?: string;
  amount?: string;
  txHash?: string;
}

function PaymentCompleteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<PaymentStatus>('loading');
  const [details, setDetails] = useState<PaymentDetails>({});
  const [countdown, setCountdown] = useState(10);

  const intentId = searchParams.get('intentId');
  const orderId = searchParams.get('orderId');
  const statusParam = searchParams.get('status');

  useEffect(() => {
    async function checkPaymentStatus() {
      // If we have a direct status from the URL
      if (statusParam === 'success' || statusParam === 'completed') {
        setStatus('success');
        return;
      }

      if (statusParam === 'failed' || statusParam === 'cancelled') {
        setStatus('failed');
        return;
      }

      // If we have an intentId, fetch the status from our API
      if (intentId) {
        try {
          const response = await fetch(`/api/crypto/payments/check-status?intentId=${intentId}`);
          const data = await response.json();

          if (data.success && data.intent) {
            setDetails({
              intentId: data.intent.id,
              status: data.intent.status,
              amount: data.intent.amount_usdc,
            });

            if (data.intent.status === 'completed') {
              setStatus('success');
            } else if (data.intent.status === 'processing' || data.intent.status === 'awaiting_funds') {
              setStatus('pending');
            } else if (data.intent.status === 'failed' || data.intent.status === 'expired') {
              setStatus('failed');
            } else {
              setStatus('pending');
            }
          } else {
            setStatus('pending');
          }
        } catch (error) {
          console.error('Error checking payment status:', error);
          setStatus('error');
        }
      } else {
        // No intent ID, assume pending
        setStatus('pending');
      }
    }

    checkPaymentStatus();
  }, [intentId, statusParam]);

  // Auto-redirect countdown for success
  useEffect(() => {
    if (status === 'success' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (status === 'success' && countdown === 0) {
      router.push('/dashboard');
    }
  }, [status, countdown, router]);

  const statusConfig = {
    loading: {
      icon: <Loader2 className="h-16 w-16 text-primary animate-spin" />,
      title: 'Checking Payment Status',
      description: 'Please wait while we verify your payment...',
      color: 'text-primary',
    },
    success: {
      icon: <CheckCircle className="h-16 w-16 text-green-500" />,
      title: 'Payment Successful!',
      description: 'Your payment has been confirmed. Your account is now active.',
      color: 'text-green-500',
    },
    pending: {
      icon: <Clock className="h-16 w-16 text-yellow-500" />,
      title: 'Payment Processing',
      description: 'Your payment is being processed. This may take a few minutes.',
      color: 'text-yellow-500',
    },
    failed: {
      icon: <XCircle className="h-16 w-16 text-red-500" />,
      title: 'Payment Failed',
      description: 'There was an issue with your payment. Please try again.',
      color: 'text-red-500',
    },
    error: {
      icon: <XCircle className="h-16 w-16 text-red-500" />,
      title: 'Error',
      description: 'We could not verify your payment status. Please contact support.',
      color: 'text-red-500',
    },
  };

  const config = statusConfig[status];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {config.icon}
          </div>
          <CardTitle className={`text-2xl ${config.color}`}>
            {config.title}
          </CardTitle>
          <CardDescription className="text-base">
            {config.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Payment Details */}
          {details.amount && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">${details.amount} USDC</span>
              </div>
              {details.intentId && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono text-xs">{details.intentId.slice(0, 8)}...</span>
                </div>
              )}
              {orderId && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order ID</span>
                  <span className="font-mono text-xs">{orderId.slice(0, 12)}...</span>
                </div>
              )}
            </div>
          )}

          {/* Actions based on status */}
          {status === 'success' && (
            <div className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                Redirecting to dashboard in {countdown} seconds...
              </p>
              <Button asChild className="w-full" size="lg">
                <Link href="/dashboard">
                  Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}

          {status === 'pending' && (
            <div className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                You can safely close this page. We&apos;ll notify you when your payment is confirmed.
              </p>
              <div className="flex gap-3">
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/payments">
                    Check Status
                  </Link>
                </Button>
                <Button asChild className="flex-1">
                  <Link href="/dashboard">
                    <Home className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {(status === 'failed' || status === 'error') && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/payments">
                    Try Again
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="flex-1">
                  <Link href="/dashboard">
                    Dashboard
                  </Link>
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Need help?{' '}
                <a href="mailto:support@sniperstradingacademy.com" className="text-primary hover:underline">
                  Contact Support
                </a>
              </p>
            </div>
          )}

          {status === 'loading' && (
            <div className="flex justify-center">
              <p className="text-sm text-muted-foreground">
                Please wait...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <PaymentCompleteContent />
    </Suspense>
  );
}
