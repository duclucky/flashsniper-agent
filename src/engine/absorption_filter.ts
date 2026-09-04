import { OrderBookDepth, AbsorptionMetrics } from '../types/index.js';

export class AbsorptionFilter {
  private minImbalanceThreshold: number;

  constructor(minImbalanceThreshold: number = 0.25) {
    this.minImbalanceThreshold = minImbalanceThreshold;
  }

  /**
   * Computes Orderbook Imbalance (OIB) and verifies absorption across top 5 depth levels
   */
  public evaluate(
    depth: OrderBookDepth,
    isLiquidationDecelerating: boolean
  ): AbsorptionMetrics {
    const topBids = depth.bids.slice(0, 5);
    const topAsks = depth.asks.slice(0, 5);

    const bidVol = topBids.reduce((sum, level) => sum + level.quantity, 0);
    const askVol = topAsks.reduce((sum, level) => sum + level.quantity, 0);

    const totalVol = bidVol + askVol;
    const imbalance = totalVol > 0 ? (bidVol - askVol) / totalVol : 0;

    const referencePrice = depth.bids.length > 0 ? depth.bids[0].price : 0;

    // Absorption confirmed when:
    // 1. Orderbook shows buyers stepping in (imbalance > threshold)
    // 2. Liquidation selling wave is decelerating
    const isAbsorptionConfirmed =
      imbalance >= this.minImbalanceThreshold && isLiquidationDecelerating;

    return {
      symbol: depth.symbol,
      orderbookImbalance: Number(imbalance.toFixed(4)),
      bidDepth5Levels: Number(bidVol.toFixed(4)),
      askDepth5Levels: Number(askVol.toFixed(4)),
      liquidationDeceleration: isLiquidationDecelerating,
      isAbsorptionConfirmed,
      referencePrice,
      timestamp: depth.timestamp,
    };
  }
}
