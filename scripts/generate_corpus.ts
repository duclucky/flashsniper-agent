import fs from 'node:fs';
import path from 'node:path';

const corpusDir = path.resolve('corpus');
if (!fs.existsSync(corpusDir)) {
  fs.mkdirSync(corpusDir, { recursive: true });
}

const baseTime = 1756972800000; // Realistic fixed base timestamp
const frames: any[] = [];

// Phase 1: Nominal (Frames 0-3, 0s to 15s)
for (let i = 0; i <= 3; i++) {
  const ts = baseTime + i * 5000;
  frames.push({
    timestamp: ts,
    type: 'SNAPSHOT',
    symbol: 'SOLUSDT',
    price: 136.5 - i * 0.1,
    liquidations: [
      {
        symbol: 'SOLUSDT',
        side: 'SELL',
        price: 136.4,
        quantity: 120,
        notional: 16368,
        timestamp: ts,
      },
    ],
    depth: {
      symbol: 'SOLUSDT',
      timestamp: ts,
      bids: [
        { price: 136.4, quantity: 450 },
        { price: 136.3, quantity: 500 },
        { price: 136.2, quantity: 600 },
        { price: 136.1, quantity: 700 },
        { price: 136.0, quantity: 800 },
      ],
      asks: [
        { price: 136.5, quantity: 500 },
        { price: 136.6, quantity: 550 },
        { price: 136.7, quantity: 600 },
        { price: 136.8, quantity: 650 },
        { price: 136.9, quantity: 700 },
      ],
    },
    note: 'Nominal conditions',
  });
}

// Phase 2: Liquidation Cascade Surge (Frames 4-7, 20s to 35s)
const dumpPrices = [135.2, 133.8, 132.0, 130.8];
const dumpLiqNotionals = [280_000, 450_000, 620_000, 310_000];

for (let i = 0; i < dumpPrices.length; i++) {
  const ts = baseTime + (4 + i) * 5000;
  const p = dumpPrices[i];
  const notional = dumpLiqNotionals[i];
  frames.push({
    timestamp: ts,
    type: 'SNAPSHOT',
    symbol: 'SOLUSDT',
    price: p,
    liquidations: [
      {
        symbol: 'SOLUSDT',
        side: 'SELL',
        price: p,
        quantity: Number((notional / p).toFixed(2)),
        notional,
        timestamp: ts,
      },
    ],
    depth: {
      symbol: 'SOLUSDT',
      timestamp: ts,
      bids: [
        { price: p - 0.1, quantity: 150 },
        { price: p - 0.2, quantity: 200 },
        { price: p - 0.3, quantity: 250 },
        { price: p - 0.4, quantity: 300 },
        { price: p - 0.5, quantity: 350 },
      ],
      asks: [
        { price: p + 0.1, quantity: 900 },
        { price: p + 0.2, quantity: 1200 },
        { price: p + 0.3, quantity: 1500 },
        { price: p + 0.4, quantity: 1800 },
        { price: p + 0.5, quantity: 2000 },
      ],
    },
    note: 'Cascade acceleration - heavy selling pressure',
  });
}

// Phase 3: Absorption & Deceleration (Frames 8-9, 40s to 45s)
// Liquidations drop to negligible, but Bids thicken up massively!
const absorptionFrames = [
  { p: 130.9, liq: 18_000 },
  { p: 131.4, liq: 5_000 },
];

for (let i = 0; i < absorptionFrames.length; i++) {
  const ts = baseTime + (8 + i) * 5000;
  const item = absorptionFrames[i];
  frames.push({
    timestamp: ts,
    type: 'SNAPSHOT',
    symbol: 'SOLUSDT',
    price: item.p,
    liquidations: [
      {
        symbol: 'SOLUSDT',
        side: 'SELL',
        price: item.p,
        quantity: Number((item.liq / item.p).toFixed(2)),
        notional: item.liq,
        timestamp: ts,
      },
    ],
    depth: {
      symbol: 'SOLUSDT',
      timestamp: ts,
      bids: [
        { price: item.p - 0.05, quantity: 1800 },
        { price: item.p - 0.1, quantity: 2200 },
        { price: item.p - 0.15, quantity: 2500 },
        { price: item.p - 0.2, quantity: 3000 },
        { price: item.p - 0.25, quantity: 3500 },
      ],
      asks: [
        { price: item.p + 0.05, quantity: 300 },
        { price: item.p + 0.1, quantity: 350 },
        { price: item.p + 0.15, quantity: 400 },
        { price: item.p + 0.2, quantity: 450 },
        { price: item.p + 0.25, quantity: 500 },
      ],
    },
    note: 'Deceleration confirmed & massive Bid absorption',
  });
}

// Phase 4: Mean Reversion Bounce (Frames 10-12, 50s to 60s)
const bouncePrices = [133.2, 134.5, 135.0];
for (let i = 0; i < bouncePrices.length; i++) {
  const ts = baseTime + (10 + i) * 5000;
  const p = bouncePrices[i];
  frames.push({
    timestamp: ts,
    type: 'SNAPSHOT',
    symbol: 'SOLUSDT',
    price: p,
    liquidations: [],
    depth: {
      symbol: 'SOLUSDT',
      timestamp: ts,
      bids: [
        { price: p - 0.1, quantity: 800 },
        { price: p - 0.2, quantity: 900 },
        { price: p - 0.3, quantity: 1000 },
        { price: p - 0.4, quantity: 1100 },
        { price: p - 0.5, quantity: 1200 },
      ],
      asks: [
        { price: p + 0.1, quantity: 700 },
        { price: p + 0.2, quantity: 750 },
        { price: p + 0.3, quantity: 800 },
        { price: p + 0.4, quantity: 850 },
        { price: p + 0.5, quantity: 900 },
      ],
    },
    note: 'Sharp mean reversion - take profit target reached',
  });
}

const outputPath = path.join(corpusDir, 'solusdt-cascade.jsonl');
fs.writeFileSync(
  outputPath,
  frames.map((f) => JSON.stringify(f)).join('\n') + '\n',
  'utf-8'
);
console.log(`Generated ${frames.length} frames at ${outputPath}`);
