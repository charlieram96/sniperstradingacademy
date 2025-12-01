/* eslint-disable @typescript-eslint/no-explicit-any */
// =============================================
// TransFi On-Ramp Client
// Fiat-to-crypto payment integration
// Uses MID/Username/Password authentication
// =============================================

import crypto from 'crypto';

// =============================================
// Types
// =============================================

export interface TransFiConfig {
  mid: string;
  username: string;
  password: string;
  environment: 'sandbox' | 'production';
  webhookSecret?: string;
}

export interface CreateSessionParams {
  userId: string;
  email: string;
  walletAddress: string;
  cryptoCurrency: 'USDC';
  cryptoNetwork: 'polygon';
  cryptoAmount: string;
  fiatCurrency?: string;
  redirectUrl?: string;
  webhookUrl?: string;
  metadata?: Record<string, any>;
}

export interface TransFiSession {
  sessionId: string;
  widgetUrl: string;
  expiresAt: string;
  status: 'created' | 'pending' | 'completed' | 'failed' | 'expired';
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
  private baseUrl: string = '';

  /**
   * Initialize the TransFi client with MID/Username/Password
   */
  initialize(): void {
    const mid = process.env.TRANSFI_MID;
    const username = process.env.TRANSFI_USERNAME;
    const password = process.env.TRANSFI_PASSWORD;
    const environment = (process.env.NEXT_PUBLIC_TRANSFI_ENV as 'sandbox' | 'production') || 'sandbox';
    const webhookSecret = process.env.TRANSFI_WEBHOOK_SECRET;

    if (!mid || !username || !password) {
      console.warn('[TransFi] API credentials not configured (MID, Username, Password required)');
      return;
    }

    this.config = {
      mid,
      username,
      password,
      environment,
      webhookSecret,
    };

    this.baseUrl = environment === 'production'
      ? 'https://api.transfi.com/v1'
      : 'https://sandbox-api.transfi.com/v1';

    console.log(`[TransFi] Initialized in ${environment} mode with MID: ${mid}`);
  }

  /**
   * Get Basic Auth header value
   */
  private getAuthHeader(): string {
    if (!this.config) return '';
    const credentials = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
    return `Basic ${credentials}`;
  }

  /**
   * Get common headers for API requests
   */
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': this.getAuthHeader(),
      'X-MID': this.config?.mid || '',
    };
  }

  /**
   * Check if client is configured
   */
  isConfigured(): boolean {
    return this.config !== null;
  }

  /**
   * Create an on-ramp session for the TransFi widget
   */
  async createSession(params: CreateSessionParams): Promise<ServiceResponse<TransFiSession>> {
    try {
      if (!this.config) {
        this.initialize();
        if (!this.config) {
          return {
            success: false,
            error: {
              code: 'NOT_CONFIGURED',
              message: 'TransFi client not configured. Set TRANSFI_MID, TRANSFI_USERNAME, and TRANSFI_PASSWORD.',
            },
          };
        }
      }

      const response = await fetch(`${this.baseUrl}/sessions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          external_user_id: params.userId,
          email: params.email,
          wallet_address: params.walletAddress,
          crypto_currency: params.cryptoCurrency,
          crypto_network: params.cryptoNetwork,
          crypto_amount: params.cryptoAmount,
          fiat_currency: params.fiatCurrency || 'USD',
          redirect_url: params.redirectUrl,
          webhook_url: params.webhookUrl,
          metadata: params.metadata,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[TransFi] Session creation failed:', errorData);
        return {
          success: false,
          error: {
            code: 'SESSION_CREATION_FAILED',
            message: errorData.message || `Failed to create session: ${response.status}`,
            details: errorData,
          },
        };
      }

      const data = await response.json();

      return {
        success: true,
        data: {
          sessionId: data.session_id || data.sessionId,
          widgetUrl: data.widget_url || data.widgetUrl,
          expiresAt: data.expires_at || data.expiresAt,
          status: 'created',
        },
      };
    } catch (error: any) {
      console.error('[TransFi] createSession error:', error);
      return {
        success: false,
        error: {
          code: 'REQUEST_FAILED',
          message: error.message || 'Failed to create TransFi session',
          details: error,
        },
      };
    }
  }

  /**
   * Get session status
   */
  async getSessionStatus(sessionId: string): Promise<ServiceResponse<TransFiSession>> {
    try {
      if (!this.config) {
        this.initialize();
        if (!this.config) {
          return {
            success: false,
            error: {
              code: 'NOT_CONFIGURED',
              message: 'TransFi client not configured',
            },
          };
        }
      }

      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: errorData.message || 'Session not found',
            details: errorData,
          },
        };
      }

      const data = await response.json();

      return {
        success: true,
        data: {
          sessionId: data.session_id || data.sessionId,
          widgetUrl: data.widget_url || data.widgetUrl,
          expiresAt: data.expires_at || data.expiresAt,
          status: data.status,
        },
      };
    } catch (error: any) {
      console.error('[TransFi] getSessionStatus error:', error);
      return {
        success: false,
        error: {
          code: 'REQUEST_FAILED',
          message: error.message || 'Failed to get session status',
          details: error,
        },
      };
    }
  }

  /**
   * Get order details
   */
  async getOrder(orderId: string): Promise<ServiceResponse<TransFiOrder>> {
    try {
      if (!this.config) {
        this.initialize();
        if (!this.config) {
          return {
            success: false,
            error: {
              code: 'NOT_CONFIGURED',
              message: 'TransFi client not configured',
            },
          };
        }
      }

      const response = await fetch(`${this.baseUrl}/orders/${orderId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: {
            code: 'ORDER_NOT_FOUND',
            message: errorData.message || 'Order not found',
            details: errorData,
          },
        };
      }

      const data = await response.json();

      return {
        success: true,
        data: {
          orderId: data.order_id || data.orderId,
          sessionId: data.session_id || data.sessionId,
          status: data.status,
          fiatAmount: data.fiat_amount || data.fiatAmount,
          fiatCurrency: data.fiat_currency || data.fiatCurrency,
          cryptoAmount: data.crypto_amount || data.cryptoAmount,
          cryptoCurrency: data.crypto_currency || data.cryptoCurrency,
          fee: data.fee,
          txHash: data.tx_hash || data.txHash,
          completedAt: data.completed_at || data.completedAt,
        },
      };
    } catch (error: any) {
      console.error('[TransFi] getOrder error:', error);
      return {
        success: false,
        error: {
          code: 'REQUEST_FAILED',
          message: error.message || 'Failed to get order',
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
   * Get widget URL for embedding
   * This constructs the widget URL with necessary parameters
   */
  getWidgetUrl(params: {
    sessionId?: string;
    walletAddress: string;
    cryptoAmount: string;
    cryptoCurrency?: string;
    network?: string;
    fiatCurrency?: string;
    email?: string;
  }): string {
    if (!this.config) {
      this.initialize();
    }

    const baseWidgetUrl = this.config?.environment === 'production'
      ? 'https://widget.transfi.com'
      : 'https://sandbox-widget.transfi.com';

    const queryParams = new URLSearchParams({
      mid: this.config?.mid || '',
      walletAddress: params.walletAddress,
      cryptoAmount: params.cryptoAmount,
      cryptoCurrency: params.cryptoCurrency || 'USDC',
      network: params.network || 'polygon',
      fiatCurrency: params.fiatCurrency || 'USD',
      ...(params.sessionId && { sessionId: params.sessionId }),
      ...(params.email && { email: params.email }),
    });

    return `${baseWidgetUrl}?${queryParams.toString()}`;
  }

  /**
   * Get the MID for client-side use
   */
  getMID(): string {
    if (!this.config) {
      this.initialize();
    }
    return this.config?.mid || '';
  }
}

// Export singleton instance
export const transfiClient = new TransFiClient();
