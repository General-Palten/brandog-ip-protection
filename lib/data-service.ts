/**
 * Data service layer for Supabase operations
 * Provides functions to interact with the database when Supabase is configured
 */

import { supabase, isSupabaseConfigured } from './supabase'
import { CaseTransitionAction, inferCaseTransitionAction, validateCaseStatusTransition } from './case-status'
import type {
  Infringement,
  InfringementInsert,
  Keyword,
  KeywordInsert,
  TakedownRequest,
  TakedownRequestInsert,
  CaseUpdate,
  CaseUpdateInsert,
  Asset,
  AssetInsert,
  ActivityLog,
  ActivityLogInsert,
  Brand,
  BrandInsert,
  Whitelist,
  IPDocument,
} from './database.types'
import type {
  InfringementItem,
  InfringementStatus,
  KeywordItem,
  TakedownRequest as LocalTakedownRequest,
  CaseUpdate as LocalCaseUpdate,
  PersistedAsset,
  ActivityLogItem,
} from '../types'

// ============================================
// TRANSFORMATION FUNCTIONS
// Convert between database types and local types
// ============================================

export function transformInfringement(dbInfringement: Infringement, brandName: string = 'Unknown'): InfringementItem {
  return {
    id: dbInfringement.id,
    brandName,
    isTrademarked: false, // Would need to join with brand
    originalImage: '', // Loaded separately from storage
    copycatImage: dbInfringement.copycat_image_url || '',
    similarityScore: dbInfringement.similarity_score || 0,
    siteVisitors: dbInfringement.site_visitors || 0,
    platform: dbInfringement.platform as InfringementItem['platform'],
    revenueLost: Number(dbInfringement.revenue_lost) || 0,
    status: dbInfringement.status as InfringementItem['status'],
    detectedAt: dbInfringement.detected_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    detectionProvider: dbInfringement.detection_provider || undefined,
    detectionMethod: dbInfringement.detection_method || undefined,
    sourceFingerprint: dbInfringement.source_fingerprint || undefined,
    country: dbInfringement.country || 'Unknown',
    originalAssetId: dbInfringement.original_asset_id || undefined,
    infringingUrl: dbInfringement.infringing_url || undefined,
    sellerName: dbInfringement.seller_name || undefined,
    whois: {
      registrar: dbInfringement.whois_registrar || 'Unknown',
      creationDate: dbInfringement.whois_creation_date || 'Unknown',
      registrantCountry: dbInfringement.whois_registrant_country || 'Unknown',
    },
    hosting: {
      provider: dbInfringement.hosting_provider || 'Unknown',
      ipAddress: dbInfringement.hosting_ip_address || 'Unknown',
    },
  }
}

export function transformKeyword(dbKeyword: Keyword): KeywordItem {
  return {
    id: dbKeyword.id,
    text: dbKeyword.text,
    tags: dbKeyword.tags || [],
    matches: dbKeyword.matches_count || 0,
    type: dbKeyword.type as KeywordItem['type'],
    trend: dbKeyword.trend as KeywordItem['trend'] | undefined,
  }
}

export function transformAsset(dbAsset: Asset): PersistedAsset {
  return {
    id: dbAsset.id,
    type: dbAsset.type as PersistedAsset['type'],
    name: dbAsset.name,
    mimeType: dbAsset.mime_type,
    protected: dbAsset.is_protected,
    dateAdded: new Date(dbAsset.created_at).getTime(),
    sourceUrl: dbAsset.source_url || undefined,
    content: dbAsset.content || undefined,
    fingerprint: dbAsset.fingerprint || undefined,
    scanStatus: dbAsset.scan_status || undefined,
    scanAttempts: dbAsset.scan_attempts ?? undefined,
    lastScannedAt: dbAsset.last_scanned_at || undefined,
    nextScanAt: dbAsset.next_scan_at || undefined,
    scanProvider: dbAsset.scan_provider || undefined,
    lastScanError: dbAsset.last_scan_error || undefined,
  }
}

export function transformActivityLog(dbLog: ActivityLog): ActivityLogItem {
  return {
    id: dbLog.id,
    action: dbLog.action,
    target: dbLog.target,
    user: 'You', // Would need to join with profiles
    timestamp: new Date(dbLog.created_at),
    type: dbLog.log_type as ActivityLogItem['type'],
    icon: dbLog.icon || undefined,
  }
}

// ============================================
// INFRINGEMENTS
// ============================================

export async function fetchInfringements(brandId: string): Promise<InfringementItem[]> {
  if (!isSupabaseConfigured()) return []

  const { data: brand } = await supabase
    .from('brands')
    .select('name, is_trademarked')
    .eq('id', brandId)
    .single()

  const { data, error } = await supabase
    .from('infringements')
    .select('*')
    .eq('brand_id', brandId)
    .order('detected_at', { ascending: false })

  if (error) {
    console.error('Error fetching infringements:', error)
    return []
  }

  return (data || []).map(inf => transformInfringement(inf, brand?.name || 'Unknown'))
}

export async function createInfringement(
  brandId: string,
  infringement: Omit<InfringementInsert, 'brand_id'>
): Promise<Infringement | null> {
  if (!isSupabaseConfigured()) return null

  const { data, error } = await supabase
    .from('infringements')
    .insert({ ...infringement, brand_id: brandId })
    .select()
    .single()

  if (error) {
    console.error('Error creating infringement:', error)
    return null
  }

  return data
}

export async function updateInfringementStatus(
  id: string,
  status: InfringementItem['status'],
  transitionAction?: CaseTransitionAction
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const { data: existing, error: fetchError } = await supabase
    .from('infringements')
    .select('status')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    console.error('Error reading current infringement status:', fetchError)
    return false
  }

  const transitionValidation = validateCaseStatusTransition(
    existing.status as InfringementStatus,
    status,
    transitionAction || inferCaseTransitionAction(existing.status as InfringementStatus, status)
  )
  if (!transitionValidation.ok) {
    const transitionError = 'error' in transitionValidation ? transitionValidation.error : null
    console.error('Invalid infringement status transition:', transitionError)
    return false
  }

  const { error } = await supabase
    .from('infringements')
    .update({ status })
    .eq('id', id)

  if (error) {
    console.error('Error updating infringement status:', error)
    return false
  }

  return true
}

// ============================================
// KEYWORDS
// ============================================

export async function fetchKeywords(brandId: string): Promise<KeywordItem[]> {
  if (!isSupabaseConfigured()) return []

  const { data, error } = await supabase
    .from('keywords')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching keywords:', error)
    return []
  }

  return (data || []).map(transformKeyword)
}

export async function createKeyword(
  brandId: string,
  text: string,
  type: KeywordItem['type']
): Promise<Keyword | null> {
  if (!isSupabaseConfigured()) return null

  const { data, error } = await supabase
    .from('keywords')
    .insert({
      brand_id: brandId,
      text,
      type,
      tags: ['Manual'],
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating keyword:', error)
    return null
  }

  return data
}

export async function deleteKeyword(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const { error } = await supabase
    .from('keywords')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting keyword:', error)
    return false
  }

  return true
}

// ============================================
// TAKEDOWN REQUESTS
// ============================================

export async function fetchTakedownRequests(brandId: string): Promise<any[]> {
  if (!isSupabaseConfigured()) return []

  const { data, error } = await supabase
    .from('takedown_requests')
    .select(`
      *,
      infringement:infringements!inner(brand_id),
      case_updates(*)
    `)
    .eq('infringement.brand_id', brandId)
    .order('requested_at', { ascending: false })

  if (error) {
    console.error('Error fetching takedown requests:', error)
    return []
  }

  return data || []
}

export async function createTakedownRequest(
  infringementId: string,
  initialMessage: string
): Promise<TakedownRequest | null> {
  if (!isSupabaseConfigured()) return null

  // Create the takedown request
  const { data: takedown, error: takedownError } = await supabase
    .from('takedown_requests')
    .insert({
      infringement_id: infringementId,
      status: 'pending_review',
    })
    .select()
    .single()

  if (takedownError) {
    console.error('Error creating takedown request:', takedownError)
    return null
  }

  // Create initial case update
  await supabase
    .from('case_updates')
    .insert({
      takedown_id: takedown.id,
      update_type: 'takedown_initiated',
      message: initialMessage,
      created_by: 'system',
    })

  // Update infringement status
  const statusUpdated = await updateInfringementStatus(
    infringementId,
    'pending_review',
    'agent_detection_complete'
  )
  if (!statusUpdated) {
    console.error('Error updating infringement status during takedown creation')
  }

  return takedown
}

export async function updateTakedownStatus(
  takedownId: string,
  status: string,
  adminNotes?: string,
  transitionAction?: CaseTransitionAction
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const typedStatus = status as InfringementStatus
  const { data: existing, error: fetchError } = await supabase
    .from('takedown_requests')
    .select('status')
    .eq('id', takedownId)
    .single()

  if (fetchError || !existing) {
    console.error('Error reading current takedown status:', fetchError)
    return false
  }

  const transitionValidation = validateCaseStatusTransition(
    existing.status as InfringementStatus,
    typedStatus,
    transitionAction || inferCaseTransitionAction(existing.status as InfringementStatus, typedStatus)
  )
  if (!transitionValidation.ok) {
    const transitionError = 'error' in transitionValidation ? transitionValidation.error : null
    console.error('Invalid takedown status transition:', transitionError)
    return false
  }

  const { error } = await supabase
    .from('takedown_requests')
    .update({
      status: typedStatus,
      admin_notes: adminNotes,
      processed_at: new Date().toISOString(),
    })
    .eq('id', takedownId)

  if (error) {
    console.error('Error updating takedown status:', error)
    return false
  }

  return true
}

// ============================================
// CASE UPDATES
// ============================================

export async function fetchCaseUpdates(takedownId: string): Promise<CaseUpdate[]> {
  if (!isSupabaseConfigured()) return []

  const { data, error } = await supabase
    .from('case_updates')
    .select('*')
    .eq('takedown_id', takedownId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching case updates:', error)
    return []
  }

  return data || []
}

export async function createCaseUpdate(
  takedownId: string,
  updateType: string,
  message: string,
  createdBy: 'lawyer' | 'system' | 'brand_owner' = 'lawyer'
): Promise<CaseUpdate | null> {
  if (!isSupabaseConfigured()) return null

  const { data, error } = await supabase
    .from('case_updates')
    .insert({
      takedown_id: takedownId,
      update_type: updateType as any,
      message,
      created_by: createdBy,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating case update:', error)
    return null
  }

  return data
}

export async function markCaseUpdatesAsRead(takedownId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const { error } = await supabase
    .from('case_updates')
    .update({ is_read: true })
    .eq('takedown_id', takedownId)

  if (error) {
    console.error('Error marking updates as read:', error)
    return false
  }

  return true
}

// ============================================
// ASSETS
// ============================================

export async function fetchAssets(brandId: string): Promise<PersistedAsset[]> {
  if (!isSupabaseConfigured()) return []

  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching assets:', error)
    return []
  }

  return (data || []).map(transformAsset)
}

export async function createAssetRecord(
  brandId: string,
  asset: Omit<AssetInsert, 'brand_id'>
): Promise<Asset | null> {
  if (!isSupabaseConfigured()) return null

  const { data, error } = await supabase
    .from('assets')
    .insert({ ...asset, brand_id: brandId })
    .select()
    .single()

  if (error) {
    console.error('Error creating asset record:', error)
    return null
  }

  return data
}

export async function deleteAssetRecord(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const { error } = await supabase
    .from('assets')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting asset record:', error)
    return false
  }

  return true
}

// ============================================
// ACTIVITY LOGS
// ============================================

export async function fetchActivityLogs(
  userId: string,
  limit: number = 50
): Promise<ActivityLogItem[]> {
  if (!isSupabaseConfigured()) return []

  const { data, error } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching activity logs:', error)
    return []
  }

  return (data || []).map(transformActivityLog)
}

export async function createActivityLog(
  userId: string,
  action: string,
  target: string,
  logType: ActivityLogItem['type'],
  brandId?: string,
  icon?: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const { error } = await supabase
    .from('activity_logs')
    .insert({
      user_id: userId,
      brand_id: brandId,
      action,
      target,
      log_type: logType,
      icon,
    })

  if (error) {
    console.error('Error creating activity log:', error)
    return false
  }

  return true
}

// ============================================
// BRANDS
// ============================================

export async function fetchBrands(userId: string): Promise<Brand[]> {
  if (!isSupabaseConfigured()) return []

  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching brands:', error)
    return []
  }

  return data || []
}

export async function createBrand(
  userId: string,
  name: string,
  websiteUrl?: string
): Promise<Brand | null> {
  if (!isSupabaseConfigured()) return null

  const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now()

  const { data, error } = await supabase
    .from('brands')
    .insert({
      owner_id: userId,
      name,
      slug,
      website_url: websiteUrl,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating brand:', error)
    return null
  }

  return data
}

export async function updateBrand(
  id: string,
  updates: Partial<BrandInsert>
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const { error } = await supabase
    .from('brands')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('Error updating brand:', error)
    return false
  }

  return true
}

// ============================================
// WHITELIST
// ============================================

export interface WhitelistItem {
  id: string
  name: string
  domain: string
  platform: string
  dateAdded: string
}

export function transformWhitelist(dbWhitelist: Whitelist): WhitelistItem {
  return {
    id: dbWhitelist.id,
    name: dbWhitelist.name,
    domain: dbWhitelist.domain,
    platform: dbWhitelist.platform || 'General Web',
    dateAdded: dbWhitelist.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
  }
}

function normalizeWhitelistDomainInput(domain: string): string {
  const raw = domain.trim().toLowerCase()
  if (!raw) return raw

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw)
    ? raw
    : `https://${raw}`

  try {
    return new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return raw.replace(/^www\./, '')
  }
}

export async function fetchWhitelist(brandId: string): Promise<WhitelistItem[]> {
  if (!isSupabaseConfigured()) return []

  const { data, error } = await supabase
    .from('whitelist')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching whitelist:', error)
    return []
  }

  return (data || []).map(transformWhitelist)
}

export async function createWhitelistEntry(
  brandId: string,
  name: string,
  domain: string,
  platform?: string
): Promise<{ data: Whitelist | null; error: string | null }> {
  if (!isSupabaseConfigured()) return { data: null, error: 'not_configured' }
  const normalizedDomain = normalizeWhitelistDomainInput(domain)
  if (!normalizedDomain) return { data: null, error: 'invalid_domain' }

  const { data, error } = await supabase
    .from('whitelist')
    .insert({
      brand_id: brandId,
      name,
      domain: normalizedDomain,
      platform: platform || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating whitelist entry:', error)
    // Check for unique constraint violation (duplicate domain)
    if (error.code === '23505') {
      return { data: null, error: 'duplicate' }
    }
    return { data: null, error: 'unknown' }
  }

  return { data, error: null }
}

export async function deleteWhitelistEntry(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const { error } = await supabase
    .from('whitelist')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting whitelist entry:', error)
    return false
  }

  return true
}

// ============================================
// IP DOCUMENTS
// ============================================

export interface IPDocumentItem {
  id: string
  name: string
  type: 'Trademark' | 'Copyright' | 'Patent' | 'Other'
  regNumber: string
  status: 'Active' | 'Pending' | 'Expired'
  expiry: string
  storagePath: string | null
}

export function transformIPDocument(dbDoc: IPDocument): IPDocumentItem {
  return {
    id: dbDoc.id,
    name: dbDoc.name,
    type: dbDoc.doc_type,
    regNumber: dbDoc.registration_number || '-',
    status: dbDoc.status,
    expiry: dbDoc.expiry_date || '-',
    storagePath: dbDoc.storage_path,
  }
}

export async function fetchIPDocuments(brandId: string): Promise<IPDocumentItem[]> {
  if (!isSupabaseConfigured()) return []

  const { data, error } = await supabase
    .from('ip_documents')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching IP documents:', error)
    return []
  }

  return (data || []).map(transformIPDocument)
}

export async function createIPDocument(
  brandId: string,
  document: {
    name: string
    docType: 'Trademark' | 'Copyright' | 'Patent' | 'Other'
    registrationNumber?: string
    status?: 'Active' | 'Pending' | 'Expired'
    expiryDate?: string
    storagePath?: string
  }
): Promise<IPDocument | null> {
  if (!isSupabaseConfigured()) return null

  const { data, error } = await supabase
    .from('ip_documents')
    .insert({
      brand_id: brandId,
      name: document.name,
      doc_type: document.docType,
      registration_number: document.registrationNumber || null,
      status: document.status || 'Pending',
      expiry_date: document.expiryDate || null,
      storage_path: document.storagePath || null,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating IP document:', error)
    return null
  }

  return data
}

export async function deleteIPDocument(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const { error } = await supabase
    .from('ip_documents')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting IP document:', error)
    return false
  }

  return true
}
