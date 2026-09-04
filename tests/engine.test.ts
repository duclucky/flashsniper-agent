import { describe, it, expect, beforeEach } from 'vitest';
import { LiquidationRadar } from '../src/engine/liquidation_radar.js';
import { AbsorptionFilter } from '../src/engine/absorption_filter.js';
import { SignalMatrix } from '../src/engine/signal_matrix.js';
import { RiskGate } from '../src/risk/risk_gate.js';
import { OrderBookDepth, LiquidationOrder, SignalDecision } from '../src/types/index.js';

describe('LiquidationRadar', () => {
  let radar: LiquidationRadar;

  beforeEach(() => {
    radar = new LiquidationRadar(500_000); // $500k spike threshold
  });

  it('should report zero volume when no liquidations occur', () => {
    const metrics = radar.analyze('SOLUSDT', 1000_000);
    expect(metrics.rollingNotional10s).toBe(0);
    expect(metrics.isSpike).toBe(false);
  });

  it('should trigger spike flag when rolling 10s volume exceeds threshold', () => {
    const now = 1000_000;
    // Add two orders summing to $600k within 5 seconds
    radar.addOrder({
      symbol: 'SOLUSDT',
      side: 'SELL',
      price: 135,
      quantity: 2000,
      notional: 270_000,
      timestamp: now - 4000,
    });
    radar.addOrder({
      symbol: 'SOLUSDT',
      side: 'SELL',
      price: 134,
      quantity: 2500,
      notional: 335_000,
      timestamp: now - 1000,
    });

    const metrics = radar.analyze('SOLUSDT', now);
    expect(metrics.rollingNotional10s).toBe(605_000);
    expect(metrics.isSpike).toBe(true);
    expect(metrics.count10s).toBe(2);
  });

  it('should correctly detect liquidation deceleration', () => {
    const now = 1000_000;
    // Heavy liquidation in prior window (t - 15s to t - 5s): $500k
    radar.addOrder({
      symbol: 'SOLUSDT',
      side: 'SELL',
      price: 135,
      quantity: 3700,
      notional: 500_000,
      timestamp: now - 10_000,
    });
    // Negligible liquidation in recent 5s: $10k
    radar.addOrder({
      symbol: 'SOLUSDT',
      side: 'SELL',
      price: 131,
      quantity: 76,
      notional: 10_000,
      timestamp: now - 2_000,
    });

    expect(radar.isDecelerating('SOLUSDT', now)).toBe(true);
  });
});

describe('AbsorptionFilter', () => {
  const filter = new AbsorptionFilter(0.25);

  it('should compute negative imbalance during cascade selling', () => {
    const depth: OrderBookDepth = {
      symbol: 'SOLUSDT',
      timestamp: 1000_000,
      bids: [{ price: 130, quantity: 200 }],
      asks: [{ price: 131, quantity: 800 }],
    };

    const metrics = filter.evaluate(depth, false);
    expect(metrics.orderbookImbalance).toBe(-0.6);
    expect(metrics.isAbsorptionConfirmed).toBe(false);
  });

  it('should confirm absorption when bid imbalance is positive and liquidation decelerating', () => {
    const depth: OrderBookDepth = {
      symbol: 'SOLUSDT',
      timestamp: 1000_000,
      bids: [
        { price: 130.5, quantity: 1500 },
        { price: 130.4, quantity: 1200 },
      ],
      asks: [
        { price: 130.6, quantity: 400 },
        { price: 130.7, quantity: 300 },
      ],
    };

    const metrics = filter.evaluate(depth, true);
    expect(metrics.orderbookImbalance).toBeGreaterThan(0.5);
    expect(metrics.isAbsorptionConfirmed).toBe(true);
  });

  it('should refuse absorption if liquidation is still accelerating even with thick bids', () => {
    const depth: OrderBookDepth = {
      symbol: 'SOLUSDT',
      timestamp: 1000_000,
      bids: [{ price: 130, quantity: 2000 }],
      asks: [{ price: 131, quantity: 500 }],
    };

    const metrics = filter.evaluate(depth, false); // Deceleration is FALSE
    expect(metrics.isAbsorptionConfirmed).toBe(false);
  });
});

describe('SignalMatrix (State Machine)', () => {
  let matrix: SignalMatrix;

  beforeEach(() => {
    matrix = new SignalMatrix();
  });

  it('should transition from STANDBY to ALERT upon liquidation spike', () => {
    const radar = {
      symbol: 'SOLUSDT',
      rollingNotional10s: 750_000,
      rollingNotional30s: 1_200_000,
      count10s: 15,
      velocityNotionalPerSec: 75_000,
      isSpike: true,
      timestamp: 1000_000,
    };
    const absorption = {
      symbol: 'SOLUSDT',
      orderbookImbalance: -0.4,
      bidDepth5Levels: 500,
      askDepth5Levels: 1200,
      liquidationDeceleration: false,
      isAbsorptionConfirmed: false,
      referencePrice: 132.5,
      timestamp: 1000_000,
    };

    const decision = matrix.evaluate(radar, absorption);
    expect(decision.state).toBe('ALERT');
    expect(decision.action).toBe('WATCH');
  });

  it('should transition to ARMED when absorption is confirmed', () => {
    const now = 1000_000;
    // First trigger ALERT
    matrix.evaluate(
      {
        symbol: 'SOLUSDT',
        rollingNotional10s: 800_000,
        rollingNotional30s: 800_000,
        count10s: 10,
        velocityNotionalPerSec: 80_000,
        isSpike: true,
        timestamp: now,
      },
      {
        symbol: 'SOLUSDT',
        orderbookImbalance: -0.3,
        bidDepth5Levels: 400,
        askDepth5Levels: 800,
        liquidationDeceleration: false,
        isAbsorptionConfirmed: false,
        referencePrice: 132.0,
        timestamp: now,
      }
    );

    // Then provide absorption 10s later
    const decision = matrix.evaluate(
      {
        symbol: 'SOLUSDT',
        rollingNotional10s: 20_000,
        rollingNotional30s: 820_000,
        count10s: 1,
        velocityNotionalPerSec: 2_000,
        isSpike: false,
        timestamp: now + 10_000,
      },
      {
        symbol: 'SOLUSDT',
        orderbookImbalance: 0.45,
        bidDepth5Levels: 2500,
        askDepth5Levels: 800,
        liquidationDeceleration: true,
        isAbsorptionConfirmed: true,
        referencePrice: 131.0,
        timestamp: now + 10_000,
      }
    );

    expect(decision.state).toBe('ARMED');
    expect(decision.action).toBe('EXECUTE_ICEBERG');
    expect(decision.suggestedEntry).toBe(131.0);
    expect(decision.stopLoss).toBeLessThan(131.0);
    expect(decision.takeProfit).toBeGreaterThan(131.0);
  });
});

describe('RiskGate', () => {
  let riskGate: RiskGate;

  beforeEach(() => {
    riskGate = new RiskGate({
      maxAllocationPercent: 0.02,
      maxNotionalUsd: 500,
      maxDailyLossUsd: 100,
      allowlistSymbols: ['SOLUSDT', 'BTCUSDT'],
    });
  });

  const validDecision: SignalDecision = {
    state: 'ARMED',
    action: 'EXECUTE_ICEBERG',
    symbol: 'SOLUSDT',
    confidence: 90,
    reason: 'Absorption confirmed',
    suggestedEntry: 130.0,
    stopLoss: 128.5,
    takeProfit: 133.5,
    timestamp: 1000_000,
  };

  it('should PASS risk check and cap order to 2% of sub-account balance', () => {
    const subAccountBalance = 10_000; // 2% is $200
    const evalResult = riskGate.evaluate(validDecision, subAccountBalance);

    expect(evalResult.passed).toBe(true);
    expect(evalResult.allocatedNotional).toBe(200);
    expect(evalResult.ruleFired).toBe('PASS');
  });

  it('should enforce max notional ceiling even with large sub-account balance', () => {
    const subAccountBalance = 100_000; // 2% is $2000, but cap is $500
    const evalResult = riskGate.evaluate(validDecision, subAccountBalance);

    expect(evalResult.passed).toBe(true);
    expect(evalResult.allocatedNotional).toBe(500); // capped at maxNotionalUsd
  });

  it('should REJECT order if symbol is not on the allowlist', () => {
    const foreignDecision: SignalDecision = {
      ...validDecision,
      symbol: 'DOGEUSDT',
    };
    const evalResult = riskGate.evaluate(foreignDecision, 10_000);

    expect(evalResult.passed).toBe(false);
    expect(evalResult.ruleFired).toBe('ALLOWLIST_CHECK');
  });

  it('should HALT trading when daily loss limit is breached', () => {
    riskGate.recordLoss(120); // Daily limit is 100
    const evalResult = riskGate.evaluate(validDecision, 10_000);

    expect(evalResult.passed).toBe(false);
    expect(evalResult.ruleFired).toBe('DAILY_CIRCUIT_BREAKER');
  });

  it('should create an auditable proposed order with sha256 proof', () => {
    const order = riskGate.createProposedOrder(validDecision, 200);

    expect(order.symbol).toBe('SOLUSDT');
    expect(order.side).toBe('BUY');
    expect(order.type).toBe('ICEBERG');
    expect(order.notional).toBe(200);
    expect(order.sha256Proof).toBeDefined();
    expect(order.sha256Proof?.length).toBe(64);
  });
});

import { ReplayEngine } from '../src/mcp/replay.js';

describe('ReplayEngine (End-to-End Simulation)', () => {
  it('should run deterministic replay and trigger trade at absorption', () => {
    const replay = new ReplayEngine();
    const logs = replay.run();

    expect(logs.length).toBeGreaterThan(5);

    // Verify there is an ALERT state
    const alertFrame = logs.find((l) => l.state === 'ALERT');
    expect(alertFrame).toBeDefined();

    // Verify trade was executed upon absorption
    const executedFrame = logs.find((l) => l.executedOrder !== undefined);
    expect(executedFrame).toBeDefined();
    expect(executedFrame?.executedOrder?.symbol).toBe('SOLUSDT');
    expect(executedFrame?.executedOrder?.type).toBe('ICEBERG');
    expect(executedFrame?.executedOrder?.notional).toBe(200); // 2% of $10,000 sub-account
  });
});

import { InferenceTreasury } from '../src/treasury/inference_treasury.js';
import { CognitiveCortex } from '../src/ai/cognitive_cortex.js';

describe('InferenceTreasury & x402 Micropayments', () => {
  it('should deduct inference costs and record x402 receipt with sha256 proof', () => {
    const treasury = new InferenceTreasury(1.0);
    const receipt = treasury.payInference('Deterministic-Cortex', 0.0005, 150, 80);

    expect(receipt.receiptId.startsWith('X402_')).toBe(true);
    expect(receipt.costUsd).toBe(0.0005);
    expect(receipt.sha256Proof.length).toBe(64);
    expect(treasury.getStats().balanceUsd).toBe(0.9995);
  });

  it('should deposit trade profit slice and achieve self-sustaining status', () => {
    const treasury = new InferenceTreasury(0.01);
    // Simulate trade win of +$5.56 USDT -> deposit 1% ($0.0556)
    treasury.recordTradeProfit(5.56);

    const stats = treasury.getStats();
    expect(stats.totalEarnedFromProfits).toBeGreaterThan(0.05);
    expect(stats.isSelfSustaining).toBe(true);
  });
});

describe('CognitiveCortex (Tri-Mode Adversarial AI)', () => {
  it('should default to zero-cost deterministic heuristic cortex', async () => {
    const cortex = new CognitiveCortex();
    expect(cortex.getProvider()).toBe('heuristic');

    const evalResult = await cortex.evaluate(
      {
        symbol: 'SOLUSDT',
        rollingNotional10s: 600_000,
        rollingNotional30s: 800_000,
        count10s: 8,
        velocityNotionalPerSec: 60_000,
        isSpike: true,
        timestamp: 1000_000,
      },
      {
        symbol: 'SOLUSDT',
        orderbookImbalance: 0.35,
        bidDepth5Levels: 2000,
        askDepth5Levels: 500,
        liquidationDeceleration: true,
        isAbsorptionConfirmed: true,
        referencePrice: 131.0,
        timestamp: 1000_000,
      },
      'SOLUSDT'
    );

    expect(evalResult.approved).toBe(true);
    expect(evalResult.confidence).toBeGreaterThan(90);
    expect(evalResult.costUsd).toBe(0);
  });
});

import { OrderExecutor } from '../src/execution/order_executor.js';

describe('OrderExecutor (Bracket Order Execution)', () => {
  const executor = new OrderExecutor();

  it('should sanitize prices and quantities to Binance precision rules', () => {
    const rawOrder = {
      symbol: 'SOLUSDT',
      side: 'BUY' as const,
      type: 'ICEBERG' as const,
      price: 131.358291,
      notional: 200,
      quantity: 1.522581,
      stopLossPrice: 129.65439,
      takeProfitPrice: 134.50291,
      clientOrderId: 'FS_TEST_01',
      executable: true,
    };

    const sanitized = executor.sanitizeOrder(rawOrder);
    expect(sanitized.price).toBe(131.36); // tickSize 0.01
    expect(sanitized.qty).toBe(1.52);     // stepSize 0.01
    expect(sanitized.sl).toBe(129.65);
    expect(sanitized.tp).toBe(134.50);
  });

  it('should execute bracket order and emit valid SHA-256 receipt', async () => {
    const rawOrder = {
      symbol: 'SOLUSDT',
      side: 'BUY' as const,
      type: 'ICEBERG' as const,
      price: 131.35,
      notional: 200,
      quantity: 1.52,
      stopLossPrice: 129.65,
      takeProfitPrice: 134.50,
      clientOrderId: 'FS_TEST_02',
      executable: true,
    };

    const result = await executor.executeBracketOrder(rawOrder);
    expect(result.success).toBe(true);
    expect(result.sha256Receipt.length).toBe(64);
    expect(result.entryOrderId).toBeDefined();
    expect(result.stopLossOrderId).toBeDefined();
  });
});

import { X402Client } from '../src/treasury/x402_client.js';

describe('X402Client (EIP-712 Micro-Payments on BSC)', () => {
  const x402 = new X402Client();

  it('should parse HTTP 402 challenge correctly', () => {
    const headers = {
      'x-payment-currency': 'USDT',
      'x-payment-amount': '0.0008',
      'x-payment-receiver': '0xfc208aDc18034668c3A2bacf5532e2403212db89',
      'x-payment-nonce': 'nonce_test_123',
    };

    const challenge = x402.parseChallenge(headers);
    expect(challenge.status).toBe(402);
    expect(challenge.currency).toBe('USDT');
    expect(challenge.pricePerCallUsd).toBe(0.0008);
    expect(challenge.networkChainId).toBe(97); // BSC Testnet
  });

  it('should construct and sign EIP-712 TransferWithAuthorization payload', () => {
    const challenge = x402.parseChallenge({
      'x-payment-currency': 'USDT',
      'x-payment-amount': '0.0005',
    });

    const signed = x402.signMicroPayment(challenge);
    expect(signed.domain.name).toBe('USDT');
    expect(signed.message.from.startsWith('0x')).toBe(true);
    expect(signed.signature.startsWith('0x')).toBe(true);
    expect(signed.types.TransferWithAuthorization.length).toBe(6);
  });

  it('should settle payment and emit auditable receipt with SHA-256 proof', async () => {
    const challenge = x402.parseChallenge({ 'x-payment-amount': '0.0005' });
    const result = await x402.settlePayment(challenge);

    expect(result.success).toBe(true);
    expect(result.receiptId.startsWith('X402_')).toBe(true);
    expect(result.txHash.startsWith('0x')).toBe(true);
    expect(result.sha256Proof.length).toBe(64);
  });
});

import { QuantBacktestEngine } from '../src/backtest/backtest_engine.js';

describe('QuantBacktestEngine (50 Historical Flash Crashes)', () => {
  const engine = new QuantBacktestEngine();

  it('should process 50 historical liquidation events and filter black swans', () => {
    const { trades, metrics } = engine.run();

    expect(metrics.totalEventsProcessed).toBe(50);
    expect(metrics.totalTradesExecuted).toBe(48);
    expect(metrics.fallingKnivesAvoided).toBe(2);
    expect(metrics.winRatePercent).toBe(79.17);
    expect(metrics.winningTrades).toBe(38);
    expect(metrics.losingTrades).toBe(10);
    expect(metrics.netProfitUsd).toBeGreaterThan(100);
    expect(metrics.profitFactor).toBeGreaterThan(2.0);
    expect(trades.length).toBe(50);
  });
});





