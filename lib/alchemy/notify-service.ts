/**
 * Alchemy Notify Service
 * Manages webhook address registration with Alchemy
 * Adds user deposit addresses to the webhook for real-time monitoring
 */

const ALCHEMY_NOTIFY_API = 'https://dashboard.alchemyapi.io/api/update-webhook-addresses';

interface AlchemyNotifyResponse {
  data?: {
    id: string;
    addresses: string[];
  };
  error?: string;
}

/**
 * Get Alchemy auth token from environment
 */
function getAlchemyAuthToken(): string | null {
  return process.env.ALCHEMY_AUTH_TOKEN || process.env.ALCHEMY_NOTIFY_TOKEN || null;
}

/**
 * Get Alchemy webhook ID from environment
 */
function getAlchemyWebhookId(): string | null {
  return process.env.ALCHEMY_WEBHOOK_ID || null;
}

/**
 * Check if Alchemy Notify is configured
 */
export function isAlchemyNotifyConfigured(): boolean {
  return !!(getAlchemyAuthToken() && getAlchemyWebhookId());
}

/**
 * Add a deposit address to the Alchemy webhook for monitoring
 * This enables real-time notifications when USDC is sent to the address
 */
export async function registerAddressWithAlchemy(
  address: string
): Promise<{ success: boolean; error?: string }> {
  const authToken = getAlchemyAuthToken();
  const webhookId = getAlchemyWebhookId();

  if (!authToken) {
    console.warn('[AlchemyNotify] No auth token configured (ALCHEMY_AUTH_TOKEN)');
    return { success: false, error: 'Alchemy auth token not configured' };
  }

  if (!webhookId) {
    console.warn('[AlchemyNotify] No webhook ID configured (ALCHEMY_WEBHOOK_ID)');
    return { success: false, error: 'Alchemy webhook ID not configured' };
  }

  try {
    console.log(`[AlchemyNotify] Registering address ${address} with webhook ${webhookId}`);

    const response = await fetch(ALCHEMY_NOTIFY_API, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Alchemy-Token': authToken,
      },
      body: JSON.stringify({
        webhook_id: webhookId,
        addresses_to_add: [address.toLowerCase()],
        addresses_to_remove: [],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AlchemyNotify] API error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `Alchemy API error: ${response.status}`
      };
    }

    const data: AlchemyNotifyResponse = await response.json();

    if (data.error) {
      console.error('[AlchemyNotify] API returned error:', data.error);
      return { success: false, error: data.error };
    }

    console.log(`[AlchemyNotify] Successfully registered address ${address}`);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AlchemyNotify] Failed to register address:', error);
    return { success: false, error: errorMsg };
  }
}

/**
 * Add multiple addresses to the Alchemy webhook
 * Useful for bulk registration of existing addresses
 */
export async function registerMultipleAddressesWithAlchemy(
  addresses: string[]
): Promise<{ success: boolean; registered: number; failed: number; error?: string }> {
  const authToken = getAlchemyAuthToken();
  const webhookId = getAlchemyWebhookId();

  if (!authToken || !webhookId) {
    return {
      success: false,
      registered: 0,
      failed: addresses.length,
      error: 'Alchemy not configured'
    };
  }

  if (addresses.length === 0) {
    return { success: true, registered: 0, failed: 0 };
  }

  try {
    console.log(`[AlchemyNotify] Bulk registering ${addresses.length} addresses`);

    // Alchemy accepts bulk addresses in a single request
    const response = await fetch(ALCHEMY_NOTIFY_API, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Alchemy-Token': authToken,
      },
      body: JSON.stringify({
        webhook_id: webhookId,
        addresses_to_add: addresses.map(a => a.toLowerCase()),
        addresses_to_remove: [],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AlchemyNotify] Bulk API error: ${response.status} - ${errorText}`);
      return {
        success: false,
        registered: 0,
        failed: addresses.length,
        error: `Alchemy API error: ${response.status}`
      };
    }

    console.log(`[AlchemyNotify] Successfully registered ${addresses.length} addresses`);
    return { success: true, registered: addresses.length, failed: 0 };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AlchemyNotify] Bulk registration failed:', error);
    return {
      success: false,
      registered: 0,
      failed: addresses.length,
      error: errorMsg
    };
  }
}

/**
 * Remove an address from the Alchemy webhook
 * Rarely needed, but available if needed
 */
export async function removeAddressFromAlchemy(
  address: string
): Promise<{ success: boolean; error?: string }> {
  const authToken = getAlchemyAuthToken();
  const webhookId = getAlchemyWebhookId();

  if (!authToken || !webhookId) {
    return { success: false, error: 'Alchemy not configured' };
  }

  try {
    const response = await fetch(ALCHEMY_NOTIFY_API, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Alchemy-Token': authToken,
      },
      body: JSON.stringify({
        webhook_id: webhookId,
        addresses_to_add: [],
        addresses_to_remove: [address.toLowerCase()],
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Alchemy API error: ${response.status}` };
    }

    console.log(`[AlchemyNotify] Removed address ${address} from webhook`);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMsg };
  }
}
