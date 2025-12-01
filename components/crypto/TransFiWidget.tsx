'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CreditCard, Loader2, ExternalLink, AlertCircle, CheckCircle } from 'lucide-react';

interface TransFiWidgetProps {
  walletAddress: string;
  amount: string;
  intentId: string;
  email?: string;
  onSuccess?: (data: { orderId: string; txHash?: string }) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
}

type WidgetStatus = 'idle' | 'loading' | 'ready' | 'processing' | 'completed' | 'error';

export function TransFiWidget({
  walletAddress,
  amount,
  intentId,
  email,
  onSuccess,
  onError,
  onClose,
}: TransFiWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<WidgetStatus>('idle');
  const [widgetUrl, setWidgetUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create on-ramp session when dialog opens
  const createSession = useCallback(async () => {
    setStatus('loading');
    setError(null);

    try {
      const response = await fetch('/api/crypto/on-ramp/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          amount,
          intentId,
          email,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create session');
      }

      setWidgetUrl(data.widgetUrl);
      setSessionId(data.sessionId);
      setStatus('ready');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initialize payment';
      setError(message);
      setStatus('error');
      onError?.(message);
    }
  }, [walletAddress, amount, intentId, email, onError]);

  useEffect(() => {
    if (isOpen && status === 'idle') {
      createSession();
    }
  }, [isOpen, status, createSession]);

  // Listen for postMessage events from the widget iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin for security
      if (!event.origin.includes('transfi.com')) {
        return;
      }

      const { type, data } = event.data || {};

      switch (type) {
        case 'TRANSFI_ORDER_CREATED':
          setStatus('processing');
          break;

        case 'TRANSFI_ORDER_COMPLETED':
          setStatus('completed');
          onSuccess?.({
            orderId: data?.orderId,
            txHash: data?.txHash,
          });
          // Close dialog after success
          setTimeout(() => {
            setIsOpen(false);
            onClose?.();
          }, 2000);
          break;

        case 'TRANSFI_ORDER_FAILED':
          setError(data?.message || 'Payment failed');
          setStatus('error');
          onError?.(data?.message || 'Payment failed');
          break;

        case 'TRANSFI_WIDGET_CLOSED':
          setIsOpen(false);
          onClose?.();
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSuccess, onError, onClose]);

  // Reset state when dialog closes
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setStatus('idle');
      setWidgetUrl(null);
      setSessionId(null);
      setError(null);
      onClose?.();
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        size="lg"
      >
        <CreditCard className="mr-2 h-5 w-5" />
        Pay with Card
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[500px] md:max-w-[600px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Pay with Credit Card
            </DialogTitle>
            <DialogDescription>
              Complete your ${amount} USDC payment securely with TransFi
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-[400px] flex flex-col">
            {/* Loading State */}
            {status === 'loading' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Initializing payment...</p>
              </div>
            )}

            {/* Error State */}
            {status === 'error' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <div className="text-center">
                  <p className="font-semibold text-destructive">Payment Error</p>
                  <p className="text-sm text-muted-foreground mt-1">{error}</p>
                </div>
                <Button onClick={createSession} variant="outline">
                  Try Again
                </Button>
              </div>
            )}

            {/* Completed State */}
            {status === 'completed' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
                <CheckCircle className="h-12 w-12 text-green-500" />
                <div className="text-center">
                  <p className="font-semibold text-green-500">Payment Successful!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your USDC is being sent to your wallet
                  </p>
                </div>
              </div>
            )}

            {/* Widget Iframe */}
            {status === 'ready' && widgetUrl && (
              <div className="flex-1 relative">
                <iframe
                  src={widgetUrl}
                  title="TransFi Payment Widget"
                  className="w-full h-[500px] border-0 rounded-lg"
                  allow="camera; microphone; payment"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                />
              </div>
            )}

            {/* Processing State */}
            {status === 'processing' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Processing your payment...</p>
                <p className="text-xs text-muted-foreground">
                  This may take a few minutes
                </p>
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-4">
            <div className="flex items-center gap-1">
              <span>Powered by</span>
              <a
                href="https://transfi.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                TransFi <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {sessionId && (
              <span className="text-xs opacity-50">
                Session: {sessionId.slice(0, 8)}...
              </span>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Alternative button-only component that uses window.open instead of iframe
export function TransFiPayButton({
  walletAddress,
  amount,
  intentId,
  email,
  className,
}: TransFiWidgetProps & { className?: string }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/crypto/on-ramp/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          amount,
          intentId,
          email,
          useRedirect: true,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create session');
      }

      // Open widget in new window
      window.open(
        data.widgetUrl,
        'TransFi',
        'width=500,height=700,scrollbars=yes,resizable=yes'
      );
    } catch (err) {
      console.error('TransFi error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isLoading}
      className={className}
      variant="outline"
      size="lg"
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <CreditCard className="mr-2 h-4 w-4" />
      )}
      Pay with Card
    </Button>
  );
}
