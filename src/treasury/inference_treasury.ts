import crypto from 'node:crypto';

export interface X402Receipt {
  receiptId: string;
  timestamp: number;
  provider: string;
  costUsd: number;
  promptTokens: number;
  completionTokens: number;
  balanceAfter: number;
  sha256Proof: string;
}

export interface TreasuryStats {
  balanceUsd: number;
  totalEarnedFromProfits: number;
  totalSpentOnInference: number;
  totalInferenceCalls: number;
  isSelfSustaining: boolean;
}

export class InferenceTreasury {
  private balanceUsd: number;
  private totalEarned: number = 0;
  private totalSpent: number = 0;
  private receipts: X402Receipt[] = [];

  constructor(initialSeedUsd: number = 1.0) {
    this.balanceUsd = initialSeedUsd; // Start with $1.00 seed (enough for ~500 cold-wakes)
  }

  /**
   * Deposit a microscopic cut (1% of net profit, min $0.02) from a winning trade
   */
  public recordTradeProfit(pnlUsd: number): number {
    if (pnlUsd <= 0) return 0;

    const microCut = Number(Math.max(0.02, pnlUsd * 0.01).toFixed(4));
    this.balanceUsd += microCut;
    this.totalEarned += microCut;
    return microCut;
  }

  /**
   * Pay for an inference call and emit an x402 micropayment receipt
   */
  public payInference(
    provider: string,
    costUsd: number,
    promptTokens: number = 0,
    completionTokens: number = 0
  ): X402Receipt {
    this.balanceUsd = Number(Math.max(0, this.balanceUsd - costUsd).toFixed(4));
    this.totalSpent = Number((this.totalSpent + costUsd).toFixed(4));

    const receiptId = `X402_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const timestamp = Date.now();

    const rawProof = JSON.stringify({
      receiptId,
      timestamp,
      provider,
      costUsd,
      promptTokens,
      completionTokens,
      balanceAfter: this.balanceUsd,
    });

    const sha256Proof = crypto.createHash('sha256').update(rawProof).digest('hex');

    const receipt: X402Receipt = {
      receiptId,
      timestamp,
      provider,
      costUsd,
      promptTokens,
      completionTokens,
      balanceAfter: this.balanceUsd,
      sha256Proof,
    };

    this.receipts.push(receipt);
    return receipt;
  }

  public getStats(): TreasuryStats {
    return {
      balanceUsd: Number(this.balanceUsd.toFixed(4)),
      totalEarnedFromProfits: Number(this.totalEarned.toFixed(4)),
      totalSpentOnInference: Number(this.totalSpent.toFixed(4)),
      totalInferenceCalls: this.receipts.length,
      isSelfSustaining: this.totalEarned >= this.totalSpent,
    };
  }

  public getReceipts(): X402Receipt[] {
    return [...this.receipts];
  }
}
