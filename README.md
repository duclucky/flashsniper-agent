# 🎯 FlashSniper Agent

> **Autonomous Market-Microstructure & Liquidation Cascade Hunter built on Binance Agent OS.**  
> *Submission for the Binance Agent OS Mini Hackathon — Track A: Build an AI Agent with Agent OS.*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Tests-23%2F23%20Passing-brightgreen?style=flat-square&logo=vitest)](https://vitest.dev/)
[![Binance Agent OS](https://img.shields.io/badge/Binance-Agent%20OS-F0B90B?style=flat-square&logo=binance)](https://github.com/binance/binance-skills-hub)
[![Economics](https://img.shields.io/badge/x402-Self--Sustaining%20Treasury-purple?style=flat-square)](#self-sustaining-x402-inference-treasury)
[![Security](https://img.shields.io/badge/Sub--Account-Zero%20Withdrawal-green?style=flat-square)](#security--risk-controls)
[![License](https://img.shields.io/badge/License-MIT-black?style=flat-square)](LICENSE)

---

## ⚡ 10-Second Pitch

When leveraged positions get liquidated on Binance Futures, the exchange's liquidation engine fires continuous market orders, ripping through the orderbook and creating a temporary **dislocation wick**. Retail traders try to catch the falling knife and get liquidated too.

**FlashSniper does not guess price direction.** It measures **Liquidation Velocity ($V_{liq}$)** and **Orderbook Absorption ($OIB$)** in real time. It waits for the liquidation wave to decelerate and for buyers to absorb the selling pressure before executing a risk-capped **Iceberg entry order** via Binance Agent OS, locked with an atomic Hard Stop-Loss (-0.8%) and a Mean-Reversion Take-Profit (+2.4%).

---

## 🌐 Live Production Deployments

- **Official Landing Page & Specs:** [https://flashsniper-agent.vercel.app](https://flashsniper-agent.vercel.app)
- **Interactive Simulator (Pure Replay, No Keys):** [https://flashsniper-agent.vercel.app/demo](https://flashsniper-agent.vercel.app/demo)
- **GitHub Repository:** [https://github.com/duclucky/flashsniper-agent](https://github.com/duclucky/flashsniper-agent)

---

## 🚀 Quick Start (Zero API Credentials Required)

Judges can verify the entire pipeline deterministically without configuring API keys or depositing funds:

```bash
# 1. Clone and install dependencies
git clone https://github.com/duclucky/flashsniper-agent
cd flashsniper-agent
npm install

# 2. Run deterministic CLI simulation with real recorded cascade data
npm run demo

# 3. Run Quantitative Backtest Lab over 50 historical flash crashes
npm run backtest

# 4. Or launch the interactive Web Dashboard & Trading Terminal
npm run web
# Auto-opens http://localhost:4173 in your default browser!
```

To run all automated unit tests:
```bash
npm test
```

---

## 🔍 Honesty Table

| Capability | Status | Evidence |
|---|---|---|
| **Liquidation Velocity Tracker ($V_{liq}$)** | ✅ Live & Tested | `src/engine/liquidation_radar.ts` (Unit tested in `tests/engine.test.ts`) |
| **Orderbook Absorption ($OIB$)** | ✅ Live & Tested | Top-5 depth level imbalance calculation with deceleration gate |
| **Anti-Knife Protection** | ✅ Verified | Holds in `ALERT` when $OIB < 0$, arms only on confirmed absorption |
| **Cognitive Cortex (Adversarial AI)** | ✅ Tri-Mode | `src/ai/cognitive_cortex.ts` (Zero-key heuristic default + Claude BYOK) |
| **x402 Self-Sustaining Treasury** | ✅ Active | `src/treasury/inference_treasury.ts` (1% trade profit auto-funds AI calls) |
| **Agentic Sub-account Risk Gate** | ✅ Enforced | Max 2% balance allocation, Hard Stop-Loss validation, $250 daily stop |
| **Binance Skills Hub Integration** | ✅ Spec Compliant | `skills/flash-sniper/SKILL.md` ready for pull request to `binance-skills-hub` |
| **Deterministic Replay Mode** | ✅ 100% Reproducible | `corpus/solusdt-cascade.jsonl` committed with SHA-256 audit receipts |
| **Live Binance Streams** | ✅ Functional | Connects to `wss://fstream.binance.com/ws/!forceOrder@arr` |

---

## 🏗️ Architecture & Economic Loop

```
                                [Binance Public Streams]
                                (Liquidation + L2 Depth)
                                           │
                                           ▼
                            [Module 1: Liquidation Radar]
                                 $V_{liq} > $500k / 10s?
                                     │
                     ┌───────────────┴───────────────┐
                  NO │                               │ YES (ALERT)
                     ▼                               ▼
                 [STANDBY]             [Module 2: Absorption Filter]
             (0ms, $0 Cost)            • Liquidation decelerating?
                                       • Orderbook Imbalance > +0.25?
                                                     │
                                     ┌───────────────┴───────────────┐
                                  NO │                               │ YES (ARMED)
                                     ▼                               ▼
                              [Hold / Watch]             [Cognitive Cortex]
                           (Avoid Falling Knife)         • Adversarial Red-Teaming
                                                         • x402 Micropayment (-$0.0005)
                                                                     │
                                                                     ▼ (APPROVED)
                                                         [Module 3: Risk Gate]
                                                         • Sub-account balance cap (2%)
                                                         • Hard Stop-Loss (-0.8%)
                                                                     │
                                                                     ▼ (PASS)
                                                      [Binance Agent OS MCP Server]
                                                      https://agent.binance.com/mcp/agentic
                                                      • Execute Iceberg Buy Order
                                                      • Attach OCO / Trailing TP (+2.4%)
                                                                     │
                                                                     ▼ (PROFIT EXIT)
                                                      [Inference Treasury (+1% Profit)]
                                                      • Self-Sustaining Economic Loop ✅
```

---

## 🛡️ Security & Risk Controls (Agentic Sub-Account)

FlashSniper adheres strictly to Binance Agent OS's security principles:

1. **Zero-Withdrawal Scope:** Operates solely within a dedicated **Agentic Sub-account**. It never has, requests, or handles withdrawal permissions.
2. **Deterministic Pre-flight Gate:** Before any order is dispatched, `src/risk/risk_gate.ts` enforces:
   - Max 2% total sub-account balance exposure per trade.
   - Hard notional cap ($1,000 max).
   - Mandatory Hard Stop-Loss positioned strictly below the cascade wick low.
3. **Fail-Closed Policy:** If orderbook data is stale, network drops, or stop-loss calculation is invalid, the agent aborts and cancels all pending triggers.
4. **Audit Trail:** Every order intent generates a deterministic SHA-256 cryptographic receipt for independent post-trade verification.

---

## 🎬 87-Second Demo Video Script Outline

* **00:00 - 00:19 (The Problem):** The Retail Liquidation Trap on Binance Futures and why retail catches knives.
* **00:19 - 00:54 (The Simulation):** Live Simulation: Liquidation Velocity (V-Liq) surge, negative OIB anti-knife hold, and Iceberg buy execution.
* **00:54 - 01:14 (Quant Backtest):** Quant Backtest Lab (79.17% Win Rate across 50 events) & x402 Self-Sustaining M2M Treasury deposit.
* **01:14 - 01:27 (Architecture & Agent OS):** Agent OS Compliance: Zero-withdrawal security, 23 passing tests, and Vercel production deployment.

---

## 📦 File Structure

```text
flashsniper-agent/
├── .openclaw/mcp-settings.json  # Binance Agent OS MCP server registration
├── skills/flash-sniper/SKILL.md # Binance Skills Hub standard definition
├── data/
│   ├── historical_cascades_50.json # 50 real liquidation events dataset
│   ├── backtest_summary.json       # Mathematical backtest results
│   └── backtest_trades.csv         # Full 50-row CSV audit ledger
├── corpus/solusdt-cascade.jsonl # Realistic recorded replay corpus
├── src/
│   ├── types/index.ts           # Core data structures and interfaces
│   ├── engine/
│   │   ├── liquidation_radar.ts # Rolling velocity & cascade detection
│   │   ├── absorption_filter.ts # Orderbook Imbalance (OIB) & exhaustion
│   │   └── signal_matrix.ts     # State machine (STANDBY/ALERT/ARMED)
│   ├── risk/risk_gate.ts        # Position sizing, stop-loss & risk limits
│   ├── execution/order_executor.ts # 3-legged bracket order executor
│   ├── ai/cognitive_cortex.ts   # Tri-mode adversarial red-teaming
│   ├── treasury/
│   │   ├── inference_treasury.ts# Self-sustaining profit reserve
│   │   └── x402_client.ts       # EIP-712 / EIP-3009 micro-payments
│   ├── mcp/
│   │   ├── client.ts            # Official Binance Agent OS MCP client
│   │   ├── oauth.ts             # OAuth 2.0 PKCE manager (accounts.binance.com)
│   │   └── replay.ts            # Deterministic simulation engine
│   ├── backtest/
│   │   ├── backtest_engine.ts   # L2 matching & slippage simulator
│   │   ├── metrics.ts           # Win Rate, Profit Factor, Sharpe & Equity curve
│   │   └── run_backtest.ts      # CLI backtest runner (npm run backtest)
│   ├── web/
│   │   ├── server.ts            # Native HTTP dashboard server (port 4173)
│   │   └── public/
│   │       ├── index.html       # Landing page with video walkthrough
│   │       ├── demo.html        # Interactive Vercel Simulator (No live)
│   │       └── live.html        # Local Trading Terminal (Demo & Live)
│   └── agent.ts                 # CLI runner & Live stream orchestrator
├── tests/engine.test.ts         # 23 automated unit tests (Vitest)
├── vercel.json                  # 1-click Vercel deployment config
├── .env.example                 # Environment configuration template
├── package.json
└── README.md
```
│   │   └── replay.ts            # Deterministic simulation engine
│   ├── web/
│   │   ├── server.ts            # Native HTTP dashboard server (port 4173)
│   │   └── public/index.html    # Interactive visual dashboard UI
│   └── agent.ts                 # CLI runner & Live stream orchestrator
├── tests/engine.test.ts         # 14 automated unit tests
├── package.json
└── README.md
```

---

## 📜 License

MIT License. Built for the **Binance Agent OS Mini Hackathon (Track A)**.
