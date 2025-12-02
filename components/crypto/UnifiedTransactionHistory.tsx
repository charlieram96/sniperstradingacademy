'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  History,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface Transaction {
  id: string;
  type: 'payment' | 'commission' | 'withdrawal' | 'payout' | 'deposit';
  direction: 'in' | 'out';
  amount: string;
  status: string;
  date: string;
  description: string;
  metadata?: {
    txHash?: string;
    referredName?: string;
    paymentType?: string;
    toAddress?: string;
    fromAddress?: string;
  };
}

interface UnifiedTransactionHistoryProps {
  limit?: number;
  showFilters?: boolean;
  showTitle?: boolean;
}

export function UnifiedTransactionHistory({
  limit = 50,
  showFilters = true,
  showTitle = true,
}: UnifiedTransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'payments' | 'commissions' | 'withdrawals'>('all');
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await fetch(`/api/user/transactions?filter=${filter}&limit=${limit}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch transactions');
      }

      setTransactions(data.transactions);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, limit]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const formatAmount = (amount: string) => {
    const num = parseFloat(amount);
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      completed: { variant: 'default', label: 'Completed' },
      succeeded: { variant: 'default', label: 'Completed' },
      confirmed: { variant: 'default', label: 'Confirmed' },
      paid: { variant: 'default', label: 'Paid' },
      pending: { variant: 'secondary', label: 'Pending' },
      processing: { variant: 'secondary', label: 'Processing' },
      failed: { variant: 'destructive', label: 'Failed' },
      cancelled: { variant: 'outline', label: 'Cancelled' },
    };

    const config = statusConfig[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTransactionIcon = (direction: 'in' | 'out') => {
    if (direction === 'out') {
      return (
        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <ArrowUpRight className="h-5 w-5 text-red-500" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
        <ArrowDownLeft className="h-5 w-5 text-green-500" />
      </div>
    );
  };

  const getExplorerUrl = (txHash: string) => {
    return `https://polygonscan.com/tx/${txHash}`;
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Group transactions by date
  const groupedTransactions = transactions.reduce((groups, tx) => {
    const date = formatDate(tx.date);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(tx);
    return groups;
  }, {} as Record<string, Transaction[]>);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {showTitle && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Transaction History
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchTransactions(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
      )}
      <CardContent>
        {/* Filters */}
        {showFilters && (
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="commissions">Commissions</TabsTrigger>
              <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-8">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => fetchTransactions()} variant="outline">
              Try Again
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!error && transactions.length === 0 && (
          <div className="text-center py-12">
            <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">No transactions yet</p>
          </div>
        )}

        {/* Grouped Transaction List */}
        {!error && Object.keys(groupedTransactions).length > 0 && (
          <div className="space-y-6">
            {Object.entries(groupedTransactions).map(([date, txs]) => (
              <div key={date}>
                <p className="text-sm font-medium text-muted-foreground mb-3">{date}</p>
                <div className="space-y-3">
                  {txs.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      {getTransactionIcon(tx.direction)}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{tx.description}</span>
                          {getStatusBadge(tx.status)}
                        </div>

                        <div className="text-sm text-muted-foreground">
                          {tx.metadata?.referredName && (
                            <span>From {tx.metadata.referredName} &bull; </span>
                          )}
                          {tx.metadata?.toAddress && (
                            <span>To {truncateAddress(tx.metadata.toAddress)} &bull; </span>
                          )}
                          <span>{formatTime(tx.date)}</span>
                        </div>

                        {tx.metadata?.txHash && (
                          <a
                            href={getExplorerUrl(tx.metadata.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                          >
                            View on Explorer
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>

                      <div className="text-right">
                        <p
                          className={`font-semibold ${
                            tx.direction === 'out' ? 'text-red-500' : 'text-green-500'
                          }`}
                        >
                          {tx.direction === 'out' ? '-' : '+'}${formatAmount(tx.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">USDC</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
