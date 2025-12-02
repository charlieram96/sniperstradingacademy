'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ExternalLink,
  Loader2,
  Wallet,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface WithdrawalModalProps {
  open: boolean;
  onClose: () => void;
  balance: string;
  onSuccess?: () => void;
}

interface WithdrawalLimits {
  minAmount: number;
  maxPerTransaction: number;
  maxDaily: number;
  usedToday: number;
  remainingDaily: number;
}

export function WithdrawalModal({
  open,
  onClose,
  balance,
  onSuccess,
}: WithdrawalModalProps) {
  const [step, setStep] = useState<'form' | 'confirm' | 'processing' | 'success' | 'error'>('form');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [limits, setLimits] = useState<WithdrawalLimits | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchLimits();
      // Reset state when modal opens
      setStep('form');
      setAmount('');
      setAddress('');
      setError(null);
      setTxHash(null);
    }
  }, [open]);

  const fetchLimits = async () => {
    try {
      const response = await fetch('/api/crypto/withdrawals');
      const data = await response.json();

      if (data.success && data.limits) {
        setLimits(data.limits);
      }
    } catch (err) {
      console.error('Failed to fetch limits:', err);
    }
  };

  const validateAddress = (addr: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
  };

  const validateAmount = () => {
    const numAmount = parseFloat(amount);
    const numBalance = parseFloat(balance);

    if (isNaN(numAmount) || numAmount <= 0) {
      return 'Please enter a valid amount';
    }

    if (limits) {
      if (numAmount < limits.minAmount) {
        return `Minimum withdrawal is $${limits.minAmount}`;
      }
      if (numAmount > limits.maxPerTransaction) {
        return `Maximum per transaction is $${limits.maxPerTransaction.toLocaleString()}`;
      }
      if (numAmount > limits.remainingDaily) {
        return `Daily limit remaining: $${limits.remainingDaily.toLocaleString()}`;
      }
    }

    if (numAmount > numBalance) {
      return 'Insufficient balance';
    }

    return null;
  };

  const handleSubmit = () => {
    setError(null);

    if (!validateAddress(address)) {
      setError('Please enter a valid Polygon wallet address');
      return;
    }

    const amountError = validateAmount();
    if (amountError) {
      setError(amountError);
      return;
    }

    setStep('confirm');
  };

  const handleConfirm = async () => {
    setStep('processing');
    setError(null);

    try {
      const response = await fetch('/api/crypto/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          toAddress: address,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Withdrawal failed');
      }

      setTxHash(data.transaction?.txHash || data.transaction?.polygon_tx_hash);
      setStep('success');

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Withdrawal error:', err);
      setError(err instanceof Error ? err.message : 'Withdrawal failed');
      setStep('error');
    }
  };

  const handleClose = () => {
    setStep('form');
    setAmount('');
    setAddress('');
    setError(null);
    setTxHash(null);
    onClose();
  };

  const setMaxAmount = () => {
    const numBalance = parseFloat(balance);
    const maxAllowed = limits
      ? Math.min(numBalance, limits.maxPerTransaction, limits.remainingDaily)
      : numBalance;
    setAmount(maxAllowed.toFixed(2));
  };

  const getExplorerUrl = (hash: string) => {
    return `https://polygonscan.com/tx/${hash}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {step === 'success' ? 'Withdrawal Successful' : 'Withdraw USDC'}
          </DialogTitle>
          {step === 'form' && (
            <DialogDescription>
              Withdraw USDC to an external Polygon wallet
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Form Step */}
        {step === 'form' && (
          <div className="space-y-4 py-4">
            {/* Balance Display */}
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="text-xl font-bold">${parseFloat(balance).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC</p>
            </div>

            {/* Limits Info */}
            {limits && (
              <div className="text-xs text-muted-foreground space-y-1 bg-muted/30 rounded-lg p-3">
                <p>Min: ${limits.minAmount} | Max per tx: ${limits.maxPerTransaction.toLocaleString()}</p>
                <p>Daily limit: ${limits.maxDaily.toLocaleString()} | Remaining: ${limits.remainingDaily.toLocaleString()}</p>
              </div>
            )}

            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USDC)</Label>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pr-16"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs"
                  onClick={setMaxAmount}
                >
                  MAX
                </Button>
              </div>
            </div>

            {/* Address Input */}
            <div className="space-y-2">
              <Label htmlFor="address">Destination Address</Label>
              <Input
                id="address"
                type="text"
                placeholder="0x..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Enter a Polygon network wallet address
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={!amount || !address}
            >
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Confirm Step */}
        {step === 'confirm' && (
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold">${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">To</span>
                <span className="font-mono text-sm">{address.slice(0, 10)}...{address.slice(-8)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network</span>
                <Badge variant="secondary">Polygon</Badge>
              </div>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Please verify the address is correct. Transactions cannot be reversed.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep('form')}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirm}
              >
                Confirm Withdrawal
              </Button>
            </div>
          </div>
        )}

        {/* Processing Step */}
        {step === 'processing' && (
          <div className="py-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="font-medium">Processing withdrawal...</p>
            <p className="text-sm text-muted-foreground mt-2">
              This may take a moment
            </p>
          </div>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <div className="py-6 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <p className="font-medium text-lg mb-2">Withdrawal Submitted</p>
            <p className="text-muted-foreground mb-4">
              ${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC is being sent to your wallet
            </p>
            {txHash && (
              <a
                href={getExplorerUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
              >
                View on Polygonscan
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <Button className="w-full mt-6" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}

        {/* Error Step */}
        {step === 'error' && (
          <div className="py-6 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <p className="font-medium text-lg mb-2">Withdrawal Failed</p>
            <p className="text-muted-foreground mb-4">{error}</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={() => setStep('form')}>
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
