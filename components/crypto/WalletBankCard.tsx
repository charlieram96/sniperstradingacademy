'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Wallet,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ArrowUpRight,
  ArrowDownLeft,
  Loader2,
  QrCode,
  Info,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import QRCode from 'qrcode';

interface WalletData {
  id: string;
  address: string;
  network: string;
  status: string;
  createdAt: string;
  isExported?: boolean;
}

interface BalanceData {
  usdc: string;
  matic: string;
  lastUpdated?: Date;
  error?: string;
}

interface RecentTransaction {
  id: string;
  transaction_type: string;
  amount: string;
  status: string;
  created_at: string;
  polygon_tx_hash?: string;
}

interface WalletBankCardProps {
  onWithdraw?: () => void;
  onBalanceChange?: (balance: string) => void;
}

export function WalletBankCard({ onWithdraw, onBalanceChange }: WalletBankCardProps) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWalletData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await fetch('/api/crypto/wallet/balance');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch wallet data');
      }

      setWallet(data.wallet);
      setBalance(data.balance);
      setRecentTransactions(data.recentTransactions || []);

      // Notify parent of balance change
      if (onBalanceChange && data.balance?.usdc) {
        onBalanceChange(data.balance.usdc);
      }

      // Generate QR code for wallet address
      if (data.wallet?.address) {
        const qr = await QRCode.toDataURL(data.wallet.address, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
        setQrCodeUrl(qr);
      }
    } catch (err) {
      console.error('Failed to fetch wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to load wallet');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onBalanceChange]);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  const copyAddress = async () => {
    if (wallet?.address) {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getExplorerUrl = (txHash: string) => {
    const baseUrl = wallet?.network === 'polygon'
      ? 'https://polygonscan.com/tx/'
      : 'https://amoy.polygonscan.com/tx/';
    return `${baseUrl}${txHash}`;
  };

  const getTransactionIcon = (type: string) => {
    if (type === 'withdrawal' || type === 'payment_in') {
      return <ArrowUpRight className="h-4 w-4 text-red-500" />;
    }
    return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
  };

  const getTransactionLabel = (type: string) => {
    const labels: Record<string, string> = {
      withdrawal: 'Withdrawal',
      payout: 'Commission',
      payment_in: 'Payment',
      deposit: 'Deposit',
      on_ramp: 'Card Purchase',
    };
    return labels[type] || type;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
            <p className="text-muted-foreground">Setting up your wallet...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="py-8 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => fetchWalletData()} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Your Wallet
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchWalletData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Balance Display */}
        <div className="bg-background/50 rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">${formatAmount(balance?.usdc || '0')}</span>
            <span className="text-muted-foreground">USDC</span>
          </div>
          {balance?.error && (
            <p className="text-xs text-amber-500 mt-1">{balance.error}</p>
          )}
        </div>

        {/* Wallet Address */}
        <div className="flex items-center justify-between bg-background/50 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 w-10 p-0">
                  <QrCode className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Deposit Address</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4 py-4">
                  {qrCodeUrl && (
                    <img src={qrCodeUrl} alt="Wallet QR Code" className="rounded-lg" />
                  )}
                  <div className="text-center">
                    <p className="font-mono text-sm break-all">{wallet?.address}</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Send USDC on <Badge variant="secondary">Polygon</Badge> network only
                    </p>
                  </div>
                  <Button onClick={copyAddress} variant="outline" className="w-full">
                    {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copied ? 'Copied!' : 'Copy Address'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <div>
              <p className="text-xs text-muted-foreground">Wallet Address</p>
              <p className="font-mono text-sm">{wallet && truncateAddress(wallet.address)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              Polygon
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyAddress}
                    className="h-8 w-8 p-0"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {copied ? 'Copied!' : 'Copy address'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Deposit Info */}
        <div className="flex items-start gap-2 text-sm text-muted-foreground bg-blue-500/10 rounded-lg p-3">
          <Info className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
          <p>
            Deposit USDC on <strong>Polygon network</strong> to this address.
            Other tokens or networks will result in permanent loss.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={() => setShowQrDialog(true)}
          >
            <ArrowDownLeft className="h-4 w-4 mr-2" />
            Deposit
          </Button>
          <Button
            onClick={onWithdraw}
            disabled={parseFloat(balance?.usdc || '0') < 10}
          >
            <ArrowUpRight className="h-4 w-4 mr-2" />
            Withdraw
          </Button>
        </div>

        {/* Recent Activity */}
        {recentTransactions.length > 0 && (
          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-medium mb-3">Recent Activity</h4>
            <div className="space-y-2">
              {recentTransactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between text-sm py-2 border-b border-border/50 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    {getTransactionIcon(tx.transaction_type)}
                    <div>
                      <p className="font-medium">{getTransactionLabel(tx.transaction_type)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(tx.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${
                      tx.transaction_type === 'withdrawal' || tx.transaction_type === 'payment_in'
                        ? 'text-red-500'
                        : 'text-green-500'
                    }`}>
                      {tx.transaction_type === 'withdrawal' || tx.transaction_type === 'payment_in' ? '-' : '+'}
                      ${formatAmount(tx.amount)}
                    </p>
                    {tx.polygon_tx_hash && (
                      <a
                        href={getExplorerUrl(tx.polygon_tx_hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
