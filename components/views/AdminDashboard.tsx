import React, { useState, useMemo } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { useAuth } from '../../context/AuthContext';
import { InfringementItem, InfringementStatus, CaseUpdateType } from '../../types';
import { CASE_UPDATE_TYPES } from '../../constants';
import { inferCaseTransitionAction } from '../../lib/case-status';
import { createWhitelistEntry } from '../../lib/data-service';
import StatusBadge from '../ui/StatusBadge';
import PlatformIcon from '../ui/PlatformIcon';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import {
  ExternalLink, CheckCircle, XCircle, PlayCircle,
  Eye, ChevronDown, ChevronUp, Shield, AlertTriangle, Clock, Send, MessageSquare, User, Mail, ArrowUpDown, RotateCcw, UserCheck,
  Search, Download, Calendar, X
} from 'lucide-react';

type SortColumn = 'caseId' | 'all' | 'new' | 'brand' | 'platform' | 'seller' | 'match' | 'status' | 'requested';
type SortDirection = 'asc' | 'desc';

const AdminDashboard: React.FC = () => {
  const { currentBrand } = useAuth();
  const {
    infringements,
    takedownRequests,
    updateTakedownStatus,
    getTakedownForCase,
    addCaseUpdate,
    getCaseUpdates,
    addNotification,
  } = useDashboard();

  const [selectedCase, setSelectedCase] = useState<InfringementItem | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | InfringementStatus>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'lastYear'>('all');
  const [selectedCases, setSelectedCases] = useState<Set<string>>(new Set());

  // Helper to get unread brand owner messages count for a case
  const getBrandOwnerMessageCount = (caseId: string) => {
    const request = getTakedownForCase(caseId);
    if (!request) return 0;
    return (request.updates || []).filter(u => u.createdBy === 'brand_owner').length;
  };

  // Helper to get last viewed timestamp from localStorage
  const getLastViewedAt = (caseId: string): number => {
    const stored = localStorage.getItem(`admin_case_viewed_${caseId}`);
    return stored ? parseInt(stored, 10) : 0;
  };

  // Helper to mark case as viewed
  const markCaseAsViewed = (caseId: string) => {
    localStorage.setItem(`admin_case_viewed_${caseId}`, Date.now().toString());
  };

  // Helper to get new messages count since last viewed
  const getNewMessageCount = (caseId: string) => {
    const lastViewed = getLastViewedAt(caseId);
    const updates = getCaseUpdates(caseId);
    if (!updates.length) return 0;
    return updates.filter(u => new Date(u.createdAt).getTime() > lastViewed).length;
  };

  // Handle opening case modal
  const handleOpenCase = (item: InfringementItem) => {
    setSelectedCase(item);
    markCaseAsViewed(item.id);
  };

  // Handle column sort toggle
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Get all cases - admin can see and work on any case
  const casesToShow = useMemo(() => {
    let filtered = infringements.filter(inf =>
      filterStatus === 'all' || inf.status === filterStatus
    );

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(inf =>
        inf.id.toLowerCase().includes(query) ||
        inf.brandName?.toLowerCase().includes(query) ||
        inf.sellerName?.toLowerCase().includes(query) ||
        inf.platform?.toLowerCase().includes(query)
      );
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisYearStart = new Date(now.getFullYear(), 0, 1);
      const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
      const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
      filtered = filtered.filter(inf => {
        const request = getTakedownForCase(inf.id);
        if (!request?.requestedAt) return false;
        const requestDate = new Date(request.requestedAt);
        switch (dateFilter) {
          case 'today':
            return requestDate >= today;
          case 'week':
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            return requestDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            return requestDate >= monthAgo;
          case 'year':
            return requestDate >= thisYearStart;
          case 'lastYear':
            return requestDate >= lastYearStart && requestDate <= lastYearEnd;
          default:
            return true;
        }
      });
    }

    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: any;
        let bVal: any;

        switch (sortColumn) {
          case 'caseId':
            aVal = a.id;
            bVal = b.id;
            break;
          case 'all':
            aVal = getBrandOwnerMessageCount(a.id);
            bVal = getBrandOwnerMessageCount(b.id);
            break;
          case 'new':
            aVal = getNewMessageCount(a.id);
            bVal = getNewMessageCount(b.id);
            break;
          case 'brand':
            aVal = a.brandName?.toLowerCase() || '';
            bVal = b.brandName?.toLowerCase() || '';
            break;
          case 'platform':
            aVal = a.platform?.toLowerCase() || '';
            bVal = b.platform?.toLowerCase() || '';
            break;
          case 'seller':
            aVal = a.sellerName?.toLowerCase() || '';
            bVal = b.sellerName?.toLowerCase() || '';
            break;
          case 'match':
            aVal = a.similarityScore || 0;
            bVal = b.similarityScore || 0;
            break;
          case 'status':
            aVal = a.status || '';
            bVal = b.status || '';
            break;
          case 'requested':
            const reqA = getTakedownForCase(a.id);
            const reqB = getTakedownForCase(b.id);
            aVal = reqA?.requestedAt ? new Date(reqA.requestedAt).getTime() : 0;
            bVal = reqB?.requestedAt ? new Date(reqB.requestedAt).getTime() : 0;
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [infringements, filterStatus, sortColumn, sortDirection, searchQuery, dateFilter]);

  // Stats - count all cases by status
  const stats = useMemo(() => ({
    pending_review: infringements.filter(i => i.status === 'pending_review' || i.status === 'needs_member_input').length,
    in_progress: infringements.filter(i => i.status === 'in_progress').length,
    resolved: infringements.filter(i => i.status === 'resolved_success' || i.status === 'resolved_partial' || i.status === 'resolved_failed').length,
    dismissed: infringements.filter(i => i.status === 'dismissed_by_member' || i.status === 'dismissed_by_admin').length,
  }), [infringements]);

  const normalizeWhitelistDomain = (input: string): string | null => {
    const raw = input.trim().toLowerCase();
    if (!raw) return null;
    const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw) ? raw : `https://${raw}`;
    try {
      const hostname = new URL(withProtocol).hostname.toLowerCase();
      return hostname.replace(/^www\./, '');
    } catch {
      return raw.replace(/^www\./, '');
    }
  };

  const handleStatusUpdate = (caseId: string, status: InfringementStatus) => {
    const caseItem = infringements.find(item => item.id === caseId);
    if (!caseItem) return;

    const transitionAction = inferCaseTransitionAction(caseItem.status, status);
    const normalizedNotes = (status === 'resolved' || status === 'rejected')
      ? (adminNotes.trim() || `Closure reason: marked ${status.replace('_', ' ')} by reviewer`)
      : adminNotes;
    updateTakedownStatus(caseId, status, normalizedNotes, transitionAction);
    setSelectedCase(null);
    setAdminNotes('');
  };

  const handleWhitelistCase = async (caseId: string) => {
    const caseItem = infringements.find(item => item.id === caseId);
    if (!caseItem || !currentBrand) {
      addNotification('error', 'A brand must be selected to whitelist this case');
      return;
    }

    const whitelistDomain = normalizeWhitelistDomain(caseItem.infringingUrl || caseItem.sellerName || '');
    if (!whitelistDomain) {
      addNotification('error', 'Unable to resolve a whitelist domain from this case');
      return;
    }

    const whitelistName = caseItem.sellerName?.trim() || whitelistDomain;
    const whitelistResult = await createWhitelistEntry(
      currentBrand.id,
      whitelistName,
      whitelistDomain,
      caseItem.platform
    );

    if (whitelistResult.error && whitelistResult.error !== 'duplicate') {
      addNotification('error', 'Failed to add whitelist entry');
      return;
    }

    if (whitelistResult.error === 'duplicate') {
      addNotification('info', `${whitelistDomain} is already whitelisted`);
    } else {
      addNotification('success', `Whitelisted ${whitelistDomain}`);
    }

    const nextNotes = adminNotes.trim()
      ? adminNotes
      : `Whitelisted trusted entity (${whitelistDomain})`;
    const transitionAction = 'company_whitelist';
    updateTakedownStatus(caseId, 'rejected', nextNotes, transitionAction);
    setSelectedCase(null);
    setAdminNotes('');
  };

  const getRequest = (caseId: string) => getTakedownForCase(caseId);

  // Bulk selection handlers
  const toggleCaseSelection = (caseId: string) => {
    setSelectedCases(prev => {
      const next = new Set(prev);
      if (next.has(caseId)) {
        next.delete(caseId);
      } else {
        next.add(caseId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedCases.size === casesToShow.length) {
      setSelectedCases(new Set());
    } else {
      setSelectedCases(new Set(casesToShow.map(c => c.id)));
    }
  };

  const handleBulkAction = (status: InfringementStatus) => {
    const actionLabel = status === 'in_progress'
      ? 'move selected cases to In Progress'
      : status === 'resolved'
        ? 'resolve selected cases'
        : status === 'rejected'
          ? 'reject selected cases'
          : `change selected cases to ${status.replace('_', ' ')}`;

    if (!window.confirm(`Confirm bulk action: ${actionLabel}?`)) {
      return;
    }

    selectedCases.forEach(caseId => {
      const caseItem = infringements.find(item => item.id === caseId);
      if (!caseItem) return;

      const transitionAction = inferCaseTransitionAction(caseItem.status, status);
      const normalizedNotes = (status === 'resolved' || status === 'rejected')
        ? `Closure reason: bulk action marked ${status.replace('_', ' ')}`
        : '';
      updateTakedownStatus(caseId, status, normalizedNotes, transitionAction);
    });
    setSelectedCases(new Set());
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Case ID', 'Brand', 'Platform', 'Seller', 'Match %', 'Status', 'Requested Date'];
    const rows = casesToShow.map(item => {
      const request = getRequest(item.id);
      return [
        item.id,
        item.brandName || '',
        item.platform || '',
        item.sellerName || '',
        item.similarityScore?.toString() || '',
        item.status || '',
        request?.requestedAt ? new Date(request.requestedAt).toLocaleDateString() : ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cases_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded">
              <Shield className="text-primary" size={24} />
            </div>
            <h1 className="font-serif text-3xl text-primary font-medium">Admin Dashboard</h1>
          </div>
          <p className="text-secondary text-sm">Review and process takedown requests from brand owners.</p>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={14} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cases..."
              className="pl-9 pr-4 py-2.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary w-48"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="appearance-none px-4 py-2.5 pr-10 bg-background border border-border rounded-lg text-sm font-medium focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="all">All Requests</option>
              <option value="pending_review">Pending Review</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="rejected">Rejected</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" size={14} />
          </div>

          {/* Date Filter */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={14} />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="appearance-none pl-9 pr-10 py-2.5 bg-background border border-border rounded-lg text-sm font-medium focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="lastYear">Last Year</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary pointer-events-none" size={14} />
          </div>

          {/* Export Button */}
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-background border border-border rounded-lg text-sm font-medium hover:bg-surface hover:border-primary transition-colors"
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-surface border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-yellow-500" />
            <p className="text-xs text-secondary uppercase tracking-wider">Pending Review</p>
          </div>
          <p className="text-3xl font-mono font-bold text-primary">{stats.pending_review}</p>
        </div>
        <div className="p-4 bg-surface border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-orange-500" />
            <p className="text-xs text-secondary uppercase tracking-wider">In Progress</p>
          </div>
          <p className="text-3xl font-mono font-bold text-primary">{stats.in_progress}</p>
        </div>
        <div className="p-4 bg-surface border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={14} className="text-green-500" />
            <p className="text-xs text-secondary uppercase tracking-wider">Resolved</p>
          </div>
          <p className="text-3xl font-mono font-bold text-primary">{stats.resolved}</p>
        </div>
        <div className="p-4 bg-surface border border-border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={14} className="text-gray-500" />
            <p className="text-xs text-secondary uppercase tracking-wider">Dismissed</p>
          </div>
          <p className="text-3xl font-mono font-bold text-primary">{stats.dismissed}</p>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedCases.size > 0 && (
        <div className="flex items-center gap-4 p-4 bg-surface border border-border rounded-lg">
          <span className="text-sm font-medium">{selectedCases.size} selected</span>
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkAction('in_progress')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-orange-500/10 border border-orange-500/30 rounded text-orange-500 hover:bg-orange-500/20 transition-colors"
            >
              <PlayCircle size={12} />
              Enforce
            </button>
            <button
              onClick={() => handleBulkAction('resolved')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-500/10 border border-green-500/30 rounded text-green-500 hover:bg-green-500/20 transition-colors"
            >
              <CheckCircle size={12} />
              Resolve
            </button>
            <button
              onClick={() => handleBulkAction('rejected')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500/10 border border-red-500/30 rounded text-red-500 hover:bg-red-500/20 transition-colors"
            >
              <XCircle size={12} />
              Reject
            </button>
          </div>
          <button
            onClick={() => setSelectedCases(new Set())}
            className="ml-auto text-xs text-secondary hover:text-primary transition-colors"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Cases Table */}
      {casesToShow.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-border rounded-lg">
          <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 text-secondary">
            <Shield size={24} />
          </div>
          <p className="text-secondary">No takedown requests matching your filter.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedCases.size === casesToShow.length && casesToShow.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-border bg-background cursor-pointer"
                  />
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('caseId')}
                >
                  <span className="flex items-center gap-1">
                    Case ID
                    {sortColumn === 'caseId' ? (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={12} className="opacity-30" />}
                  </span>
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-purple-400 uppercase tracking-wider cursor-pointer hover:text-purple-300 transition-colors"
                  onClick={() => handleSort('all')}
                >
                  <span className="flex items-center justify-center gap-1">
                    All
                    {sortColumn === 'all' ? (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={12} className="opacity-30" />}
                  </span>
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-medium text-white/60 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('new')}
                >
                  <span className="flex items-center justify-center gap-1">
                    New
                    {sortColumn === 'new' ? (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={12} className="opacity-30" />}
                  </span>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('brand')}
                >
                  <span className="flex items-center gap-1">
                    Brand
                    {sortColumn === 'brand' ? (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={12} className="opacity-30" />}
                  </span>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('platform')}
                >
                  <span className="flex items-center gap-1">
                    Platform
                    {sortColumn === 'platform' ? (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={12} className="opacity-30" />}
                  </span>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('seller')}
                >
                  <span className="flex items-center gap-1">
                    Seller
                    {sortColumn === 'seller' ? (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={12} className="opacity-30" />}
                  </span>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('match')}
                >
                  <span className="flex items-center gap-1">
                    Match
                    {sortColumn === 'match' ? (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={12} className="opacity-30" />}
                  </span>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <span className="flex items-center gap-1">
                    Status
                    {sortColumn === 'status' ? (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={12} className="opacity-30" />}
                  </span>
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider cursor-pointer hover:text-primary transition-colors"
                  onClick={() => handleSort('requested')}
                >
                  <span className="flex items-center gap-1">
                    Requested
                    {sortColumn === 'requested' ? (sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : <ArrowUpDown size={12} className="opacity-30" />}
                  </span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {casesToShow.map(item => {
                const request = getRequest(item.id);
                const brandOwnerMsgCount = getBrandOwnerMessageCount(item.id);
                const newMsgCount = getNewMessageCount(item.id);
                return (
                  <tr key={item.id} className={`hover:bg-surface/50 transition-colors ${selectedCases.has(item.id) ? 'bg-surface/30' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedCases.has(item.id)}
                        onChange={() => toggleCaseSelection(item.id)}
                        className="w-4 h-4 rounded border-border bg-background cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-primary">
                      #{item.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {brandOwnerMsgCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/30 rounded text-purple-500" title={`${brandOwnerMsgCount} message(s) from brand owner`}>
                          <User size={10} />
                          <span className="text-[10px] font-bold">{brandOwnerMsgCount}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {newMsgCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white/10 border border-white/30 rounded text-white" title={`${newMsgCount} new message(s) since last viewed`}>
                          <Mail size={10} />
                          <span className="text-[10px] font-bold">{newMsgCount}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-primary">{item.brandName}</td>
                    <td className="px-4 py-3">
                      <PlatformIcon platform={item.platform} size={16} showLabel />
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary truncate max-w-[150px]">{item.sellerName}</td>
                    <td className="px-4 py-3">
                      <span className={`font-mono text-sm ${item.similarityScore >= 90 ? 'text-red-500' : 'text-orange-500'}`}>
                        {item.similarityScore}%
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                    <td className="px-4 py-3 text-xs text-secondary font-mono">
                      {request?.requestedAt ? new Date(request.requestedAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenCase(item)}
                          className="p-1.5 hover:bg-surface border border-border rounded transition-colors"
                          title="Review"
                        >
                          <Eye size={14} />
                        </button>
                        {item.status === 'pending_review' && (
                          <>
                            <button
                              onClick={() => handleStatusUpdate(item.id, 'in_progress')}
                              className="p-1.5 hover:bg-orange-500/10 border border-border rounded text-orange-500 transition-colors"
                              title="Enforce"
                            >
                              <PlayCircle size={14} />
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(item.id, 'rejected')}
                              className="p-1.5 hover:bg-red-500/10 border border-border rounded text-red-500 transition-colors"
                              title="Dismiss"
                            >
                              <XCircle size={14} />
                            </button>
                            <button
                              onClick={() => handleWhitelistCase(item.id)}
                              className="p-1.5 hover:bg-blue-500/10 border border-border rounded text-blue-500 transition-colors"
                              title="Whitelist"
                            >
                              <UserCheck size={14} />
                            </button>
                          </>
                        )}
                        {item.status === 'in_progress' && (
                          <>
                            <button
                              onClick={() => handleStatusUpdate(item.id, 'resolved')}
                              className="p-1.5 hover:bg-green-500/10 border border-border rounded text-green-500 transition-colors"
                              title="Mark Resolved"
                            >
                              <CheckCircle size={14} />
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(item.id, 'rejected')}
                              className="p-1.5 hover:bg-red-500/10 border border-border rounded text-red-500 transition-colors"
                              title="Reject"
                            >
                              <XCircle size={14} />
                            </button>
                          </>
                        )}
                        {(item.status === 'resolved' || item.status === 'rejected') && (
                          <button
                            onClick={() => handleStatusUpdate(item.id, 'detected')}
                            className="p-1.5 hover:bg-blue-500/10 border border-border rounded text-blue-500 transition-colors"
                            title="Reopen as Detected"
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Modal */}
      {selectedCase && (
        <Modal
          isOpen={!!selectedCase}
          onClose={() => { setSelectedCase(null); setAdminNotes(''); setCustomMessage(''); }}
          title={`Review Case #${selectedCase.id.slice(0, 8)}`}
          size="4xl"
        >
          <div className="space-y-6 p-6">
            {/* Evidence comparison */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-secondary mb-2 uppercase tracking-wider">Original Asset</p>
                <div className="h-48 bg-surface border border-border rounded-lg overflow-hidden">
                  <img src={selectedCase.originalImage} alt="Original" className="w-full h-full object-contain" />
                </div>
              </div>
              <div>
                <p className="text-xs text-red-500 mb-2 uppercase tracking-wider">Infringing Listing</p>
                <div className="h-48 bg-surface border-2 border-red-500/30 rounded-lg overflow-hidden">
                  <img src={selectedCase.copycatImage} alt="Infringing" className="w-full h-full object-contain" />
                </div>
              </div>
            </div>

            {/* Case Details */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-surface border border-border rounded-lg">
              <div>
                <label className="block text-xs text-secondary mb-1">Match Score</label>
                <p className={`font-mono text-lg ${selectedCase.similarityScore >= 90 ? 'text-red-500' : 'text-orange-500'}`}>
                  {selectedCase.similarityScore}%
                </p>
              </div>
              <div>
                <label className="block text-xs text-secondary mb-1">Platform</label>
                <PlatformIcon platform={selectedCase.platform} size={16} showLabel />
              </div>
              <div>
                <label className="block text-xs text-secondary mb-1">Seller</label>
                <p className="text-sm text-primary truncate">{selectedCase.sellerName}</p>
              </div>
            </div>

            {/* WHOIS Info */}
            <div className="p-4 bg-zinc-950 text-zinc-400 font-mono text-xs rounded-lg border border-border">
              <div className="grid grid-cols-[120px_1fr] gap-y-2">
                <span>Registrar:</span> <span className="text-zinc-200">{selectedCase.whois?.registrar || 'Unknown'}</span>
                <span>Created:</span> <span className="text-zinc-200">{selectedCase.whois?.creationDate || 'Unknown'}</span>
                <span>Hosting:</span> <span className="text-zinc-200">{selectedCase.hosting?.provider || 'Unknown'}</span>
                <span>IP:</span> <span className="text-zinc-200">{selectedCase.hosting?.ipAddress || 'Unknown'}</span>
              </div>
            </div>

            {/* Infringing URL */}
            <div className="flex items-center justify-between p-3 bg-surface border border-border rounded-lg">
              <span className="text-xs text-secondary">Infringing URL:</span>
              <a
                href={selectedCase.infringingUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                {selectedCase.infringingUrl?.slice(0, 40)}... <ExternalLink size={12} />
              </a>
            </div>

            {/* Admin Notes */}
            <div>
              <label className="block text-sm font-medium mb-2">Admin Notes</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full h-24 p-3 bg-surface border border-border rounded-lg text-sm focus:outline-none focus:border-primary resize-none"
                placeholder="Add notes about this case..."
              />
            </div>

            {/* Send Update to Customer */}
            <div className="border-t border-border pt-6">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare size={16} className="text-primary" />
                <h4 className="font-medium text-sm">Send Update to Customer</h4>
              </div>

              {/* Quick Update Buttons */}
              <div className="mb-4">
                <label className="block text-xs text-secondary mb-2">Quick Status Updates</label>
                <div className="flex flex-wrap gap-2">
                  {CASE_UPDATE_TYPES.filter(u => u.type !== 'takedown_initiated').slice(0, 6).map(updateType => (
                    <button
                      key={updateType.type}
                      onClick={() => {
                        addCaseUpdate(selectedCase.id, updateType.type, updateType.description);
                      }}
                      className="px-3 py-1.5 text-xs border border-border rounded hover:bg-surface hover:border-primary transition-colors"
                      title={updateType.description}
                    >
                      {updateType.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Message */}
              <div className="space-y-2">
                <label className="block text-xs text-secondary">Or send custom message:</label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="w-full h-20 p-3 bg-surface border border-border rounded-lg text-sm resize-none focus:outline-none focus:border-primary"
                  placeholder="Type a custom update message for the customer..."
                />
                <Button
                  variant="outline"
                  icon={Send}
                  disabled={!customMessage.trim()}
                  onClick={() => {
                    addCaseUpdate(selectedCase.id, 'custom', customMessage);
                    setCustomMessage('');
                  }}
                >
                  Send Custom Update
                </Button>
              </div>

              {/* Case Conversation - Full width like brand owner view */}
              {getCaseUpdates(selectedCase.id).length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium text-primary flex items-center gap-2">
                      <MessageSquare size={16} />
                      Case Conversation
                    </h5>
                    <span className="text-xs text-secondary font-mono">
                      {getCaseUpdates(selectedCase.id).length} message{getCaseUpdates(selectedCase.id).length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {getCaseUpdates(selectedCase.id).slice().reverse().map((update, index) => {
                      const config = CASE_UPDATE_TYPES.find(c => c.type === update.type);
                      const isBrandOwner = update.createdBy === 'brand_owner';
                      const isLatest = index === 0;
                      return (
                        <div
                          key={update.id}
                          className={`p-4 border rounded-lg transition-all ${
                            isBrandOwner
                              ? 'border-purple-500/30 bg-purple-500/5 ml-8'
                              : isLatest
                              ? 'border-primary/30 bg-primary/5'
                              : 'border-border bg-surface/30'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded ${
                              isBrandOwner
                                ? 'bg-purple-500/10 text-purple-500'
                                : config?.isPositive
                                ? 'bg-green-500/10 text-green-500'
                                : 'bg-blue-500/10 text-blue-500'
                            }`}>
                              {isBrandOwner ? <User size={16} /> : config?.isPositive ? <CheckCircle size={16} /> : <Clock size={16} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-medium text-sm text-primary">
                                  {isBrandOwner ? 'Brand Owner Message' : config?.label || 'Update'}
                                </span>
                                {isLatest && (
                                  <span className="text-[10px] bg-white text-black px-1.5 py-0.5 rounded uppercase font-mono">
                                    Latest
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-secondary">{update.message}</p>
                              <p className="text-xs text-secondary/60 mt-2 font-mono">
                                {new Date(update.createdAt).toLocaleString()}
                                {update.createdBy === 'system' && ' • System'}
                                {update.createdBy === 'lawyer' && ' • You'}
                                {update.createdBy === 'brand_owner' && ' • Brand Owner'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              {selectedCase.status === 'pending_review' && (
                <>
                  <Button
                    variant="outline"
                    icon={PlayCircle}
                    onClick={() => handleStatusUpdate(selectedCase.id, 'in_progress')}
                  >
                    Enforce
                  </Button>
                  <Button
                    variant="ghost"
                    icon={XCircle}
                    className="text-red-500 hover:bg-red-500/10"
                    onClick={() => handleStatusUpdate(selectedCase.id, 'rejected')}
                  >
                    Dismiss
                  </Button>
                  <Button
                    variant="outline"
                    icon={UserCheck}
                    className="text-blue-500 hover:bg-blue-500/10"
                    onClick={() => handleWhitelistCase(selectedCase.id)}
                  >
                    Whitelist
                  </Button>
                </>
              )}
              {selectedCase.status === 'in_progress' && (
                <>
                  <Button
                    variant="primary"
                    icon={CheckCircle}
                    onClick={() => handleStatusUpdate(selectedCase.id, 'resolved')}
                  >
                    Mark Resolved
                  </Button>
                  <Button
                    variant="ghost"
                    icon={XCircle}
                    className="text-red-500 hover:bg-red-500/10"
                    onClick={() => handleStatusUpdate(selectedCase.id, 'rejected')}
                  >
                    Reject
                  </Button>
                </>
              )}
              {(selectedCase.status === 'resolved' || selectedCase.status === 'rejected') && (
                <>
                  <div className="flex-1 p-3 bg-surface border border-border rounded-lg text-center text-sm text-secondary">
                    This case has been {selectedCase.status}.
                  </div>
                  <Button
                    variant="outline"
                    icon={RotateCcw}
                    className="text-blue-500 hover:bg-blue-500/10"
                    onClick={() => handleStatusUpdate(selectedCase.id, 'detected')}
                  >
                    Reopen as Detected
                  </Button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminDashboard;
