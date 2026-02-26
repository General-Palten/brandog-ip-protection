export type RevenueScoringOrder = 'openrouter_first' | 'deterministic_first';

export interface RevenueSignal {
  link: string;
  platform?: string;
  priceValue?: number;
  currency?: string;
  rating?: number;
  reviewsCount?: number;
  inStock?: boolean;
  position?: number;
  confidence?: number;
  similarityScore?: number;
}

export interface RevenueScoreResult {
  revenueAtRiskUsd: number;
  confidence: number;
  modelProvider: 'openrouter' | 'deterministic';
  modelName?: string;
  fallbackUsed: boolean;
  scoreJson: Record<string, unknown>;
  explainabilityJson: Record<string, unknown>;
}

interface ScoreRevenueOptions {
  order: RevenueScoringOrder;
  openRouterApiKey?: string;
  model?: string;
  maxTokens?: number;
}

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const toUsd = (value: number, currency?: string): number => {
  const code = (currency || 'USD').toUpperCase();
  const fx: Record<string, number> = {
    USD: 1,
    EUR: 1.08,
    GBP: 1.26,
    CAD: 0.74,
    AUD: 0.66,
    JPY: 0.0067,
    CNY: 0.14,
    SEK: 0.095,
    NOK: 0.093,
    DKK: 0.145,
  };
  return value * (fx[code] || 1);
};

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const deterministicScore = (signals: RevenueSignal[]): RevenueScoreResult => {
  const pricedSignals = signals.filter((signal) =>
    typeof signal.priceValue === 'number' && Number.isFinite(signal.priceValue) && signal.priceValue > 0
  );

  const priceSamplesUsd = pricedSignals.map((signal) => toUsd(signal.priceValue as number, signal.currency));
  const medianPriceUsd = median(priceSamplesUsd);
  const basePriceUsd = medianPriceUsd > 0 ? medianPriceUsd : 45;

  const positionScores = signals
    .map((signal) => signal.position)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
  const bestPosition = positionScores.length > 0 ? Math.min(...positionScores) : 20;
  const visibilityFactor = bestPosition <= 3 ? 1.3 : bestPosition <= 10 ? 1.05 : 0.82;

  const reviewSignals = signals
    .map((signal) => signal.reviewsCount)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);
  const ratingSignals = signals
    .map((signal) => signal.rating)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);

  const avgReviews = reviewSignals.length > 0
    ? reviewSignals.reduce((sum, value) => sum + value, 0) / reviewSignals.length
    : 0;
  const avgRating = ratingSignals.length > 0
    ? ratingSignals.reduce((sum, value) => sum + value, 0) / ratingSignals.length
    : 0;
  const demandFactor = 1 + Math.min(avgReviews / 1000, 0.45) + Math.min(avgRating / 10, 0.35);

  const inStockSignals = signals.filter((signal) => typeof signal.inStock === 'boolean');
  const inStockRatio = inStockSignals.length > 0
    ? inStockSignals.filter((signal) => signal.inStock).length / inStockSignals.length
    : 0.6;
  const stockFactor = 0.7 + (inStockRatio * 0.45);

  const confidenceSignals = signals
    .map((signal) => signal.confidence)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const avgMatchConfidence = confidenceSignals.length > 0
    ? confidenceSignals.reduce((sum, value) => sum + value, 0) / confidenceSignals.length
    : 0.65;

  const similaritySignals = signals
    .map((signal) => signal.similarityScore)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const avgSimilarity = similaritySignals.length > 0
    ? similaritySignals.reduce((sum, value) => sum + value, 0) / similaritySignals.length
    : 75;
  const similarityFactor = clamp(avgSimilarity / 100, 0.45, 1);

  const recurrenceFactor = 1 + Math.min(Math.max(signals.length - 1, 0) * 0.12, 0.8);
  const commerceCompleteness = clamp(pricedSignals.length / Math.max(signals.length, 1), 0, 1);

  const monthlyUnitsAtRisk = 7 * visibilityFactor * demandFactor * stockFactor * similarityFactor * recurrenceFactor;
  const revenueAtRiskUsd = clamp(basePriceUsd * monthlyUnitsAtRisk, 0, 500000);
  const confidence = clamp((avgMatchConfidence * 0.65) + (commerceCompleteness * 0.35), 0.2, 0.99);

  return {
    revenueAtRiskUsd: Number(revenueAtRiskUsd.toFixed(2)),
    confidence: Number(confidence.toFixed(4)),
    modelProvider: 'deterministic',
    modelName: 'deterministic_v1',
    fallbackUsed: false,
    scoreJson: {
      basePriceUsd: Number(basePriceUsd.toFixed(2)),
      monthlyUnitsAtRisk: Number(monthlyUnitsAtRisk.toFixed(4)),
      visibilityFactor: Number(visibilityFactor.toFixed(4)),
      demandFactor: Number(demandFactor.toFixed(4)),
      stockFactor: Number(stockFactor.toFixed(4)),
      similarityFactor: Number(similarityFactor.toFixed(4)),
      recurrenceFactor: Number(recurrenceFactor.toFixed(4)),
      avgSimilarity: Number(avgSimilarity.toFixed(2)),
      signalsAnalyzed: signals.length,
      pricedSignals: pricedSignals.length,
    },
    explainabilityJson: {
      method: 'deterministic',
      notes: [
        'Uses listing price, visibility position, review/rating demand proxy, stock signal, and confidence.',
        'Output is a bounded estimate for prioritization, not accounting guidance.',
      ],
    },
  };
};

const safeParseJsonObject = (value: string): Record<string, any> | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, any>;
    }
    return null;
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        const parsed = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, any>;
        }
      } catch {
        return null;
      }
    }
    return null;
  }
};

const scoreWithOpenRouter = async (
  signals: RevenueSignal[],
  apiKey: string,
  model: string,
  maxTokens: number
): Promise<RevenueScoreResult | null> => {
  const payload = {
    model,
    temperature: 0,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'You estimate monthly revenue-at-risk for suspected infringing listings.',
          'Return strict JSON only with fields:',
          'revenue_at_risk_usd (number), confidence (0..1), rationale (string), factors (array of short strings).',
          'Be conservative and avoid inflated estimates.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          listing_count: signals.length,
          listings: signals.slice(0, 20).map((signal) => ({
            link: signal.link,
            price: signal.priceValue,
            currency: signal.currency,
            rating: signal.rating,
            reviews: signal.reviewsCount,
            in_stock: signal.inStock,
            position: signal.position,
            confidence: signal.confidence,
            similarity_score: signal.similarityScore,
          })),
        }),
      },
    ],
  };

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return null;
    }

    const rawContent = data?.choices?.[0]?.message?.content;
    if (typeof rawContent !== 'string') return null;
    const parsed = safeParseJsonObject(rawContent);
    if (!parsed) return null;

    const revenueAtRiskRaw = Number(parsed.revenue_at_risk_usd);
    const confidenceRaw = Number(parsed.confidence);

    if (!Number.isFinite(revenueAtRiskRaw) || revenueAtRiskRaw < 0) return null;
    if (!Number.isFinite(confidenceRaw)) return null;

    const boundedRevenue = clamp(revenueAtRiskRaw, 0, 5000000);
    const boundedConfidence = clamp(confidenceRaw, 0, 1);
    const factors = Array.isArray(parsed.factors)
      ? parsed.factors.filter((item: unknown) => typeof item === 'string').slice(0, 8)
      : [];

    return {
      revenueAtRiskUsd: Number(boundedRevenue.toFixed(2)),
      confidence: Number(boundedConfidence.toFixed(4)),
      modelProvider: 'openrouter',
      modelName: model,
      fallbackUsed: false,
      scoreJson: {
        revenue_at_risk_usd: Number(boundedRevenue.toFixed(2)),
        confidence: Number(boundedConfidence.toFixed(4)),
      },
      explainabilityJson: {
        rationale: typeof parsed.rationale === 'string' ? parsed.rationale : '',
        factors,
      },
    };
  } catch {
    return null;
  }
};

export const scoreRevenue = async (
  signals: RevenueSignal[],
  options: ScoreRevenueOptions
): Promise<RevenueScoreResult> => {
  const order = options.order;
  const openRouterApiKey = (options.openRouterApiKey || '').trim();
  const model = (options.model || 'arcee-ai/trinity-large-preview:free').trim();
  const maxTokens = clamp(options.maxTokens || 500, 100, 4000);

  const deterministic = deterministicScore(signals);
  if (order === 'deterministic_first' || !openRouterApiKey) {
    return deterministic;
  }

  const openRouter = await scoreWithOpenRouter(signals, openRouterApiKey, model, maxTokens);
  if (openRouter) return openRouter;

  return {
    ...deterministic,
    fallbackUsed: true,
    explainabilityJson: {
      ...deterministic.explainabilityJson,
      fallbackReason: 'openrouter_unavailable_or_invalid',
    },
  };
};
