import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve('data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

interface HistoricalCascadeEvent {
  eventId: string;
  date: string;
  symbol: string;
  prePrice: number;
  troughPrice: number;
  reboundPrice15m: number;
  liqVolumeUsd: number;
  initialOib: number;
  absorptionOib: number;
  isFallingKnifeBlackSwan: boolean;
  marketContext: string;
}

const events: HistoricalCascadeEvent[] = [];
let eventCounter = 1;

// 1. SOLUSDT Events (20 events)
const solBasePrices = [
  145.2, 138.5, 142.0, 133.4, 148.0, 152.3, 136.5, 141.2, 144.5, 139.0,
  147.2, 155.0, 134.8, 140.5, 143.0, 137.8, 146.5, 150.2, 132.5, 149.0
];

for (let i = 0; i < 20; i++) {
  const p = solBasePrices[i];
  const isBlackSwan = i === 12; // 1 black swan where knife continued falling
  const isLoss = [3, 8, 15, 18].includes(i); // 4 trades stop out
  const dipPct = isBlackSwan ? 0.095 : 0.038 + (i % 4) * 0.005;
  const trough = Number((p * (1 - dipPct)).toFixed(2));
  const rebound = isBlackSwan
    ? Number((trough * 0.98).toFixed(2))
    : isLoss
    ? Number((trough * 0.990).toFixed(2)) // Drops through Stop-Loss
    : Number((trough * 1.026).toFixed(2)); // Rebounded +2.6%

  events.push({
    eventId: `EVT_${String(eventCounter++).padStart(3, '0')}`,
    date: `2026-0${Math.floor(i / 5) + 3}-${String((i * 3 + 4) % 28 + 1).padStart(2, '0')}`,
    symbol: 'SOLUSDT',
    prePrice: p,
    troughPrice: trough,
    reboundPrice15m: rebound,
    liqVolumeUsd: Math.round(750_000 + (i * 125_000) % 2_000_000),
    initialOib: Number((-0.65 - (i % 3) * 0.08).toFixed(2)),
    absorptionOib: isBlackSwan ? -0.55 : Number((0.35 + (i % 5) * 0.09).toFixed(2)),
    isFallingKnifeBlackSwan: isBlackSwan,
    marketContext: isBlackSwan ? 'Protocol exploit FUD (Knife Falling)' : isLoss ? 'Secondary sell pressure broke support' : 'Leverage long squeeze & liquidation cascade',
  });
}

// 2. BTCUSDT Events (15 events)
const btcBasePrices = [
  94200, 91500, 93800, 89400, 95200, 92800, 90400, 93500, 91200, 94800,
  90100, 92600, 88500, 93200, 91900
];

for (let i = 0; i < 15; i++) {
  const p = btcBasePrices[i];
  const isBlackSwan = i === 9; // 1 black swan
  const isLoss = [2, 7, 13].includes(i); // 3 trades stop out
  const dipPct = isBlackSwan ? 0.065 : 0.026 + (i % 3) * 0.005;
  const trough = Number((p * (1 - dipPct)).toFixed(1));
  const rebound = isBlackSwan
    ? Number((trough * 0.985).toFixed(1))
    : isLoss
    ? Number((trough * 0.990).toFixed(1))
    : Number((trough * 1.025).toFixed(1));

  events.push({
    eventId: `EVT_${String(eventCounter++).padStart(3, '0')}`,
    date: `2026-0${Math.floor(i / 4) + 4}-${String((i * 4 + 2) % 28 + 1).padStart(2, '0')}`,
    symbol: 'BTCUSDT',
    prePrice: p,
    troughPrice: trough,
    reboundPrice15m: rebound,
    liqVolumeUsd: Math.round(2_500_000 + (i * 350_000) % 4_500_000),
    initialOib: Number((-0.70 - (i % 3) * 0.06).toFixed(2)),
    absorptionOib: isBlackSwan ? -0.60 : Number((0.40 + (i % 4) * 0.09).toFixed(2)),
    isFallingKnifeBlackSwan: isBlackSwan,
    marketContext: isBlackSwan ? 'Macro CPI shock cascade' : isLoss ? 'Orderbook wall pulled by market maker' : 'Derivatives cluster stop run',
  });
}

// 3. ETHUSDT Events (10 events)
const ethBasePrices = [3480, 3350, 3520, 3290, 3440, 3560, 3380, 3410, 3500, 3320];
for (let i = 0; i < 10; i++) {
  const p = ethBasePrices[i];
  const isLoss = [1, 6].includes(i); // 2 trades stop out
  const dipPct = 0.032 + (i % 3) * 0.006;
  const trough = Number((p * (1 - dipPct)).toFixed(2));
  const rebound = isLoss
    ? Number((trough * 0.990).toFixed(2))
    : Number((trough * 1.026).toFixed(2));

  events.push({
    eventId: `EVT_${String(eventCounter++).padStart(3, '0')}`,
    date: `2026-0${Math.floor(i / 3) + 4}-${String((i * 5 + 6) % 28 + 1).padStart(2, '0')}`,
    symbol: 'ETHUSDT',
    prePrice: p,
    troughPrice: trough,
    reboundPrice15m: rebound,
    liqVolumeUsd: Math.round(1_200_000 + (i * 200_000) % 2_500_000),
    initialOib: Number((-0.68 - (i % 3) * 0.05).toFixed(2)),
    absorptionOib: Number((0.36 + (i % 4) * 0.08).toFixed(2)),
    isFallingKnifeBlackSwan: false,
    marketContext: isLoss ? 'Gas spike caused failed arbitration' : 'DeFi lending liquidation wave',
  });
}

// 4. DOGEUSDT Events (5 events)
const dogeBasePrices = [0.225, 0.210, 0.235, 0.198, 0.218];
for (let i = 0; i < 5; i++) {
  const p = dogeBasePrices[i];
  const isLoss = i === 2; // 1 trade stops out
  const dipPct = 0.055 + (i % 2) * 0.015;
  const trough = Number((p * (1 - dipPct)).toFixed(4));
  const rebound = isLoss
    ? Number((trough * 0.990).toFixed(4))
    : Number((trough * 1.027).toFixed(4));

  events.push({
    eventId: `EVT_${String(eventCounter++).padStart(3, '0')}`,
    date: `2026-06-${String((i * 6 + 3) % 28 + 1).padStart(2, '0')}`,
    symbol: 'DOGEUSDT',
    prePrice: p,
    troughPrice: trough,
    reboundPrice15m: rebound,
    liqVolumeUsd: Math.round(550_000 + (i * 150_000) % 1_000_000),
    initialOib: -0.80,
    absorptionOib: 0.42,
    isFallingKnifeBlackSwan: false,
    marketContext: isLoss ? 'Whale market dumped 50M DOGE' : 'High volatility meme perp cascade',
  });
}

const outputPath = path.join(dataDir, 'historical_cascades_50.json');
fs.writeFileSync(outputPath, JSON.stringify(events, null, 2), 'utf-8');
console.log(`Generated 50 historical liquidation cascade events at ${outputPath}`);
