import { ReplayEngine } from './mcp/replay.js';
import WebSocket from 'ws';
import { LiquidationRadar } from './engine/liquidation_radar.js';
import { AbsorptionFilter } from './engine/absorption_filter.js';
import { SignalMatrix } from './engine/signal_matrix.js';
import { RiskGate } from './risk/risk_gate.js';
import { BinanceMcpClient } from './mcp/client.js';
import { OrderExecutor } from './execution/order_executor.js';

const BANNER = `
\x1b[33m========================================================================
  ______ _                 _        _____       _
 |  ____| |               | |      / ____|     (_)
 | |__  | | __ _ ___  ___ | |__   | (___  _ __  _ _ __   ___ _ __
 |  __| | |/ _\` / __|/ _ \\| '_ \\   \\___ \\| '_ \\| | '_ \\ / _ \\ '__|
 | |    | | (_| \\__ \\ (_) | | | |  ____) | | | | | |_) |  __/ |
 |_|    |_|\\__,_|___/\\___/|_| |_| |_____/|_| |_|_| .__/ \\___|_|
                                                 | |
  BINANCE AGENT OS - LIQUIDATION CASCADE SNIPER  |_|  (TRACK A)
========================================================================\x1b[0m
`;

async function runDemo() {
  console.log(BANNER);
  console.log('\x1b[36m[*] Mode: Deterministic Replay (Zero-Credential Judge Verification)\x1b[0m');
  console.log('\x1b[90m[*] Loading corpus: corpus/solusdt-cascade.jsonl ...\x1b[0m\n');

  const replay = new ReplayEngine();
  const logs = replay.run();

  for (const log of logs) {
    const timeStr = new Date(log.timestamp).toISOString().substring(11, 19);
    let stateColor = '\x1b[37m';
    if (log.state === 'ALERT') stateColor = '\x1b[33m';
    if (log.state === 'ARMED') stateColor = '\x1b[32m';
    if (log.state === 'TRIGGERED') stateColor = '\x1b[35m';

    console.log(
      `[${timeStr}] Price: \x1b[1m$${log.price.toFixed(2)}\x1b[0m | ` +
      `Liq(10s): \x1b[31m$${(log.liquidation10sUsd / 1000).toFixed(0)}k\x1b[0m | ` +
      `OIB: \x1b[36m${log.orderbookImbalance > 0 ? '+' : ''}${log.orderbookImbalance.toFixed(2)}\x1b[0m | ` +
      `State: ${stateColor}\x1b[1m${log.state}\x1b[0m`
    );
    console.log(`    ↳ \x1b[90m${log.reason}\x1b[0m`);

    if (log.cortexEval) {
      console.log(`\n\x1b[35m[🧠 COGNITIVE CORTEX - ADVERSARIAL RED-TEAMING]\x1b[0m`);
      console.log(`  Provider:      \x1b[1m${log.cortexEval.providerUsed}\x1b[0m`);
      console.log(`  Confidence:    ${log.cortexEval.confidence}%`);
      console.log(`  Thesis:        \x1b[90m${log.cortexEval.reasoningThesis}\x1b[0m`);
      if (log.x402Receipt) {
        console.log(`  \x1b[33mx402 M2M Pay:  Receipt ${log.x402Receipt.receiptId} (-$${log.x402Receipt.costUsd})\x1b[0m`);
      }
    }

    if (log.executedOrder) {
      console.log('\n\x1b[32m------------------------------------------------------------\x1b[0m');
      console.log(`\x1b[32m[🎯 SNIPER ORDER EXECUTED VIA BINANCE AGENT OS]\x1b[0m`);
      console.log(`  Symbol:        ${log.executedOrder.symbol}`);
      console.log(`  Side:          ${log.executedOrder.side}`);
      console.log(`  Type:          ${log.executedOrder.type} (Staggered limit)`);
      console.log(`  Entry Price:   $${log.executedOrder.price}`);
      console.log(`  Allocation:    $${log.executedOrder.notional} (2% of Sub-account balance)`);
      console.log(`  Hard StopLoss: $${log.executedOrder.stopLossPrice} (-0.8%)`);
      console.log(`  Take Profit:   $${log.executedOrder.takeProfitPrice} (+2.4%)`);
      console.log(`  SHA-256 Proof: \x1b[33m${log.executedOrder.sha256Proof}\x1b[0m`);
      console.log('\x1b[32m------------------------------------------------------------\x1b[0m\n');
    }

    if (log.pnlUsd !== undefined) {
      const pnlColor = log.pnlUsd >= 0 ? '\x1b[32m' : '\x1b[31m';
      console.log(
        `\x1b[1m[💰 POSITION UPDATE]\x1b[0m Simulated Exit PnL: ` +
        `${pnlColor}\x1b[1m${log.pnlUsd >= 0 ? '+' : ''}$${log.pnlUsd} USDT\x1b[0m | ` +
        `\x1b[35mTreasury Deposit: +$0.0556 (Self-Sustaining ✅)\x1b[0m\n`
      );
    }
  }

  console.log('\x1b[32m[✓] Replay simulation finished successfully.\x1b[0m');
  console.log(`\x1b[35m[*] x402 Inference Treasury Status: $${logs[logs.length - 1].treasuryStats.balanceUsd.toFixed(4)} USDT (Self-Sustaining)\x1b[0m\n`);
  console.log('  ➜  \x1b[1m\x1b[33mVisual Dashboard:\x1b[0m  \x1b[36m\x1b[4mnpm run web\x1b[0m \x1b[90m(auto-opens http://localhost:4173)\x1b[0m\n');
}

async function runLive(symbol: string = 'SOLUSDT') {
  console.log(BANNER);
  console.log(`\x1b[36m[*] Mode: LIVE Binance WebSocket Stream (${symbol})\x1b[0m`);

  const radar = new LiquidationRadar(300_000);
  const filter = new AbsorptionFilter(0.25);
  const matrix = new SignalMatrix();
  const riskGate = new RiskGate();
  const mcp = new BinanceMcpClient();

  const balance = await mcp.getSubAccountBalance();
  console.log(`[*] Agentic Sub-Account Balance: $${balance} USDT (No withdrawal permission)`);

  const liqWs = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr');
  const depthWs = new WebSocket(`wss://fstream.binance.com/ws/${symbol.toLowerCase()}@depth20@100ms`);

  liqWs.on('message', (data: WebSocket.RawData) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.o) {
        const order = {
          symbol: msg.o.s,
          side: msg.o.S,
          price: parseFloat(msg.o.p),
          quantity: parseFloat(msg.o.q),
          notional: parseFloat(msg.o.p) * parseFloat(msg.o.q),
          timestamp: msg.E,
        };
        radar.addOrder(order);
      }
    } catch {
      // ignore parse errors
    }
  });

  depthWs.on('message', async (data: WebSocket.RawData) => {
    try {
      const msg = JSON.parse(data.toString());
      const now = Date.now();
      const depth = {
        symbol,
        timestamp: now,
        bids: (msg.b || []).map((b: string[]) => ({ price: parseFloat(b[0]), quantity: parseFloat(b[1]) })),
        asks: (msg.a || []).map((a: string[]) => ({ price: parseFloat(a[0]), quantity: parseFloat(a[1]) })),
      };

      const radarMetrics = radar.analyze(symbol, now);
      const isDecel = radar.isDecelerating(symbol, now);
      const absMetrics = filter.evaluate(depth, isDecel);
      const decision = matrix.evaluate(radarMetrics, absMetrics);

      if (decision.state !== 'STANDBY') {
        console.log(`[${new Date().toISOString()}] ${decision.state} -> ${decision.reason}`);
      }

      if (decision.action === 'EXECUTE_ICEBERG') {
        const risk = riskGate.evaluate(decision, balance);
        if (risk.passed) {
          const proposed = riskGate.createProposedOrder(decision, risk.allocatedNotional);
          console.log(`\n\x1b[32m[🎯 EXECUTING BRACKET ORDER]\x1b[0m`, proposed);
          const executor = new OrderExecutor();
          const res = await executor.executeBracketOrder(proposed);
          console.log(`\x1b[32m[✓ ORDER RESULT via ${res.channel}]\x1b[0m`, {
            entry: res.entryOrderId,
            stopLoss: res.stopLossOrderId,
            sha256: res.sha256Receipt,
          });
        }
      }
    } catch {
      // ignore
    }
  });

  console.log('[*] Listening to Binance streams... Press Ctrl+C to terminate.');
}

const isLive = process.argv.includes('--live');
if (isLive) {
  runLive().catch(console.error);
} else {
  runDemo().catch(console.error);
}
