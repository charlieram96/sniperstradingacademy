'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SkeletonRows } from '@/components/patterns/skeleton';
import { EmptyState } from '@/components/patterns/empty-state';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  History,
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
    const statusConfig: Record<string, { variant: 'success' | 'warning' | 'destructive' | 'outline', label: string }> = {
      completed: { variant: 'success', label: 'Completed' },
      succeeded: { variant: 'success', label: 'Completed' },
      confirmed: { variant: 'success', label: 'Confirmed' },
      paid: { variant: 'success', label: 'Paid' },
      pending: { variant: 'warning', label: 'Pending' },
      processing: { variant: 'warning', label: 'Processing' },
      failed: { variant: 'destructive', label: 'Failed' },
      cancelled: { variant: 'outline', label: 'Cancelled' },
    };

    const config = statusConfig[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTransactionIcon = (direction: 'in' | 'out') => {
    if (direction === 'out') {
      return (
        <div className="w-10 h-10 rounded-full bg-red-dim flex items-center justify-center">
          <ArrowUpRight className="h-5 w-5 text-red" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-full bg-emerald-dim flex items-center justify-center">
        <ArrowDownLeft className="h-5 w-5 text-emerald" />
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
        <CardContent className="py-4">
          <SkeletonRows n={5} />
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
          <EmptyState
            icon={<History />}
            title="No transactions yet"
            description="Your payments, commissions and payouts will appear here once activity begins."
          />
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
                      className="flex items-start gap-3 p-3 rounded-lg border border-border-subtle bg-surface-1 hover:bg-surface-2 transition-colors"
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
                          className={`font-mono tabular-nums font-semibold ${
                            tx.direction === 'out' ? 'text-red' : 'text-emerald'
                          }`}
                        >
                          {tx.direction === 'out' ? '-' : '+'}${formatAmount(tx.amount)}
                        </p>
                        <p className="font-mono text-xs text-foreground-tertiary">USDC</p>
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
