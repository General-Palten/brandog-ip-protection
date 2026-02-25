import React, { useEffect, useMemo, useState } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import { submitEnforcementAction, type EnforcementSubmissionChannel } from '../../lib/enforcement-submission';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Gavel,
  ShieldCheck,
  Sparkles,
  User,
  XCircle
} from 'lucide-react';
import type { InfringementItem, TakedownRequest } from '../../types';

type PriorityLevel = 'high' | 'medium' | 'low';
type SubmissionChannel = EnforcementSubmissionChannel;
type OutcomeIngestStatus = 'response_pending' | 'content_removed' | 'denied' | 'counter_notice';
type QueueFilter = 'all' | 'mine' | 'high' | 'overdue';
type AssignmentId = 'unassigned' | 'you' | 'legal_team' | 'sarah_chen';
type EnforcingWorkspaceMode = 'lawyer' | 'member';

interface AssignmentState {
  assignee: AssignmentId;
  priority: PriorityLevel;
  slaDueAt: string;
}

interface EnforcingCase {
  infringement: InfringementItem;
  request: TakedownRequest | undefined;
  assignment: AssignmentState;
  offenderHistoryCount: number;
  updates: ReturnType<typeof useDashboard>['takedownRequests'][number]['updates'];
}

interface EnforcingWorkspaceProps {
  mode?: EnforcingWorkspaceMode;
}

const STORAGE_KEY = 'brandog_enforcement_assignments_v1';

const formatDateTime = (iso?: string): string => {
  if (!iso) return '-';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
};

const normalizeDomain = (value?: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
};

const defaultPriority = (item: InfringementItem, offenderHistoryCount: number): PriorityLevel => {
  if (item.similarityScore >= 90 || offenderHistoryCount >= 3) return 'high';
  if (item.similarityScore >= 75 || offenderHistoryCount >= 1) return 'medium';
  return 'low';
};

const defaultSlaDueAt = (request?: TakedownRequest): string => {
  const source = request?.processedAt || request?.requestedAt || new Date().toISOString();
  const base = new Date(source);
  if (Number.isNaN(base.getTime())) return new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  return new Date(base.getTime() + 48 * 60 * 60 * 1000).toISOString();
};

const priorityClass = (priority: PriorityLevel): string => {
  if (priority === 'high') return 'text-red-400 border-red-500/30 bg-red-500/10';
  if (priority === 'medium') return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
  return 'text-blue-400 border-blue-500/30 bg-blue-500/10';
};

const assigneeLabel = (assignee: AssignmentId, profileName?: string | null): string => {
  if (assignee === 'you') return profileName || 'You';
  if (assignee === 'sarah_chen') return 'Sarah Chen';
  if (assignee === 'legal_team') return 'Legal Team';
  return 'Unassigned';
};

const buildDraftTemplate = (item: InfringementItem, channel: SubmissionChannel): string => {
  const channelLabel = channel === 'platform_api'
    ? 'Platform API'
    : channel === 'dmca_template'
      ? 'DMCA Template'
      : 'Manual Report';

  return [
    `Channel: ${channelLabel}`,
    `Target URL: ${item.infringingUrl || 'Unknown URL'}`,
    `Platform: ${item.platform}`,
    `Seller: ${item.sellerName || 'Unknown seller'}`,
    `Similarity Score: ${item.similarityScore}%`,
    '',
    'Summary:',
    `This listing appears to infringe protected brand assets. Evidence includes source asset mapping and similarity scoring.`,
    '',
    'Requested action:',
    'Remove or disable access to the infringing listing and confirm completion.',
  ].join('\n');
};

const buildFollowUpDraft = (item: InfringementItem): string => {
  return [
    `Follow-up notice for ${item.platform}`,
    `Target URL: ${item.infringingUrl || 'Unknown URL'}`,
    '',
    'This is a follow-up regarding the previously submitted infringement report.',
    'Please provide status on removal action and expected resolution timeline.',
    '',
    'Evidence references are unchanged from the original submission.',
  ].join('\n');
};

const EnforcingWorkspace: React.FC<EnforcingWorkspaceProps> = ({ mode = 'lawyer' }) => {
  const { profile } = useAuth();
  const {
    infringements,
    takedownRequests,
    getCaseUpdates,
    addCaseUpdate,
    updateTakedownStatus,
    addNotification,
  } = useDashboard();

  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [submissionChannel, setSubmissionChannel] = useState<SubmissionChannel>('platform_api');
  const [submissionReference, setSubmissionReference] = useState('');
  const [outcomeIngestStatus, setOutcomeIngestStatus] = useState<OutcomeIngestStatus>('response_pending');
  const [approvalChecked, setApprovalChecked] = useState(false);
  const [internalNote, setInternalNote] = useState('');
  const [closureReason, setClosureReason] = useState('Outcome confirmed');
  const [assignmentByCase, setAssignmentByCase] = useState<Record<string, AssignmentState>>({});
  const isMemberView = mode === 'member';

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, AssignmentState>;
      if (parsed && typeof parsed === 'object') {
        setAssignmentByCase(parsed);
      }
    } catch {
      setAssignmentByCase({});
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assignmentByCase));
  }, [assignmentByCase]);

  const enforcementCases = useMemo<EnforcingCase[]>(() => {
    const active = infringements.filter((item) => {
      if (!isMemberView) {
        return item.status === 'in_progress';
      }

      const updates = getCaseUpdates(item.id);
      const hasCompanyEnforceSignal = updates.some((update) =>
        update.type === 'custom' && /company approved enforcement|enforcement handoff package prepared/i.test(update.message)
      );
      return hasCompanyEnforceSignal;
    });

    return active.map((item) => {
      const request = takedownRequests.find((req) => req.caseId === item.id);
      const currentDomain = normalizeDomain(item.infringingUrl);
      const offenderHistoryCount = infringements.filter((candidate) => {
        if (candidate.id === item.id) return false;
        const sameSeller = Boolean(
          item.sellerName &&
          candidate.sellerName &&
          item.sellerName.toLowerCase() === candidate.sellerName.toLowerCase()
        );
        const sameDomain = Boolean(
          currentDomain &&
          normalizeDomain(candidate.infringingUrl) &&
          currentDomain === normalizeDomain(candidate.infringingUrl)
        );
        return sameSeller || sameDomain;
      }).length;

      const assignment = assignmentByCase[item.id] || {
        assignee: 'legal_team',
        priority: defaultPriority(item, offenderHistoryCount),
        slaDueAt: defaultSlaDueAt(request),
      };

      return {
        infringement: item,
        request,
        assignment,
        offenderHistoryCount,
        updates: getCaseUpdates(item.id),
      };
    });
  }, [assignmentByCase, getCaseUpdates, infringements, isMemberView, takedownRequests]);

  const filteredCases = useMemo(() => {
    const now = Date.now();
    return enforcementCases.filter((entry) => {
      if (queueFilter === 'all') return true;
      if (queueFilter === 'mine') return entry.assignment.assignee === 'you';
      if (queueFilter === 'high') return entry.assignment.priority === 'high';
      if (queueFilter === 'overdue') {
        const due = Date.parse(entry.assignment.slaDueAt);
        return Number.isFinite(due) && due < now;
      }
      return true;
    });
  }, [enforcementCases, queueFilter]);

  useEffect(() => {
    if (!selectedCaseId && filteredCases.length > 0) {
      setSelectedCaseId(filteredCases[0].infringement.id);
      return;
    }

    if (selectedCaseId && !filteredCases.some((entry) => entry.infringement.id === selectedCaseId)) {
      setSelectedCaseId(filteredCases[0]?.infringement.id || null);
    }
  }, [filteredCases, selectedCaseId]);

  const selected = useMemo(() => {
    return enforcementCases.find((entry) => entry.infringement.id === selectedCaseId) || null;
  }, [enforcementCases, selectedCaseId]);

  const selectedLatestUpdate = selected && selected.updates.length > 0
    ? selected.updates[selected.updates.length - 1]
    : null;

  useEffect(() => {
    if (!selected) {
      setDraftText('');
      return;
    }
    setDraftText((current) => current || buildDraftTemplate(selected.infringement, submissionChannel));
  }, [selected, submissionChannel]);

  const setAssignment = async (
    caseId: string,
    next: Partial<AssignmentState>,
    logMessage?: string
  ) => {
    const existing = assignmentByCase[caseId] || {
      assignee: 'legal_team',
      priority: 'medium' as PriorityLevel,
      slaDueAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    };
    const merged: AssignmentState = {
      ...existing,
      ...next,
    };
    setAssignmentByCase((prev) => ({ ...prev, [caseId]: merged }));

    if (logMessage) {
      await addCaseUpdate(caseId, 'custom', logMessage, 'lawyer');
    }
  };

  const handleSubmitAction = async () => {
    if (!selected) return;
    if (!approvalChecked) {
      addNotification('error', 'Lawyer approval is required before submission');
      return;
    }

    const result = await submitEnforcementAction({
      channel: submissionChannel,
      platform: selected.infringement.platform,
      targetUrl: selected.infringement.infringingUrl || '',
      draftBody: draftText,
      referenceId: submissionReference.trim() || undefined,
    });

    if (!result.ok) {
      await addCaseUpdate(
        selected.infringement.id,
        'custom',
        [
          `Submission failed: ${result.message}`,
          `Error code: ${result.errorCode || 'unknown'}`,
          `Retryable: ${result.retryable ? 'yes' : 'no'}`,
          `Request: ${JSON.stringify(result.requestPayload)}`,
          `Response: ${JSON.stringify(result.responsePayload)}`,
        ].join('\n'),
        'lawyer'
      );
      addNotification('error', result.message);
      return;
    }

    const responseSummary = [
      `Submission channel: ${result.channel}`,
      `Submission status: ${result.status}`,
      `Submission ID: ${result.submissionId || 'n/a'}`,
      `Request payload: ${JSON.stringify(result.requestPayload)}`,
      `Response payload: ${JSON.stringify(result.responsePayload)}`,
      '',
      draftText,
    ].join('\n');

    if (submissionChannel === 'platform_api') {
      await addCaseUpdate(selected.infringement.id, 'platform_contacted', responseSummary, 'lawyer');
    } else if (submissionChannel === 'dmca_template') {
      await addCaseUpdate(selected.infringement.id, 'dmca_sent', responseSummary, 'lawyer');
    } else {
      await addCaseUpdate(selected.infringement.id, 'custom', responseSummary, 'lawyer');
    }

    await addCaseUpdate(
      selected.infringement.id,
      'awaiting_response',
      `Awaiting platform response after ${submissionChannel} submission.`,
      'lawyer'
    );

    if (internalNote.trim()) {
      await addCaseUpdate(
        selected.infringement.id,
        'custom',
        `Internal legal note: ${internalNote.trim()}`,
        'lawyer'
      );
      setInternalNote('');
    }

    addNotification('success', 'Enforcement submission logged');
    setApprovalChecked(false);
    setSubmissionReference(result.submissionId || '');
  };

  const handleSendFollowUp = async () => {
    if (!selected) return;
    const followUp = buildFollowUpDraft(selected.infringement);
    setDraftText(followUp);
    await addCaseUpdate(
      selected.infringement.id,
      'follow_up_sent',
      followUp,
      'lawyer'
    );
    await addCaseUpdate(
      selected.infringement.id,
      'awaiting_response',
      'Follow-up sent. Waiting for platform/legal response.',
      'lawyer'
    );
    addNotification('info', 'Follow-up draft sent to timeline');
  };

  const handleEscalate = async () => {
    if (!selected) return;
    await addCaseUpdate(
      selected.infringement.id,
      'escalated',
      `Escalation requested by legal team. Reason: ${closureReason}.`,
      'lawyer'
    );
    addNotification('info', 'Case escalated in timeline');
  };

  const handleIngestOutcome = async () => {
    if (!selected) return;

    if (outcomeIngestStatus === 'response_pending') {
      await addCaseUpdate(
        selected.infringement.id,
        'awaiting_response',
        'Platform response still pending. Next follow-up remains scheduled.',
        'lawyer'
      );
      addNotification('info', 'Pending outcome logged');
      return;
    }

    if (outcomeIngestStatus === 'content_removed') {
      await addCaseUpdate(
        selected.infringement.id,
        'content_removed',
        `Platform confirmed content removal. Reason: ${closureReason}.`,
        'lawyer'
      );
      await addCaseUpdate(
        selected.infringement.id,
        'case_closed',
        `Case closed as resolved. Reason: ${closureReason}.`,
        'lawyer'
      );
      await updateTakedownStatus(
        selected.infringement.id,
        'resolved',
        `Closure reason: ${closureReason}. Outcome source: platform_removed.`,
        'lawyer_resolve'
      );
      return;
    }

    if (outcomeIngestStatus === 'denied') {
      await addCaseUpdate(
        selected.infringement.id,
        'custom',
        `Platform denied enforcement request. Reason: ${closureReason}.`,
        'lawyer'
      );
      await addCaseUpdate(
        selected.infringement.id,
        'case_closed',
        `Case closed as rejected. Reason: ${closureReason}.`,
        'lawyer'
      );
      await updateTakedownStatus(
        selected.infringement.id,
        'rejected',
        `Closure reason: ${closureReason}. Outcome source: platform_denied.`,
        'lawyer_reject'
      );
      return;
    }

    await addCaseUpdate(
      selected.infringement.id,
      'escalated',
      `Counter-notice received. Escalating legal review. Reason: ${closureReason}.`,
      'lawyer'
    );
    addNotification('info', 'Counter-notice escalation logged');
  };

  const handleResolve = async () => {
    if (!selected) return;
    const notes = `Resolved by legal team. Reason: ${closureReason}.`;
    await updateTakedownStatus(selected.infringement.id, 'resolved', notes, 'lawyer_resolve');
  };

  const handleReject = async () => {
    if (!selected) return;
    const notes = `Closed as rejected by legal team. Reason: ${closureReason}.`;
    await updateTakedownStatus(selected.infringement.id, 'rejected', notes, 'lawyer_reject');
  };

  const getAICopilotHints = (entry: EnforcingCase): string[] => {
    const hints: string[] = [];
    if (entry.infringement.similarityScore >= 90) {
      hints.push('High-confidence visual match. Recommend fast-track takedown language.');
    }
    if (entry.offenderHistoryCount >= 2) {
      hints.push('Repeat offender pattern detected. Include prior incidents in notice context.');
    }
    if ((entry.infringement.siteVisitors || 0) > 5000) {
      hints.push('High traffic source. Prioritize submission and set shorter follow-up interval.');
    }
    if (!entry.infringement.sellerName) {
      hints.push('Seller identity is weak. Request platform account details in the notice.');
    }
    if (hints.length === 0) {
      hints.push('Evidence appears standard. Use baseline enforcement template with clear removal request.');
    }
    return hints;
  };

  const filterOptions: QueueFilter[] = isMemberView
    ? ['all', 'high', 'overdue']
    : ['all', 'mine', 'high', 'overdue'];

  if (enforcementCases.length === 0) {
    return (
      <div className="space-y-4 animate-in fade-in">
        <h1 className="font-serif text-3xl text-primary font-medium">Enforcing</h1>
        <div className="border border-dashed border-border rounded-lg p-10 text-center text-secondary">
          {isMemberView
            ? 'No cases have been moved to enforcement yet. Use Takedowns to mark cases for enforcement.'
            : 'No in-progress cases are currently assigned to legal enforcement.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-primary font-medium">Enforcing</h1>
          <p className="text-secondary mt-1 text-sm">
            {isMemberView
              ? 'Track the cases you marked for enforcement and view legal timeline updates.'
              : 'Lawyer workspace for active takedown execution.'}
          </p>
        </div>
        <div className="flex gap-2">
          {filterOptions.map((filter) => (
            <button
              key={filter}
              onClick={() => setQueueFilter(filter)}
              className={`px-3 py-1.5 text-xs border rounded ${
                queueFilter === filter
                  ? 'bg-primary text-inverse border-primary'
                  : 'border-border text-secondary hover:text-primary'
              }`}
            >
              {filter.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6 items-start">
        <aside className="border border-border rounded-lg bg-surface/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-xs uppercase tracking-wider text-secondary">
            {isMemberView ? 'Enforcement Tracker' : 'Lawyer Queue'} ({filteredCases.length})
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {filteredCases.map((entry) => {
              const isSelected = entry.infringement.id === selectedCaseId;
              const overdue = Date.parse(entry.assignment.slaDueAt) < Date.now();
              return (
                <button
                  key={entry.infringement.id}
                  onClick={() => {
                    setSelectedCaseId(entry.infringement.id);
                    setApprovalChecked(false);
                    setDraftText(buildDraftTemplate(entry.infringement, submissionChannel));
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-border last:border-b-0 transition-colors ${
                    isSelected ? 'bg-background' : 'hover:bg-background/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-primary truncate">{entry.infringement.brandName}</p>
                    <span className={`text-[10px] uppercase px-2 py-0.5 border rounded ${priorityClass(entry.assignment.priority)}`}>
                      {entry.assignment.priority}
                    </span>
                  </div>
                  <p className="text-xs text-secondary truncate">{entry.infringement.sellerName || 'Unknown seller'}</p>
                  <p className="text-[11px] text-secondary mt-1 truncate">{entry.infringement.platform}</p>
                  <p className="text-[10px] uppercase tracking-wider text-secondary mt-1">
                    {entry.infringement.status.replace('_', ' ')}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-secondary">
                    <span className="inline-flex items-center gap-1">
                      <User size={10} />
                      {assigneeLabel(entry.assignment.assignee, profile?.fullName)}
                    </span>
                    <span className={`inline-flex items-center gap-1 ${overdue ? 'text-red-400' : ''}`}>
                      <Clock size={10} />
                      {overdue ? 'Overdue' : 'Due'} {new Date(entry.assignment.slaDueAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {selected && (
          <section className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="p-4 border border-border rounded-lg bg-surface/40">
                <p className="text-xs text-secondary uppercase tracking-wider mb-1">Similarity</p>
                <p className="text-xl font-mono text-primary">{selected.infringement.similarityScore}%</p>
              </div>
              <div className="p-4 border border-border rounded-lg bg-surface/40">
                <p className="text-xs text-secondary uppercase tracking-wider mb-1">Offender History</p>
                <p className="text-xl font-mono text-primary">{selected.offenderHistoryCount}</p>
              </div>
              <div className="p-4 border border-border rounded-lg bg-surface/40">
                <p className="text-xs text-secondary uppercase tracking-wider mb-1">SLA Due</p>
                <p className="text-sm text-primary">{formatDateTime(selected.assignment.slaDueAt)}</p>
              </div>
            </div>

            {isMemberView ? (
              <div className="border border-border rounded-lg p-4 bg-surface/20 space-y-3">
                <h3 className="text-sm font-medium">Enforcement Progress</h3>
                <p className="text-sm text-secondary">
                  This case is in the legal enforcement pipeline. Timeline updates appear below as the legal team progresses.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="border border-border rounded p-3 bg-background/70">
                    <p className="uppercase tracking-wider text-secondary">Current Status</p>
                    <p className="text-primary mt-1">{selected.infringement.status.replace('_', ' ')}</p>
                  </div>
                  <div className="border border-border rounded p-3 bg-background/70">
                    <p className="uppercase tracking-wider text-secondary">Assigned Legal Owner</p>
                    <p className="text-primary mt-1">{assigneeLabel(selected.assignment.assignee, profile?.fullName)}</p>
                  </div>
                  <div className="border border-border rounded p-3 bg-background/70">
                    <p className="uppercase tracking-wider text-secondary">Latest Update</p>
                    <p className="text-primary mt-1">
                      {selectedLatestUpdate ? new Date(selectedLatestUpdate.createdAt).toLocaleString() : 'No updates yet'}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="border border-border rounded-lg p-4 bg-surface/30">
                    <label className="text-xs text-secondary uppercase tracking-wider">Assignee</label>
                    <select
                      value={selected.assignment.assignee}
                      onChange={async (e) => {
                        const nextAssignee = e.target.value as AssignmentId;
                        await setAssignment(
                          selected.infringement.id,
                          { assignee: nextAssignee },
                          `Lawyer assignment updated to ${assigneeLabel(nextAssignee, profile?.fullName)}.`
                        );
                      }}
                      className="mt-2 w-full bg-background border border-border px-3 py-2 text-sm rounded"
                    >
                      <option value="unassigned">Unassigned</option>
                      <option value="you">{profile?.fullName || 'You'}</option>
                      <option value="sarah_chen">Sarah Chen</option>
                      <option value="legal_team">Legal Team</option>
                    </select>
                  </div>

                  <div className="border border-border rounded-lg p-4 bg-surface/30">
                    <label className="text-xs text-secondary uppercase tracking-wider">Priority</label>
                    <select
                      value={selected.assignment.priority}
                      onChange={async (e) => {
                        const nextPriority = e.target.value as PriorityLevel;
                        await setAssignment(
                          selected.infringement.id,
                          { priority: nextPriority },
                          `Priority set to ${nextPriority}.`
                        );
                      }}
                      className="mt-2 w-full bg-background border border-border px-3 py-2 text-sm rounded"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  <div className="border border-border rounded-lg p-4 bg-surface/30">
                    <label className="text-xs text-secondary uppercase tracking-wider">SLA Due</label>
                    <input
                      type="datetime-local"
                      value={new Date(selected.assignment.slaDueAt).toISOString().slice(0, 16)}
                      onChange={async (e) => {
                        const nextIso = new Date(e.target.value).toISOString();
                        await setAssignment(
                          selected.infringement.id,
                          { slaDueAt: nextIso },
                          `SLA due date updated to ${new Date(nextIso).toLocaleString()}.`
                        );
                      }}
                      className="mt-2 w-full bg-background border border-border px-3 py-2 text-sm rounded"
                    />
                  </div>
                </div>

                <div className="border border-border rounded-lg p-4 bg-surface/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={16} className="text-amber-400" />
                    <h3 className="text-sm font-medium">AI Co-pilot Recommendations</h3>
                  </div>
                  <div className="space-y-2">
                    {getAICopilotHints(selected).map((hint, index) => (
                      <p key={index} className="text-sm text-secondary">{hint}</p>
                    ))}
                  </div>
                </div>

                <div className="border border-border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <FileText size={15} />
                      Draft + Submission
                    </h3>
                    <select
                      value={submissionChannel}
                      onChange={(e) => {
                        const channel = e.target.value as SubmissionChannel;
                        setSubmissionChannel(channel);
                        setDraftText(buildDraftTemplate(selected.infringement, channel));
                      }}
                      className="bg-background border border-border px-3 py-1.5 text-xs rounded"
                    >
                      <option value="platform_api">Platform API</option>
                      <option value="dmca_template">DMCA Template</option>
                      <option value="manual_report">Manual Report</option>
                    </select>
                  </div>

                  <textarea
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    className="w-full h-44 bg-background border border-border rounded p-3 text-sm font-mono"
                  />

                  <textarea
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    placeholder="Internal legal note (optional)"
                    className="w-full h-20 bg-background border border-border rounded p-3 text-sm"
                  />

                  <input
                    value={submissionReference}
                    onChange={(e) => setSubmissionReference(e.target.value)}
                    placeholder="Submission reference (ticket ID, case URL, etc.)"
                    className="w-full bg-background border border-border rounded px-3 py-2 text-sm"
                  />

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        id="lawyer-approval"
                        type="checkbox"
                        checked={approvalChecked}
                        onChange={(e) => setApprovalChecked(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <label htmlFor="lawyer-approval" className="text-sm text-secondary">
                        Lawyer approval confirmed
                      </label>
                    </div>
                    <input
                      value={closureReason}
                      onChange={(e) => setClosureReason(e.target.value)}
                      className="bg-background border border-border rounded px-3 py-2 text-sm"
                      placeholder="Closure reason"
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
                    <select
                      value={outcomeIngestStatus}
                      onChange={(e) => setOutcomeIngestStatus(e.target.value as OutcomeIngestStatus)}
                      className="bg-background border border-border rounded px-3 py-2 text-sm"
                    >
                      <option value="response_pending">Outcome: Pending response</option>
                      <option value="content_removed">Outcome: Content removed</option>
                      <option value="denied">Outcome: Denied</option>
                      <option value="counter_notice">Outcome: Counter-notice / dispute</option>
                    </select>
                    <button
                      onClick={handleIngestOutcome}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-border text-primary rounded text-sm"
                    >
                      <CheckCircle size={14} />
                      Ingest Outcome
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleSubmitAction}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-inverse rounded text-sm font-medium"
                    >
                      <Gavel size={14} />
                      Submit Enforcement Action
                    </button>
                    <button
                      onClick={handleSendFollowUp}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-amber-500/40 text-amber-300 rounded text-sm"
                    >
                      <Clock size={14} />
                      Send Follow-up
                    </button>
                    <button
                      onClick={handleEscalate}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-orange-500/40 text-orange-300 rounded text-sm"
                    >
                      <AlertTriangle size={14} />
                      Escalate
                    </button>
                    <button
                      onClick={handleResolve}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-green-500/40 text-green-400 rounded text-sm"
                    >
                      <ShieldCheck size={14} />
                      Mark Resolved
                    </button>
                    <button
                      onClick={handleReject}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-red-500/40 text-red-400 rounded text-sm"
                    >
                      <XCircle size={14} />
                      Close as Rejected
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="border border-border rounded-lg p-4 bg-surface/20">
              <h3 className="text-sm font-medium mb-3">Case Timeline</h3>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {selected.updates.length === 0 && (
                  <p className="text-xs text-secondary">No updates logged yet.</p>
                )}
                {selected.updates.map((update) => (
                  <div key={update.id} className="text-xs border border-border rounded p-2 bg-background/70">
                    <div className="flex justify-between gap-2">
                      <span className="uppercase tracking-wider text-secondary">{update.type}</span>
                      <span className="text-secondary">{new Date(update.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-primary whitespace-pre-wrap">{update.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border border-border rounded-lg bg-surface/20">
          <p className="text-xs uppercase tracking-wider text-secondary">High Priority</p>
          <p className="text-2xl font-mono mt-1">
            {enforcementCases.filter((entry) => entry.assignment.priority === 'high').length}
          </p>
        </div>
        <div className="p-4 border border-border rounded-lg bg-surface/20">
          <p className="text-xs uppercase tracking-wider text-secondary">Overdue SLA</p>
          <p className="text-2xl font-mono mt-1 text-red-400">
            {
              enforcementCases.filter((entry) => {
                const due = Date.parse(entry.assignment.slaDueAt);
                return Number.isFinite(due) && due < Date.now();
              }).length
            }
          </p>
        </div>
        <div className="p-4 border border-border rounded-lg bg-surface/20">
          <p className="text-xs uppercase tracking-wider text-secondary">Awaiting Response</p>
          <p className="text-2xl font-mono mt-1">
            {
              enforcementCases.filter((entry) =>
                entry.updates.some((update) => update.type === 'awaiting_response')
              ).length
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default EnforcingWorkspace;
