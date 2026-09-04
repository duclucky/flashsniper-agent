export type OrderSide = 'BUY' | 'SELL';

export interface LiquidationOrder {
  symbol: string;
  side: OrderSide;
  price: number;
  quantity: number;
  notional: number;
  timestamp: number;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
}

export interface OrderBookDepth {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
}

export interface RadarMetrics {
  symbol: string;
  rollingNotional10s: number;
  rollingNotional30s: number;
  count10s: number;
  velocityNotionalPerSec: number;
  isSpike: boolean;
  timestamp: number;
}

export interface AbsorptionMetrics {
  symbol: string;
  orderbookImbalance: number; // -1.0 (all ask) to +1.0 (all bid)
  bidDepth5Levels: number;
  askDepth5Levels: number;
  liquidationDeceleration: boolean;
  isAbsorptionConfirmed: boolean;
  referencePrice: number;
  timestamp: number;
}

export type AgentState = 'STANDBY' | 'ALERT' | 'ARMED' | 'TRIGGERED' | 'HALTED';

export interface SignalDecision {
  state: AgentState;
  action: 'NONE' | 'WATCH' | 'EXECUTE_ICEBERG' | 'HALT';
  symbol: string;
  confidence: number;
  reason: string;
  suggestedEntry: number;
  stopLoss: number;
  takeProfit: number;
  timestamp: number;
}

export interface ProposedOrder {
  symbol: string;
  side: OrderSide;
  type: 'ICEBERG' | 'LIMIT';
  price: number;
  notional: number;
  quantity: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  clientOrderId: string;
  executable: boolean;
  sha256Proof?: string;
}

export interface RiskConfig {
  maxAllocationPercent: number; // e.g. 2% of sub-account balance
  maxNotionalUsd: number;       // e.g. $1000 max per sniper entry
  hardStopLossPercent: number;  // e.g. 0.8% under liquidation wick
  takeProfitRatio: number;      // e.g. 2.0x (TP = 1.6% - 2.5%)
  maxDailyLossUsd: number;      // Circuit breaker for the day
  allowlistSymbols: string[];
}

export interface RiskEvaluation {
  passed: boolean;
  allocatedNotional: number;
  ruleFired: string;
  details: string;
}
