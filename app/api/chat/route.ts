import { OpenRouter } from '@openrouter/sdk';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPENROUTER_MODEL = 'arcee-ai/trinity-large-preview:free';

interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CaseSummary {
  id: string;
  sellerName: string | null;
  platform: string;
  country: string;
  similarityScore: number;
  revenueAtRisk: number;
  status: string;
  detectedAt: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

interface DashboardChatContext {
  dateRangeLabel?: string;
  activeThreats?: number;
  potentialLossUsd?: number;
  revenueProtectedUsd?: number;
  detectionPrecisionPct?: number;
  falsePositiveRatePct?: number;
  duplicateRatePct?: number;
  enforcementSuccessRatePct?: number;
  enforcementAppealRatePct?: number;
  relistRatePct?: number;
  topRiskPlatform?: string | null;
  topRiskPlatformSharePct?: number | null;
  topCountry?: string | null;
  topCountryViolations?: number | null;
  legalRiskSignals?: Array<{ title?: string; detail?: string }>;
  topCases?: CaseSummary[];
  recentCases?: CaseSummary[];
  casesByPlatform?: Record<string, number>;
  totalCasesInRange?: number;
}

interface ChatRequestPayload {
  message?: unknown;
  history?: unknown;
  context?: unknown;
}

const SYSTEM_PROMPT = [
  'You are Brandog AI, an IP enforcement and brand protection assistant.',
  'Use the provided dashboard context as the source of truth for numbers.',
  'Respond in simple, practical English with short bullet points when useful.',
  'Do not invent metrics that are not provided in context.',
  'If data is missing, say what is missing and suggest the next best question.',
].join(' ');

const toSafeString = (value: unknown, maxLength = 500): string => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

const toSafeNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }
  return value;
};

const normalizeHistory = (rawHistory: unknown): HistoryMessage[] => {
  if (!Array.isArray(rawHistory)) return [];

  const normalized: HistoryMessage[] = [];
  for (const item of rawHistory) {
    if (!item || typeof item !== 'object') continue;

    const roleRaw = (item as Record<string, unknown>).role;
    const contentRaw = (item as Record<string, unknown>).content ?? (item as Record<string, unknown>).text;
    const content = toSafeString(contentRaw, 1200);
    if (!content) continue;

    const role = roleRaw === 'assistant' || roleRaw === 'model' ? 'assistant' : 'user';
    normalized.push({ role, content });
  }

  return normalized.slice(-10);
};

const normalizeCaseSummary = (raw: unknown): CaseSummary | null => {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const id = toSafeString(obj.id, 100);
  const platform = toSafeString(obj.platform, 80);
  const country = toSafeString(obj.country, 80);
  const status = toSafeString(obj.status, 40);
  const detectedAt = toSafeString(obj.detectedAt, 30);
  const similarityScore = toSafeNumber(obj.similarityScore);
  const revenueAtRisk = toSafeNumber(obj.revenueAtRisk);
  const priorityRaw = toSafeString(obj.priority, 20);
  const priority = ['critical', 'high', 'medium', 'low'].includes(priorityRaw)
    ? (priorityRaw as CaseSummary['priority'])
    : 'medium';

  if (!id || !platform) return null;

  return {
    id,
    sellerName: toSafeString(obj.sellerName, 120) || null,
    platform,
    country: country || 'Unknown',
    similarityScore: similarityScore ?? 0,
    revenueAtRisk: revenueAtRisk ?? 0,
    status: status || 'detected',
    detectedAt: detectedAt || '',
    priority,
  };
};

const normalizeContext = (rawContext: unknown): DashboardChatContext | null => {
  if (!rawContext || typeof rawContext !== 'object' || Array.isArray(rawContext)) {
    return null;
  }

  const source = rawContext as Record<string, unknown>;
  const legalRiskSignals = Array.isArray(source.legalRiskSignals)
    ? source.legalRiskSignals
        .slice(0, 3)
        .flatMap((signal) => {
          if (!signal || typeof signal !== 'object') return [];
          const signalObject = signal as Record<string, unknown>;
          const title = toSafeString(signalObject.title, 120);
          const detail = toSafeString(signalObject.detail, 260);
          if (!title && !detail) return [];
          return [{ title, detail }];
        })
        .filter((signal): signal is { title: string; detail: string } => Boolean(signal))
    : undefined;

  // Normalize top cases (limit to 10 for LLM context)
  const topCases = Array.isArray(source.topCases)
    ? source.topCases
        .slice(0, 10)
        .map(normalizeCaseSummary)
        .filter((c): c is CaseSummary => c !== null)
    : undefined;

  // Normalize recent cases (limit to 5)
  const recentCases = Array.isArray(source.recentCases)
    ? source.recentCases
        .slice(0, 5)
        .map(normalizeCaseSummary)
        .filter((c): c is CaseSummary => c !== null)
    : undefined;

  // Normalize cases by platform
  const casesByPlatform =
    source.casesByPlatform && typeof source.casesByPlatform === 'object' && !Array.isArray(source.casesByPlatform)
      ? Object.fromEntries(
          Object.entries(source.casesByPlatform as Record<string, unknown>)
            .filter(([, v]) => typeof v === 'number')
            .map(([k, v]) => [toSafeString(k, 80), v as number])
        )
      : undefined;

  return {
    dateRangeLabel: toSafeString(source.dateRangeLabel, 120) || undefined,
    activeThreats: toSafeNumber(source.activeThreats) ?? undefined,
    potentialLossUsd: toSafeNumber(source.potentialLossUsd) ?? undefined,
    revenueProtectedUsd: toSafeNumber(source.revenueProtectedUsd) ?? undefined,
    detectionPrecisionPct: toSafeNumber(source.detectionPrecisionPct) ?? undefined,
    falsePositiveRatePct: toSafeNumber(source.falsePositiveRatePct) ?? undefined,
    duplicateRatePct: toSafeNumber(source.duplicateRatePct) ?? undefined,
    enforcementSuccessRatePct: toSafeNumber(source.enforcementSuccessRatePct) ?? undefined,
    enforcementAppealRatePct: toSafeNumber(source.enforcementAppealRatePct) ?? undefined,
    relistRatePct: toSafeNumber(source.relistRatePct) ?? undefined,
    topRiskPlatform: toSafeString(source.topRiskPlatform, 80) || null,
    topRiskPlatformSharePct: toSafeNumber(source.topRiskPlatformSharePct),
    topCountry: toSafeString(source.topCountry, 80) || null,
    topCountryViolations: toSafeNumber(source.topCountryViolations),
    legalRiskSignals,
    topCases,
    recentCases,
    casesByPlatform,
    totalCasesInRange: toSafeNumber(source.totalCasesInRange) ?? undefined,
  };
};

const formatCurrency = (value: number): string => {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${value}`;
};

const buildContextSummary = (context: DashboardChatContext | null): string => {
  if (!context) {
    return 'Dashboard context: not provided.';
  }

  const lines = ['Dashboard context snapshot:'];

  if (context.dateRangeLabel) lines.push(`- Date range: ${context.dateRangeLabel}`);
  if (context.totalCasesInRange !== undefined) lines.push(`- Total cases in range: ${context.totalCasesInRange}`);
  if (context.activeThreats !== undefined) lines.push(`- Active threats: ${context.activeThreats}`);
  if (context.potentialLossUsd !== undefined) lines.push(`- Potential loss (USD): ${context.potentialLossUsd}`);
  if (context.revenueProtectedUsd !== undefined) lines.push(`- Revenue protected (USD): ${context.revenueProtectedUsd}`);
  if (context.detectionPrecisionPct !== undefined) lines.push(`- Detection precision: ${context.detectionPrecisionPct}%`);
  if (context.falsePositiveRatePct !== undefined) lines.push(`- False-positive rate: ${context.falsePositiveRatePct}%`);
  if (context.duplicateRatePct !== undefined) lines.push(`- Duplicate skip rate: ${context.duplicateRatePct}%`);
  if (context.enforcementSuccessRatePct !== undefined) lines.push(`- Enforcement success rate: ${context.enforcementSuccessRatePct}%`);
  if (context.enforcementAppealRatePct !== undefined) lines.push(`- Enforcement appeal rate: ${context.enforcementAppealRatePct}%`);
  if (context.relistRatePct !== undefined) lines.push(`- Re-list rate: ${context.relistRatePct}%`);
  if (context.topRiskPlatform) {
    lines.push(
      context.topRiskPlatformSharePct !== null && context.topRiskPlatformSharePct !== undefined
        ? `- Highest-risk platform: ${context.topRiskPlatform} (${context.topRiskPlatformSharePct}%)`
        : `- Highest-risk platform: ${context.topRiskPlatform}`
    );
  }
  if (context.topCountry) {
    lines.push(
      context.topCountryViolations !== null && context.topCountryViolations !== undefined
        ? `- Top region: ${context.topCountry} (${context.topCountryViolations} violations)`
        : `- Top region: ${context.topCountry}`
    );
  }

  if (context.legalRiskSignals && context.legalRiskSignals.length > 0) {
    lines.push('- Legal risk alerts:');
    context.legalRiskSignals.forEach((signal) => {
      const label = signal.title || 'Alert';
      const detail = signal.detail || 'No details';
      lines.push(`  - ${label}: ${detail}`);
    });
  }

  // Top priority cases
  if (context.topCases && context.topCases.length > 0) {
    lines.push('');
    lines.push('Top priority cases:');
    context.topCases.forEach((c, idx) => {
      const priorityLabel = c.priority.toUpperCase();
      const sellerInfo = c.sellerName ? c.sellerName : 'Unknown seller';
      lines.push(
        `  ${idx + 1}. [${priorityLabel}] ${sellerInfo} on ${c.platform} (${c.country}) - ${c.similarityScore}% match, ${formatCurrency(c.revenueAtRisk)} at risk, status: ${c.status}`
      );
    });
  }

  // Cases by platform
  if (context.casesByPlatform && Object.keys(context.casesByPlatform).length > 0) {
    lines.push('');
    lines.push('Cases by platform:');
    const sorted = Object.entries(context.casesByPlatform).sort((a, b) => b[1] - a[1]);
    sorted.forEach(([platform, count]) => {
      lines.push(`  - ${platform}: ${count} case${count !== 1 ? 's' : ''}`);
    });
  }

  return lines.join('\n');
};

export async function POST(request: NextRequest) {
  const apiKey = (process.env.OPENROUTER_API_KEY || '').trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OpenRouter key missing on server. Set OPENROUTER_API_KEY.' },
      { status: 500 }
    );
  }

  let payload: ChatRequestPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const userMessage = toSafeString(payload.message, 1200);
  if (!userMessage) {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
  }

  const normalizedHistory = normalizeHistory(payload.history);
  const context = normalizeContext(payload.context);

  const conversation: HistoryMessage[] = [...normalizedHistory];
  const lastMessage = conversation[conversation.length - 1];
  const shouldAppendUserMessage = !lastMessage || lastMessage.role !== 'user' || lastMessage.content !== userMessage;
  if (shouldAppendUserMessage) {
    conversation.push({ role: 'user', content: userMessage });
  }

  const client = new OpenRouter({ apiKey });

  try {
    const stream = await client.chat.send({
      chatGenerationParams: {
        model: OPENROUTER_MODEL,
        stream: true,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: buildContextSummary(context) },
          ...conversation,
        ],
      },
    });

    let reply = '';
    let reasoningTokens: number | null = null;

    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        reply += content;
      }

      const chunkReasoningTokens = chunk.usage?.completionTokensDetails?.reasoningTokens;
      if (typeof chunkReasoningTokens === 'number') {
        reasoningTokens = chunkReasoningTokens;
      }
    }

    return NextResponse.json({
      reply: reply.trim(),
      model: OPENROUTER_MODEL,
      reasoningTokens,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown OpenRouter error.';
    return NextResponse.json(
      {
        error: 'OpenRouter request failed.',
        detail: process.env.NODE_ENV !== 'production' ? message : undefined,
      },
      { status: 502 }
    );
  }
}
