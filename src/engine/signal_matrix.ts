import {
  AgentState,
  RadarMetrics,
  AbsorptionMetrics,
  SignalDecision,
} from '../types/index.js';

export class SignalMatrix {
  private currentState: AgentState = 'STANDBY';
  private alertStartedAt: number = 0;
  private lowestObservedPrice: number = Infinity;
  private readonly alertTimeoutMs: number = 45_000; // 45s window to find absorption

  public getState(): AgentState {
    return this.currentState;
  }

  public reset(): void {
    this.currentState = 'STANDBY';
    this.alertStartedAt = 0;
    this.lowestObservedPrice = Infinity;
  }

  /**
   * Process incoming radar and absorption metrics to transition state and return a decision
   */
  public evaluate(
    radar: RadarMetrics,
    absorption: AbsorptionMetrics
  ): SignalDecision {
    const now = radar.timestamp;

    // Track lowest price during cascade
    if (absorption.referencePrice > 0 && absorption.referencePrice < this.lowestObservedPrice) {
      this.lowestObservedPrice = absorption.referencePrice;
    }

    // State Machine Transitions
    switch (this.currentState) {
      case 'STANDBY': {
        if (radar.isSpike) {
          this.currentState = 'ALERT';
          this.alertStartedAt = now;
          this.lowestObservedPrice = absorption.referencePrice;

          return {
            state: 'ALERT',
            action: 'WATCH',
            symbol: radar.symbol,
            confidence: 60,
            reason: `Liquidation cascade detected: $${(radar.rollingNotional10s / 1000).toFixed(1)}k in 10s. Watching for absorption.`,
            suggestedEntry: 0,
            stopLoss: 0,
            takeProfit: 0,
            timestamp: now,
          };
        }

        return {
          state: 'STANDBY',
          action: 'NONE',
          symbol: radar.symbol,
          confidence: 0,
          reason: 'Market nominal. No anomalous liquidation cascade.',
          suggestedEntry: 0,
          stopLoss: 0,
          takeProfit: 0,
          timestamp: now,
        };
      }

      case 'ALERT': {
        // Check timeout
        if (now - this.alertStartedAt > this.alertTimeoutMs) {
          this.reset();
          return {
            state: 'STANDBY',
            action: 'NONE',
            symbol: radar.symbol,
            confidence: 10,
            reason: 'Alert expired without absorption. Knife falling or exhausted without clear bottom.',
            suggestedEntry: 0,
            stopLoss: 0,
            takeProfit: 0,
            timestamp: now,
          };
        }

        // Check if absorption confirmed
        if (absorption.isAbsorptionConfirmed) {
          this.currentState = 'ARMED';

          const entryPrice = absorption.referencePrice;
          const stopLoss = Number((this.lowestObservedPrice * 0.992).toFixed(4)); // -0.8% under wick
          const takeProfit = Number((entryPrice * 1.024).toFixed(4)); // +2.4% mean reversion

          return {
            state: 'ARMED',
            action: 'EXECUTE_ICEBERG',
            symbol: radar.symbol,
            confidence: 92,
            reason: `Absorption confirmed (OIB: +${absorption.orderbookImbalance.toFixed(2)}), cascade decelerating. Sniper entry armed.`,
            suggestedEntry: entryPrice,
            stopLoss,
            takeProfit,
            timestamp: now,
          };
        }

        return {
          state: 'ALERT',
          action: 'WATCH',
          symbol: radar.symbol,
          confidence: 70,
          reason: `Liquidation ongoing ($${(radar.rollingNotional10s / 1000).toFixed(1)}k). Orderbook not yet absorbing.`,
          suggestedEntry: 0,
          stopLoss: 0,
          takeProfit: 0,
          timestamp: now,
        };
      }

      case 'ARMED': {
        // Once armed and executed, transition to TRIGGERED
        this.currentState = 'TRIGGERED';
        const entryPrice = absorption.referencePrice;
        const stopLoss = Number((this.lowestObservedPrice * 0.992).toFixed(4));
        const takeProfit = Number((entryPrice * 1.024).toFixed(4));

        return {
          state: 'TRIGGERED',
          action: 'EXECUTE_ICEBERG',
          symbol: radar.symbol,
          confidence: 95,
          reason: 'Executing staggered Iceberg limit buy order.',
          suggestedEntry: entryPrice,
          stopLoss,
          takeProfit,
          timestamp: now,
        };
      }

      case 'TRIGGERED': {
        // Return to standby after order has been deployed
        this.reset();
        return {
          state: 'STANDBY',
          action: 'NONE',
          symbol: radar.symbol,
          confidence: 100,
          reason: 'Sniper order cycle complete. Returning to scan mode.',
          suggestedEntry: 0,
          stopLoss: 0,
          takeProfit: 0,
          timestamp: now,
        };
      }

      default:
        this.reset();
        return {
          state: 'STANDBY',
          action: 'NONE',
          symbol: radar.symbol,
          confidence: 0,
          reason: 'Default fallback.',
          suggestedEntry: 0,
          stopLoss: 0,
          takeProfit: 0,
          timestamp: now,
        };
    }
  }
}
