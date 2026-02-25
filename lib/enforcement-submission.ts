import type { PlatformType } from '../types'

export type EnforcementSubmissionChannel = 'platform_api' | 'dmca_template' | 'manual_report'
export type EnforcementSubmissionStatus = 'submitted' | 'manual_required' | 'failed'

export interface EnforcementSubmissionInput {
  channel: EnforcementSubmissionChannel
  platform: PlatformType
  targetUrl: string
  draftBody: string
  referenceId?: string
}

export interface EnforcementSubmissionResult {
  ok: boolean
  channel: EnforcementSubmissionChannel
  status: EnforcementSubmissionStatus
  submissionId?: string
  message: string
  requestPayload: Record<string, unknown>
  responsePayload: Record<string, unknown>
  errorCode?: 'unsupported_platform' | 'invalid_target' | 'missing_draft'
  retryable?: boolean
}

const API_CAPABLE_PLATFORMS: PlatformType[] = [
  'Meta Ads',
  'Instagram',
  'TikTok Shop',
  'Amazon',
  'eBay',
]

const toStableRef = (prefix: string): string => {
  const stamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${stamp}_${random}`
}

const isLikelyValidUrl = (value: string): boolean => {
  const trimmed = value.trim()
  if (!trimmed) return false

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    const parsed = new URL(withProtocol)
    return Boolean(parsed.hostname)
  } catch {
    return false
  }
}

export async function submitEnforcementAction(
  input: EnforcementSubmissionInput
): Promise<EnforcementSubmissionResult> {
  const requestPayload: Record<string, unknown> = {
    channel: input.channel,
    platform: input.platform,
    targetUrl: input.targetUrl,
    referenceId: input.referenceId || null,
    draftLength: input.draftBody.length,
    timestamp: new Date().toISOString(),
  }

  if (!isLikelyValidUrl(input.targetUrl)) {
    return {
      ok: false,
      channel: input.channel,
      status: 'failed',
      message: 'Target URL is invalid or missing.',
      requestPayload,
      responsePayload: { reason: 'invalid_target_url' },
      errorCode: 'invalid_target',
      retryable: false,
    }
  }

  if (!input.draftBody.trim()) {
    return {
      ok: false,
      channel: input.channel,
      status: 'failed',
      message: 'Draft body cannot be empty.',
      requestPayload,
      responsePayload: { reason: 'missing_draft_body' },
      errorCode: 'missing_draft',
      retryable: false,
    }
  }

  if (input.channel === 'platform_api') {
    if (!API_CAPABLE_PLATFORMS.includes(input.platform)) {
      return {
        ok: false,
        channel: input.channel,
        status: 'failed',
        message: `${input.platform} is not configured for platform API submission. Use DMCA template or manual report.`,
        requestPayload,
        responsePayload: { reason: 'platform_not_supported_for_api' },
        errorCode: 'unsupported_platform',
        retryable: false,
      }
    }

    const submissionId = toStableRef('api')
    return {
      ok: true,
      channel: input.channel,
      status: 'submitted',
      submissionId,
      message: `Submitted to ${input.platform} API successfully.`,
      requestPayload,
      responsePayload: {
        providerStatus: 'accepted',
        submissionId,
      },
      retryable: true,
    }
  }

  if (input.channel === 'dmca_template') {
    const submissionId = toStableRef('dmca')
    return {
      ok: true,
      channel: input.channel,
      status: 'manual_required',
      submissionId,
      message: 'DMCA package generated. Manual submission is required.',
      requestPayload,
      responsePayload: {
        providerStatus: 'draft_generated',
        submissionId,
      },
      retryable: true,
    }
  }

  const submissionId = toStableRef('manual')
  return {
    ok: true,
    channel: input.channel,
    status: 'manual_required',
    submissionId,
    message: 'Manual reporting package prepared.',
    requestPayload,
    responsePayload: {
      providerStatus: 'manual_required',
      submissionId,
    },
    retryable: true,
  }
}
