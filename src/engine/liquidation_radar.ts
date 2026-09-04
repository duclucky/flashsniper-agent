import { LiquidationOrder, RadarMetrics } from '../types/index.js';

export class LiquidationRadar {
  private history: LiquidationOrder[] = [];
  private spikeThreshold10s: number;

  constructor(spikeThreshold10s: number = 500_000) {
    this.spikeThreshold10s = spikeThreshold10s;
  }

  /**
   * Feed a new liquidation event into the radar
   */
  public addOrder(order: LiquidationOrder): void {
    this.history.push(order);
    this.pruneOld(order.timestamp);
  }

  /**
   * Prune orders older than 60 seconds
   */
  private pruneOld(currentTimestamp: number): void {
    const cutoff = currentTimestamp - 60_000;
    while (this.history.length > 0 && this.history[0].timestamp < cutoff) {
      this.history.shift();
    }
  }

  /**
   * Compute rolling liquidation velocity and spike status for a given symbol
   */
  public analyze(symbol: string, currentTimestamp: number): RadarMetrics {
    this.pruneOld(currentTimestamp);

    const symbolOrders = this.history.filter((o) => o.symbol.toUpperCase() === symbol.toUpperCase());

    const t10 = currentTimestamp - 10_000;
    const t30 = currentTimestamp - 30_000;

    let notional10s = 0;
    let count10s = 0;
    let notional30s = 0;

    for (const order of symbolOrders) {
      if (order.timestamp >= t10) {
        notional10s += order.notional;
        count10s++;
      }
      if (order.timestamp >= t30) {
        notional30s += order.notional;
      }
    }

    const velocityNotionalPerSec = notional10s / 10;
    const isSpike = notional10s >= this.spikeThreshold10s;

    return {
      symbol,
      rollingNotional10s: notional10s,
      rollingNotional30s: notional30s,
      count10s,
      velocityNotionalPerSec,
      isSpike,
      timestamp: currentTimestamp,
    };
  }

  /**
   * Checks if liquidation velocity is decelerating (exhaustion check)
   * Compares the most recent 5 seconds with the 10-15 seconds window prior.
   */
  public isDecelerating(symbol: string, currentTimestamp: number): boolean {
    const symbolOrders = this.history.filter((o) => o.symbol.toUpperCase() === symbol.toUpperCase());

    const recent5sCutoff = currentTimestamp - 5_000;
    const priorWindowStart = currentTimestamp - 15_000;
    const priorWindowEnd = currentTimestamp - 5_000;

    let recent5sVol = 0;
    let prior10sVol = 0;

    for (const order of symbolOrders) {
      if (order.timestamp >= recent5sCutoff) {
        recent5sVol += order.notional;
      } else if (order.timestamp >= priorWindowStart && order.timestamp < priorWindowEnd) {
        prior10sVol += order.notional;
      }
    }

    const priorRatePerSec = prior10sVol / 10;
    const recentRatePerSec = recent5sVol / 5;

    // Deceleration happens when prior rate was intense (> 20k/s) and recent rate dropped significantly
    return priorRatePerSec > 20_000 && recentRatePerSec < priorRatePerSec * 0.5;
  }

  public clear(): void {
    this.history = [];
  }
}
