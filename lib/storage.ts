import { supabase, isSupabaseConfigured } from './supabase'

export type StorageBucket = 'assets' | 'ip-documents' | 'avatars'

interface UploadResult {
  path: string
  error: Error | null
}

interface SignedUrlResult {
  url: string
  error: Error | null
}

/**
 * Upload a file to Supabase Storage
 * Files are organized by userId/brandId/filename
 */
export async function uploadFile(
  bucket: StorageBucket,
  userId: string,
  file: File,
  brandId?: string,
  customPath?: string
): Promise<UploadResult> {
  if (!isSupabaseConfigured()) {
    return { path: '', error: new Error('Supabase not configured') }
  }

  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const timestamp = Date.now()
  const randomId = Math.random().toString(36).substring(2, 11)
  const fileName = `${timestamp}_${randomId}.${fileExt}`

  // Build path based on bucket type
  let filePath: string
  if (customPath) {
    filePath = customPath
  } else if (brandId) {
    filePath = `${userId}/${brandId}/${fileName}`
  } else {
    filePath = `${userId}/${fileName}`
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    console.error('Storage upload error:', error)
    return { path: '', error: new Error(error.message) }
  }

  return { path: data.path, error: null }
}

/**
 * Upload an asset file (image/video/text)
 */
export async function uploadAsset(
  userId: string,
  brandId: string,
  file: File
): Promise<UploadResult> {
  return uploadFile('assets', userId, file, brandId)
}

/**
 * Upload an IP document
 */
export async function uploadIPDocument(
  userId: string,
  brandId: string,
  file: File
): Promise<UploadResult> {
  return uploadFile('ip-documents', userId, file, brandId)
}

/**
 * Upload a user avatar
 */
export async function uploadAvatar(
  userId: string,
  file: File
): Promise<UploadResult> {
  // Avatars use a predictable path so we can overwrite
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const filePath = `${userId}/avatar.${fileExt}`

  if (!isSupabaseConfigured()) {
    return { path: '', error: new Error('Supabase not configured') }
  }

  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true, // Allow overwriting avatar
    })

  if (error) {
    console.error('Avatar upload error:', error)
    return { path: '', error: new Error(error.message) }
  }

  return { path: data.path, error: null }
}

/**
 * Get a signed URL for a private file (expires in 1 hour by default)
 */
export async function getSignedUrl(
  bucket: StorageBucket,
  path: string,
  expiresIn: number = 3600
): Promise<SignedUrlResult> {
  if (!isSupabaseConfigured()) {
    return { url: '', error: new Error('Supabase not configured') }
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn)

  if (error) {
    console.error('Signed URL error:', error)
    return { url: '', error: new Error(error.message) }
  }

  return { url: data.signedUrl, error: null }
}

/**
 * Get a signed URL for an asset
 */
export async function getAssetUrl(path: string, expiresIn: number = 3600): Promise<string> {
  const { url, error } = await getSignedUrl('assets', path, expiresIn)
  if (error) {
    console.error('Failed to get asset URL:', error)
    return ''
  }
  return url
}

/**
 * Get a signed URL for an IP document
 */
export async function getIPDocumentUrl(path: string): Promise<string> {
  const { url, error } = await getSignedUrl('ip-documents', path)
  if (error) {
    console.error('Failed to get IP document URL:', error)
    return ''
  }
  return url
}

/**
 * Get a public URL for an avatar (avatars bucket is public)
 */
export function getAvatarUrl(path: string): string {
  if (!isSupabaseConfigured()) {
    return ''
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

/**
 * Delete a file from storage
 */
export async function deleteFile(
  bucket: StorageBucket,
  path: string
): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { error: new Error('Supabase not configured') }
  }

  const { error } = await supabase.storage
    .from(bucket)
    .remove([path])

  if (error) {
    console.error('Storage delete error:', error)
    return { error: new Error(error.message) }
  }

  return { error: null }
}

/**
 * Delete an asset
 */
export async function deleteAsset(path: string): Promise<{ error: Error | null }> {
  return deleteFile('assets', path)
}

/**
 * Delete multiple files from storage
 */
export async function deleteFiles(
  bucket: StorageBucket,
  paths: string[]
): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { error: new Error('Supabase not configured') }
  }

  const { error } = await supabase.storage
    .from(bucket)
    .remove(paths)

  if (error) {
    console.error('Storage bulk delete error:', error)
    return { error: new Error(error.message) }
  }

  return { error: null }
}

/**
 * List files in a storage path
 */
export async function listFiles(
  bucket: StorageBucket,
  path: string,
  options?: {
    limit?: number
    offset?: number
    sortBy?: { column: string; order: 'asc' | 'desc' }
  }
): Promise<{ files: string[]; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { files: [], error: new Error('Supabase not configured') }
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(path, options)

  if (error) {
    console.error('Storage list error:', error)
    return { files: [], error: new Error(error.message) }
  }

  const files = data
    .filter(item => item.name) // Filter out folders
    .map(item => `${path}/${item.name}`)

  return { files, error: null }
}

/**
 * Download a file from storage
 */
export async function downloadFile(
  bucket: StorageBucket,
  path: string
): Promise<{ data: Blob | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase not configured') }
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .download(path)

  if (error) {
    console.error('Storage download error:', error)
    return { data: null, error: new Error(error.message) }
  }

  return { data, error: null }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(
  bucket: StorageBucket,
  path: string
): Promise<{ size: number; contentType: string; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { size: 0, contentType: '', error: new Error('Supabase not configured') }
  }

  // Get the directory and filename
  const parts = path.split('/')
  const fileName = parts.pop() || ''
  const directory = parts.join('/')

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(directory, {
      limit: 100,
      search: fileName,
    })

  if (error) {
    console.error('Storage metadata error:', error)
    return { size: 0, contentType: '', error: new Error(error.message) }
  }

  const file = data.find(f => f.name === fileName)
  if (!file) {
    return { size: 0, contentType: '', error: new Error('File not found') }
  }

  return {
    size: file.metadata?.size || 0,
    contentType: file.metadata?.mimetype || 'application/octet-stream',
    error: null,
  }
}
