export interface BacktestTradeResult {
  eventId: string;
  date: string;
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  notionalUsd: number;
  pnlUsd: number;
  roiPct: number;
  outcome: 'TAKE_PROFIT' | 'STOP_LOSS' | 'BLOCKED_BY_FILTER';
  holdTimeSec: number;
  reason: string;
  sha256Proof: string;
}

export interface BacktestSummaryMetrics {
  totalEventsProcessed: number;
  totalTradesExecuted: number;
  fallingKnivesAvoided: number;
  winningTrades: number;
  losingTrades: number;
  winRatePercent: number;
  grossProfitUsd: number;
  grossLossUsd: number;
  netProfitUsd: number;
  profitFactor: number;
  expectancyUsdPerTrade: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  initialCapitalUsd: number;
  finalCapitalUsd: number;
  equityCurve: number[];
}

export function calculateBacktestMetrics(
  trades: BacktestTradeResult[],
  initialCapital: number = 10_000
): BacktestSummaryMetrics {
  const executed = trades.filter((t) => t.outcome !== 'BLOCKED_BY_FILTER');
  const blocked = trades.filter((t) => t.outcome === 'BLOCKED_BY_FILTER');

  const winners = executed.filter((t) => t.pnlUsd > 0);
  const losers = executed.filter((t) => t.pnlUsd <= 0);

  const grossProfit = winners.reduce((sum, t) => sum + t.pnlUsd, 0);
  const grossLoss = Math.abs(losers.reduce((sum, t) => sum + t.pnlUsd, 0));
  const netProfit = grossProfit - grossLoss;

  const winRate = executed.length > 0 ? (winners.length / executed.length) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.0 : 0;
  const expectancy = executed.length > 0 ? netProfit / executed.length : 0;

  // Calculate step-by-step equity curve and drawdown
  const equityCurve: number[] = [initialCapital];
  let currentBalance = initialCapital;
  let peakBalance = initialCapital;
  let maxDrawdownPct = 0;

  for (const t of executed) {
    currentBalance += t.pnlUsd;
    equityCurve.push(Number(currentBalance.toFixed(2)));

    if (currentBalance > peakBalance) {
      peakBalance = currentBalance;
    } else {
      const dd = ((peakBalance - currentBalance) / peakBalance) * 100;
      if (dd > maxDrawdownPct) {
        maxDrawdownPct = dd;
      }
    }
  }

  // Calculate Sharpe Ratio (daily return approximation)
  const returns = executed.map((t) => t.roiPct / 100);
  const meanReturn = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length || 1);
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0;

  return {
    totalEventsProcessed: trades.length,
    totalTradesExecuted: executed.length,
    fallingKnivesAvoided: blocked.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    winRatePercent: Number(winRate.toFixed(2)),
    grossProfitUsd: Number(grossProfit.toFixed(2)),
    grossLossUsd: Number(grossLoss.toFixed(2)),
    netProfitUsd: Number(netProfit.toFixed(2)),
    profitFactor: Number(profitFactor.toFixed(2)),
    expectancyUsdPerTrade: Number(expectancy.toFixed(2)),
    maxDrawdownPercent: -Number(maxDrawdownPct.toFixed(2)),
    sharpeRatio: Number(sharpeRatio.toFixed(2)),
    initialCapitalUsd: initialCapital,
    finalCapitalUsd: Number(currentBalance.toFixed(2)),
    equityCurve,
  };
}
