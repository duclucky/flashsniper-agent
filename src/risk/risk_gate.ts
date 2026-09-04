import {
  ProposedOrder,
  RiskConfig,
  RiskEvaluation,
  SignalDecision,
} from '../types/index.js';
import crypto from 'node:crypto';

export class RiskGate {
  private config: RiskConfig;
  private currentDailyLossUsd: number = 0;

  constructor(config?: Partial<RiskConfig>) {
    this.config = {
      maxAllocationPercent: 0.02, // 2%
      maxNotionalUsd: 1000,       // $1,000 cap
      hardStopLossPercent: 0.008, // 0.8%
      takeProfitRatio: 2.0,
      maxDailyLossUsd: 250,       // Max $250 loss/day
      allowlistSymbols: ['SOLUSDT', 'BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
      ...config,
    };
  }

  public recordLoss(amountUsd: number): void {
    this.currentDailyLossUsd += amountUsd;
  }

  public resetDailyLoss(): void {
    this.currentDailyLossUsd = 0;
  }

  /**
   * Evaluate a proposed sniper trade against strict risk rules
   */
  public evaluate(
    decision: SignalDecision,
    subAccountBalanceUsd: number
  ): RiskEvaluation {
    // 1. Fail-closed on non-actionable decisions
    if (decision.action !== 'EXECUTE_ICEBERG') {
      return {
        passed: false,
        allocatedNotional: 0,
        ruleFired: 'NO_ACTION',
        details: 'Decision is not an execution trigger.',
      };
    }

    // 2. Daily loss limit check
    if (this.currentDailyLossUsd >= this.config.maxDailyLossUsd) {
      return {
        passed: false,
        allocatedNotional: 0,
        ruleFired: 'DAILY_CIRCUIT_BREAKER',
        details: `Daily loss limit reached ($${this.currentDailyLossUsd} >= $${this.config.maxDailyLossUsd}). Trading halted.`,
      };
    }

    // 3. Allowlist check
    const isAllowed = this.config.allowlistSymbols.some(
      (s) => s.toUpperCase() === decision.symbol.toUpperCase()
    );
    if (!isAllowed) {
      return {
        passed: false,
        allocatedNotional: 0,
        ruleFired: 'ALLOWLIST_CHECK',
        details: `Symbol ${decision.symbol} is not on the approved allowlist.`,
      };
    }

    // 4. Hard Stop Loss Validation
    if (decision.stopLoss <= 0 || decision.stopLoss >= decision.suggestedEntry) {
      return {
        passed: false,
        allocatedNotional: 0,
        ruleFired: 'INVALID_STOP_LOSS',
        details: `Stop loss (${decision.stopLoss}) must be positive and strictly below entry (${decision.suggestedEntry}).`,
      };
    }

    // 5. Position Sizing & Sizing Cap
    const accountCappedNotional = subAccountBalanceUsd * this.config.maxAllocationPercent;
    const finalNotional = Math.min(
      accountCappedNotional,
      this.config.maxNotionalUsd
    );

    if (finalNotional < 10) {
      // Below Binance minimum notional threshold
      return {
        passed: false,
        allocatedNotional: 0,
        ruleFired: 'MIN_NOTIONAL_VIOLATION',
        details: `Calculated notional ($${finalNotional.toFixed(2)}) is below Binance minimum $10 order size.`,
      };
    }

    return {
      passed: true,
      allocatedNotional: Number(finalNotional.toFixed(2)),
      ruleFired: 'PASS',
      details: `Risk checks cleared. Sized to $${finalNotional.toFixed(2)} (within 2% sub-account cap).`,
    };
  }

  /**
   * Constructs an auditable proposed order with sha256 proof receipt
   */
  public createProposedOrder(
    decision: SignalDecision,
    allocatedNotional: number
  ): ProposedOrder {
    const quantity = Number((allocatedNotional / decision.suggestedEntry).toFixed(4));
    const clientOrderId = `FS_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const rawPayload = JSON.stringify({
      symbol: decision.symbol,
      side: 'BUY',
      type: 'ICEBERG',
      price: decision.suggestedEntry,
      notional: allocatedNotional,
      quantity,
      stopLossPrice: decision.stopLoss,
      takeProfitPrice: decision.takeProfit,
      clientOrderId,
      timestamp: decision.timestamp,
    });

    const sha256Proof = crypto.createHash('sha256').update(rawPayload).digest('hex');

    return {
      symbol: decision.symbol,
      side: 'BUY',
      type: 'ICEBERG',
      price: decision.suggestedEntry,
      notional: allocatedNotional,
      quantity,
      stopLossPrice: decision.stopLoss,
      takeProfitPrice: decision.takeProfit,
      clientOrderId,
      executable: true,
      sha256Proof,
    };
  }
}
