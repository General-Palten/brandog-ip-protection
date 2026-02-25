import { useMemo } from 'react';
import type { ChatContextPayload } from './useChatContext';

export function useDynamicSuggestions(context: ChatContextPayload): string[] {
  return useMemo(() => {
    const suggestions: string[] = [];

    // Top platform share > 30%
    if (
      context.topRiskPlatform &&
      context.topRiskPlatformSharePct !== null &&
      context.topRiskPlatformSharePct > 30
    ) {
      suggestions.push(`What's happening on ${context.topRiskPlatform}?`);
    }

    // Legal risk signals exist
    if (context.legalRiskSignals.length > 0) {
      suggestions.push('Explain the legal risks');
    }

    // Critical cases exist
    const criticalCount = context.topCases.filter(c => c.priority === 'critical').length;
    if (criticalCount > 0) {
      suggestions.push(
        criticalCount === 1
          ? 'Show me the critical threat'
          : `Show me the ${criticalCount} critical threats`
      );
    }

    // Country violations > 5
    if (context.topCountry && context.topCountryViolations !== null && context.topCountryViolations > 5) {
      suggestions.push(`Analyze ${context.topCountry} violations`);
    }

    // High revenue at risk (potential loss > 0)
    if (context.potentialLossUsd > 0) {
      suggestions.push('Calculate total potential loss');
    }

    // Active threats > 0
    if (context.activeThreats > 0) {
      suggestions.push('Show recent infringements');
    }

    // Always include focus suggestion
    suggestions.push('What should I focus on?');

    // Limit to 6 suggestions max
    return suggestions.slice(0, 6);
  }, [
    context.topRiskPlatform,
    context.topRiskPlatformSharePct,
    context.legalRiskSignals,
    context.topCases,
    context.topCountry,
    context.topCountryViolations,
    context.potentialLossUsd,
    context.activeThreats,
  ]);
}
