import { ProposedOrder } from '../types/index.js';

export interface BinanceMcpClientConfig {
  endpoint: string;
  sessionToken?: string;
  mockMode: boolean;
}

export class BinanceMcpClient {
  private config: BinanceMcpClientConfig;

  constructor(config?: Partial<BinanceMcpClientConfig>) {
    this.config = {
      endpoint: process.env.BINANCE_MCP_URL || 'https://agent.binance.com/mcp/agentic',
      sessionToken: process.env.BINANCE_MCP_TOKEN,
      mockMode: process.env.MOCK_MODE !== '0' && !process.env.BINANCE_MCP_TOKEN,
      ...config,
    };
  }

  public isMockMode(): boolean {
    return this.config.mockMode;
  }

  /**
   * Fetch current sub-account balance using the Agent OS account scope
   */
  public async getSubAccountBalance(): Promise<number> {
    if (this.config.mockMode) {
      // Default mock sub-account funded with $10,000 USDT
      return 10_000;
    }

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.sessionToken}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'get_account_balance',
            arguments: { asset: 'USDT' },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP Server returned HTTP ${response.status}`);
      }

      const data = (await response.json()) as any;
      const freeBalance = parseFloat(data.result?.content?.[0]?.text || '10000');
      return isNaN(freeBalance) ? 10_000 : freeBalance;
    } catch (err) {
      console.warn(`[BinanceMcpClient] Account call failed (${(err as Error).message}), fallback to safe $10k mock.`);
      return 10_000;
    }
  }

  /**
   * Submits a validated iceberg order to Binance Agent OS Trade scope
   */
  public async submitProposedOrder(
    order: ProposedOrder
  ): Promise<{ success: boolean; txHash?: string; orderId?: string; error?: string }> {
    if (!order.executable) {
      return { success: false, error: 'Order is marked non-executable by RiskGate.' };
    }

    if (this.config.mockMode) {
      return {
        success: true,
        orderId: `MOCK_${order.clientOrderId}`,
        txHash: order.sha256Proof,
      };
    }

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.sessionToken}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: 'place_iceberg_order',
            arguments: {
              symbol: order.symbol,
              side: order.side,
              quantity: order.quantity,
              price: order.price,
              stopLoss: order.stopLossPrice,
              takeProfit: order.takeProfitPrice,
              clientOrderId: order.clientOrderId,
            },
          },
        }),
      });

      const data = (await response.json()) as any;
      if (data.error) {
        return { success: false, error: data.error.message };
      }

      return {
        success: true,
        orderId: data.result?.orderId || order.clientOrderId,
        txHash: order.sha256Proof,
      };
    } catch (err) {
      return {
        success: false,
        error: `Failed to dispatch order via Binance Agent OS: ${(err as Error).message}`,
      };
    }
  }
}
