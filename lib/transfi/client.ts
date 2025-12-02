/* eslint-disable @typescript-eslint/no-explicit-any */
// =============================================
// TransFi On-Ramp Client
// Fiat-to-crypto payment integration
// Uses Widget URL approach (no REST API)
// =============================================

import crypto from 'crypto';

// =============================================
// Types
// =============================================

export interface TransFiConfig {
  apiKey: string;
  environment: 'sandbox' | 'production';
  webhookSecret?: string;
}

export interface WidgetUrlParams {
  userId: string;
  email: string;
  walletAddress: string;
  cryptoCurrency?: 'USDC';
  cryptoNetwork?: 'polygon';
  fiatAmount?: string;
  fiatCurrency?: string;
  redirectUrl?: string;
  partnerContext?: Record<string, any>;
}

export interface TransFiSession {
  widgetUrl: string;
  status: 'created';
}

export interface TransFiOrder {
  orderId: string;
  sessionId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  fiatAmount: string;
  fiatCurrency: string;
  cryptoAmount: string;
  cryptoCurrency: string;
  fee: string;
  txHash?: string;
  completedAt?: string;
}

export interface WebhookPayload {
  event: 'order.created' | 'order.processing' | 'order.completed' | 'order.failed' | 'order.cancelled';
  orderId: string;
  sessionId: string;
  data: {
    status: string;
    fiatAmount?: string;
    fiatCurrency?: string;
    cryptoAmount?: string;
    cryptoCurrency?: string;
    fee?: string;
    txHash?: string;
    walletAddress?: string;
    completedAt?: string;
    failureReason?: string;
  };
  timestamp: string;
}

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// =============================================
// TransFi Client
// =============================================

class TransFiClient {
  private config: TransFiConfig | null = null;

  /**
   * Initialize the TransFi client with API Key
   */
  initialize(): void {
    const apiKey = process.env.TRANSFI_API_KEY;
    const environment = (process.env.NEXT_PUBLIC_TRANSFI_ENV as 'sandbox' | 'production') || 'sandbox';
    const webhookSecret = process.env.TRANSFI_WEBHOOK_SECRET;

    if (!apiKey) {
      console.warn('[TransFi] API key not configured (TRANSFI_API_KEY required)');
      return;
    }

    this.config = {
      apiKey,
      environment,
      webhookSecret,
    };

    console.log(`[TransFi] Initialized in ${environment} mode`);
  }

  /**
   * Check if client is configured
   */
  isConfigured(): boolean {
    return this.config !== null;
  }

  /**
   * Get the widget base URL based on environment
   */
  private getWidgetBaseUrl(): string {
    return this.config?.environment === 'production'
      ? 'https://buy.transfi.com'
      : 'https://sandbox-buy.transfi.com';
  }

  /**
   * Create widget URL for the TransFi on-ramp
   * TransFi uses a widget URL approach - no server-side session creation needed
   */
  createWidgetUrl(params: WidgetUrlParams): ServiceResponse<TransFiSession> {
    try {
      if (!this.config) {
        this.initialize();
        if (!this.config) {
          return {
            success: false,
            error: {
              code: 'NOT_CONFIGURED',
              message: 'TransFi client not configured. Set TRANSFI_API_KEY environment variable.',
            },
          };
        }
      }

      const queryParams: Record<string, string> = {
        apiKey: this.config.apiKey,
        walletAddress: params.walletAddress,
        cryptoTicker: params.cryptoCurrency || 'USDC',
        cryptoNetwork: params.cryptoNetwork || 'polygon',
        fiatTicker: params.fiatCurrency || 'USD',
      };

      // Add optional parameters
      if (params.fiatAmount) {
        queryParams.fiatAmount = params.fiatAmount;
      }
      if (params.email) {
        queryParams.email = params.email;
      }
      if (params.redirectUrl) {
        queryParams.redirectUrl = params.redirectUrl;
      }
      if (params.partnerContext) {
        queryParams.partnerContext = JSON.stringify({
          ...params.partnerContext,
          userId: params.userId,
        });
      } else {
        queryParams.partnerContext = JSON.stringify({ userId: params.userId });
      }

      const widgetUrl = `${this.getWidgetBaseUrl()}/?${new URLSearchParams(queryParams).toString()}`;

      console.log(`[TransFi] Widget URL created for wallet: ${params.walletAddress}`);

      return {
        success: true,
        data: {
          widgetUrl,
          status: 'created',
        },
      };
    } catch (error: any) {
      console.error('[TransFi] createWidgetUrl error:', error);
      return {
        success: false,
        error: {
          code: 'URL_CREATION_FAILED',
          message: error.message || 'Failed to create TransFi widget URL',
          details: error,
        },
      };
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config?.webhookSecret) {
      console.warn('[TransFi] Webhook secret not configured');
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.config.webhookSecret)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('[TransFi] Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(body: string): WebhookPayload | null {
    try {
      const payload = JSON.parse(body);
      return {
        event: payload.event,
        orderId: payload.order_id || payload.orderId,
        sessionId: payload.session_id || payload.sessionId,
        data: {
          status: payload.data?.status,
          fiatAmount: payload.data?.fiat_amount || payload.data?.fiatAmount,
          fiatCurrency: payload.data?.fiat_currency || payload.data?.fiatCurrency,
          cryptoAmount: payload.data?.crypto_amount || payload.data?.cryptoAmount,
          cryptoCurrency: payload.data?.crypto_currency || payload.data?.cryptoCurrency,
          fee: payload.data?.fee,
          txHash: payload.data?.tx_hash || payload.data?.txHash,
          walletAddress: payload.data?.wallet_address || payload.data?.walletAddress,
          completedAt: payload.data?.completed_at || payload.data?.completedAt,
          failureReason: payload.data?.failure_reason || payload.data?.failureReason,
        },
        timestamp: payload.timestamp,
      };
    } catch (error) {
      console.error('[TransFi] Failed to parse webhook payload:', error);
      return null;
    }
  }

  /**
   * Get the API key for reference (masked)
   */
  getApiKeyMasked(): string {
    if (!this.config) {
      this.initialize();
    }
    const key = this.config?.apiKey || '';
    if (key.length <= 8) return '****';
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  }
}

// Export singleton instance
export const transfiClient = new TransFiClient();
