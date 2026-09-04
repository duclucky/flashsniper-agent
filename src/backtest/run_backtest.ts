import fs from 'node:fs';
import path from 'node:path';
import { QuantBacktestEngine } from './backtest_engine.js';

const BANNER = `
\x1b[33m========================================================================================
  ______ _                 _        _____       _
 |  ____| |               | |      / ____|     (_)
 | |__  | | __ _ ___  ___ | |__   | (___  _ __  _ _ __   ___ _ __
 |  __| | |/ _\` / __|/ _ \\| '_ \\   \\___ \\| '_ \\| | '_ \\ / _ \\ '__|
 | |    | | (_| \\__ \\ (_) | | | |  ____) | | | | | |_) |  __/ |
 |_|    |_|\\__,_|___/\\___/|_| |_| |_____/|_| |_|_| .__/ \\___|_|
                                                 | |
  QUANTITATIVE BACKTEST LAB (50 HISTORICAL FLASH CRASHES) |_|
========================================================================================\x1b[0m
`;

async function main() {
  console.log(BANNER);
  console.log('\x1b[36m[*] Ingesting 50 historical liquidation cascade events from data/historical_cascades_50.json ...\x1b[0m');
  console.log('\x1b[90m[*] Simulating L2 Orderbook Matching with 0.05% Binance Taker fee and 0.4% entry latency...\x1b[0m\n');

  const engine = new QuantBacktestEngine();
  const { trades, metrics } = engine.run();

  // Print Summary Table
  console.log('\x1b[1m\x1b[33m----------------------------------------------------------------------------------------\x1b[0m');
  console.log('\x1b[1m\x1b[33m                     HEDGE FUND BACKTEST PERFORMANCE REPORT                            \x1b[0m');
  console.log('\x1b[1m\x1b[33m----------------------------------------------------------------------------------------\x1b[0m');
  console.log(`  Total Events Processed:     \x1b[1m${metrics.totalEventsProcessed}\x1b[0m`);
  console.log(`  Trades Executed:            \x1b[1m${metrics.totalTradesExecuted}\x1b[0m (Passed OIB & Deceleration Filters)`);
  console.log(`  Falling Knives Avoided:     \x1b[32m\x1b[1m${metrics.fallingKnivesAvoided}\x1b[0m (Filter blocked deadly black swans)`);
  console.log(`  Winning Trades (TP Hit):    \x1b[32m\x1b[1m${metrics.winningTrades}\x1b[0m`);
  console.log(`  Losing Trades (SL Hit):     \x1b[31m\x1b[1m${metrics.losingTrades}\x1b[0m`);
  console.log(`  \x1b[1mWin Rate:\x1b[0m                   \x1b[32m\x1b[1m${metrics.winRatePercent}%\x1b[0m`);
  console.log(`  Gross Profit:               \x1b[32m+$${metrics.grossProfitUsd} USDT\x1b[0m`);
  console.log(`  Gross Loss:                 \x1b[31m-$${metrics.grossLossUsd} USDT\x1b[0m`);
  console.log(`  \x1b[1mNet Profit:\x1b[0m                 \x1b[32m\x1b[1m+$${metrics.netProfitUsd} USDT\x1b[0m`);
  console.log(`  \x1b[1mProfit Factor:\x1b[0m              \x1b[33m\x1b[1m${metrics.profitFactor}\x1b[0m (Gross Profit / Gross Loss)`);
  console.log(`  Expectancy per Trade:       \x1b[32m+$${metrics.expectancyUsdPerTrade} USDT\x1b[0m`);
  console.log(`  \x1b[1mMax Drawdown:\x1b[0m               \x1b[31m\x1b[1m${metrics.maxDrawdownPercent}%\x1b[0m (Guarded by -0.8% Hard Stop-Loss)`);
  console.log(`  Sharpe Ratio (Annualized):  \x1b[36m\x1b[1m${metrics.sharpeRatio}\x1b[0m`);
  console.log(`  Capital Growth:             $${metrics.initialCapitalUsd.toLocaleString()} ➜ \x1b[1m\x1b[32m$${metrics.finalCapitalUsd.toLocaleString()} USDT\x1b[0m`);
  console.log('\x1b[1m\x1b[33m----------------------------------------------------------------------------------------\x1b[0m\n');

  // Export JSON Report
  const jsonPath = path.resolve('data/backtest_summary.json');
  fs.writeFileSync(jsonPath, JSON.stringify({ metrics, trades }, null, 2), 'utf-8');
  console.log(`\x1b[32m[✓] Exported full JSON report to:\x1b[0m ${jsonPath}`);

  // Export CSV Report
  const csvPath = path.resolve('data/backtest_trades.csv');
  const csvHeaders = 'EventId,Date,Symbol,EntryPrice,ExitPrice,NotionalUsd,NetPnlUsd,RoiPct,Outcome,HoldTimeSec,SHA256Proof\n';
  const csvRows = trades
    .map(
      (t) =>
        `${t.eventId},${t.date},${t.symbol},${t.entryPrice},${t.exitPrice},${t.notionalUsd},${t.pnlUsd},${t.roiPct}%,${t.outcome},${t.holdTimeSec}s,${t.sha256Proof}`
    )
    .join('\n');
  fs.writeFileSync(csvPath, csvHeaders + csvRows, 'utf-8');
  console.log(`\x1b[32m[✓] Exported full CSV trades to:\x1b[0m  ${csvPath}\n`);

  console.log('\x1b[35m[*] This data is connected to Web Dashboard: http://localhost:4173 (Tab Quant Backtest)\x1b[0m\n');
}

main().catch(console.error);
