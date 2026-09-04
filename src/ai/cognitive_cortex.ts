import { RadarMetrics, AbsorptionMetrics } from '../types/index.js';

export interface CortexEvaluation {
  approved: boolean;
  confidence: number;
  providerUsed: string;
  costUsd: number;
  objectionsConsidered: string[];
  reasoningThesis: string;
  latencyMs: number;
}

export type CortexProvider = 'heuristic' | 'anthropic' | 'groq' | 'local';

export class CognitiveCortex {
  private provider: CortexProvider;
  private apiKey?: string;

  constructor(provider?: CortexProvider, apiKey?: string) {
    if (provider) {
      this.provider = provider;
      this.apiKey = apiKey;
    } else if (process.env.ANTHROPIC_API_KEY) {
      this.provider = 'anthropic';
      this.apiKey = process.env.ANTHROPIC_API_KEY;
    } else if (process.env.GROQ_API_KEY) {
      this.provider = 'groq';
      this.apiKey = process.env.GROQ_API_KEY;
    } else {
      // Default to Zero-Cost, Zero-Key Heuristic Reasoner
      this.provider = 'heuristic';
    }
  }

  public getProvider(): CortexProvider {
    return this.provider;
  }

  /**
   * Evaluates market microstructure snapshot through an adversarial reasoning lens
   */
  public async evaluate(
    radar: RadarMetrics,
    absorption: AbsorptionMetrics,
    symbol: string
  ): Promise<CortexEvaluation> {
    const startTime = Date.now();

    if (this.provider === 'anthropic' && this.apiKey) {
      return this.evaluateWithAnthropic(radar, absorption, symbol, startTime);
    }

    // Default: High-fidelity Deterministic Heuristic Cortex (0 Cost, 0 Key)
    return this.evaluateHeuristic(radar, absorption, symbol, startTime);
  }

  /**
   * Deterministic Local Heuristic Reasoner (0 API keys required)
   * Emulates adversarial red-teaming checks deterministically
   */
  private evaluateHeuristic(
    radar: RadarMetrics,
    absorption: AbsorptionMetrics,
    symbol: string,
    startTime: number
  ): CortexEvaluation {
    const objections: string[] = [];

    // Objection 1: Check liquidation deceleration
    if (!absorption.liquidationDeceleration) {
      objections.push('Selling wave still exhibits high acceleration; potential secondary liquidation cascade ahead.');
    }

    // Objection 2: Orderbook depth sustainability
    if (absorption.orderbookImbalance < 0.20) {
      objections.push(`Orderbook imbalance (+${absorption.orderbookImbalance}) is weak; lack of institutional bid support.`);
    }

    // Objection 3: Size of cascade
    if (radar.rollingNotional10s < 300_000) {
      objections.push(`Liquidation volume ($${(radar.rollingNotional10s / 1000).toFixed(0)}k) is modest; insufficient market dislocation for safe mean reversion.`);
    }

    const approved = objections.length === 0;
    const confidence = approved ? 94 : Math.max(20, 90 - objections.length * 30);

    const reasoningThesis = approved
      ? `Adversarial checks passed. Liquidation wave of $${(radar.rollingNotional10s / 1000).toFixed(0)}k has decelerated, while top-5 bid imbalance (+${absorption.orderbookImbalance}) confirms institutional absorption at $${absorption.referencePrice.toFixed(2)}. Technical bounce expected.`
      : `Adversarial checks rejected sniper trigger. Objections: ${objections.join('; ')}`;

    return {
      approved,
      confidence,
      providerUsed: 'Deterministic-Local-Cortex (0-Cost)',
      costUsd: 0.0,
      objectionsConsidered: objections.length > 0 ? objections : ['No structural flaws detected in absorption profile.'],
      reasoningThesis,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Real LLM evaluation when ANTHROPIC_API_KEY is supplied
   */
  private async evaluateWithAnthropic(
    radar: RadarMetrics,
    absorption: AbsorptionMetrics,
    symbol: string,
    startTime: number
  ): Promise<CortexEvaluation> {
    try {
      const prompt = `You are the Chief Risk Officer for a high-frequency liquidation sniper agent on Binance.
Analyze this market microstructure snapshot:
- Asset: ${symbol}
- Rolling 10s Liquidations: $${(radar.rollingNotional10s / 1000).toFixed(1)}k
- Liquidation Decelerating: ${absorption.liquidationDeceleration}
- Orderbook Imbalance (OIB): ${absorption.orderbookImbalance} (-1 to +1)
- Reference Price: $${absorption.referencePrice}

Act as an adversarial skeptic: Is this a technical dislocation suitable for a quick bounce, or a dangerous falling knife?
Respond in strictly valid JSON:
{
  "approved": boolean,
  "confidence": number (0-100),
  "objections": ["objection 1", "objection 2"],
  "thesis": "one sentence explanation"
}`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-latest',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        throw new Error(`Anthropic API returned ${res.status}`);
      }

      const data = (await res.json()) as any;
      const text = data.content?.[0]?.text || '{}';
      const parsed = JSON.parse(text);

      return {
        approved: parsed.approved ?? true,
        confidence: parsed.confidence ?? 90,
        providerUsed: 'Claude-3.5-Haiku (Frontier BYOK)',
        costUsd: 0.0006, // ~$0.0006 per 300 token call
        objectionsConsidered: parsed.objections || [],
        reasoningThesis: parsed.thesis || 'Frontier analysis completed.',
        latencyMs: Date.now() - startTime,
      };
    } catch (err) {
      console.warn(`[CognitiveCortex] Fallback to local heuristic due to API error: ${(err as Error).message}`);
      return this.evaluateHeuristic(radar, absorption, symbol, startTime);
    }
  }
}
