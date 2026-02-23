/**
 * Seed script to populate Supabase with dummy data
 * Run this by importing and calling seedDatabase() from the browser console
 * or by adding a button in the app
 */

import { supabase, isSupabaseConfigured } from './supabase'

export async function seedDatabase(userId: string, brandId: string) {
  if (!isSupabaseConfigured()) {
    console.error('Supabase not configured')
    return { success: false, error: 'Supabase not configured' }
  }

  console.log('Starting database seed...')
  console.log('User ID:', userId)
  console.log('Brand ID:', brandId)

  try {
    // 1. Seed Keywords
    console.log('Seeding keywords...')
    const keywords = [
      { brand_id: brandId, text: 'MyBrand', type: 'active', tags: ['Primary'], matches_count: 156, trend: 'up' },
      { brand_id: brandId, text: 'MyBrand Official', type: 'active', tags: ['Variation'], matches_count: 89, trend: 'stable' },
      { brand_id: brandId, text: 'MyBrand Store', type: 'active', tags: ['Variation'], matches_count: 45, trend: 'up' },
      { brand_id: brandId, text: 'cheap mybrand', type: 'negative', tags: ['Counterfeit'], matches_count: 234, trend: 'down' },
      { brand_id: brandId, text: 'mybrand replica', type: 'negative', tags: ['Counterfeit'], matches_count: 178, trend: 'stable' },
      { brand_id: brandId, text: 'MyBrand Authentic', type: 'suggested', tags: ['AI Suggested'], matches_count: 67, trend: 'up' },
    ]

    const { error: keywordsError } = await supabase.from('keywords').insert(keywords)
    if (keywordsError) console.error('Keywords error:', keywordsError)
    else console.log('Keywords seeded successfully')

    // 2. Seed Whitelist
    console.log('Seeding whitelist...')
    const whitelist = [
      { brand_id: brandId, name: 'Amazon Official Store', domain: 'amazon.com/mybrand', platform: 'Amazon' },
      { brand_id: brandId, name: 'eBay Authorized Seller', domain: 'ebay.com/mybrand-official', platform: 'eBay' },
      { brand_id: brandId, name: 'Official Website', domain: 'mybrand.com', platform: 'Website' },
      { brand_id: brandId, name: 'Walmart Partner', domain: 'walmart.com/mybrand', platform: 'Walmart' },
      { brand_id: brandId, name: 'Target Retail', domain: 'target.com/mybrand', platform: 'Target' },
    ]

    const { error: whitelistError } = await supabase.from('whitelist').insert(whitelist)
    if (whitelistError) console.error('Whitelist error:', whitelistError)
    else console.log('Whitelist seeded successfully')

    // 3. Seed IP Documents
    console.log('Seeding IP documents...')
    const ipDocuments = [
      { brand_id: brandId, name: 'US Trademark Registration', doc_type: 'Trademark', registration_number: 'US-TM-2024-001', status: 'Active', expiry_date: '2034-06-15' },
      { brand_id: brandId, name: 'EU Trademark Certificate', doc_type: 'Trademark', registration_number: 'EU-TM-2023-892', status: 'Active', expiry_date: '2033-03-22' },
      { brand_id: brandId, name: 'Logo Copyright', doc_type: 'Copyright', registration_number: 'CR-2022-45678', status: 'Active', expiry_date: '2092-01-01' },
      { brand_id: brandId, name: 'Design Patent', doc_type: 'Patent', registration_number: 'PAT-2024-9876', status: 'Pending', expiry_date: '2044-12-01' },
    ]

    const { error: ipDocsError } = await supabase.from('ip_documents').insert(ipDocuments)
    if (ipDocsError) console.error('IP Documents error:', ipDocsError)
    else console.log('IP Documents seeded successfully')

    // 4. Seed Infringements
    console.log('Seeding infringements...')
    const infringements = [
      {
        brand_id: brandId,
        platform: 'AliExpress',
        status: 'detected',
        similarity_score: 94,
        site_visitors: 15000,
        revenue_lost: 2500,
        country: 'China',
        seller_name: 'CheapGoods Store',
        infringing_url: 'https://aliexpress.com/item/fake-mybrand-123',
        copycat_image_url: 'https://picsum.photos/seed/inf1/400/400',
        whois_registrar: 'Alibaba Cloud',
        whois_creation_date: '2023-01-15',
        whois_registrant_country: 'CN',
        hosting_provider: 'Alibaba Cloud',
        hosting_ip_address: '47.88.123.45',
      },
      {
        brand_id: brandId,
        platform: 'Amazon',
        status: 'pending_review',
        similarity_score: 87,
        site_visitors: 8500,
        revenue_lost: 1200,
        country: 'United States',
        seller_name: 'BargainDeals LLC',
        infringing_url: 'https://amazon.com/dp/B0FAKE123',
        copycat_image_url: 'https://picsum.photos/seed/inf2/400/400',
        whois_registrar: 'Amazon Registrar',
        whois_creation_date: '2022-06-20',
        whois_registrant_country: 'US',
        hosting_provider: 'AWS',
        hosting_ip_address: '52.94.76.89',
      },
      {
        brand_id: brandId,
        platform: 'eBay',
        status: 'in_progress',
        similarity_score: 91,
        site_visitors: 5200,
        revenue_lost: 890,
        country: 'United Kingdom',
        seller_name: 'UK_Discounts_2024',
        infringing_url: 'https://ebay.co.uk/itm/fake-mybrand-456',
        copycat_image_url: 'https://picsum.photos/seed/inf3/400/400',
        whois_registrar: 'eBay Inc',
        whois_creation_date: '2024-02-10',
        whois_registrant_country: 'GB',
        hosting_provider: 'eBay Infrastructure',
        hosting_ip_address: '66.135.192.87',
      },
      {
        brand_id: brandId,
        platform: 'TikTok Shop',
        status: 'detected',
        similarity_score: 78,
        site_visitors: 25000,
        revenue_lost: 3400,
        country: 'Vietnam',
        seller_name: 'TrendyShop_VN',
        infringing_url: 'https://tiktok.com/@trendyshop/product/789',
        copycat_image_url: 'https://picsum.photos/seed/inf4/400/400',
        whois_registrar: 'Unknown',
        whois_creation_date: '2024-05-01',
        whois_registrant_country: 'VN',
        hosting_provider: 'TikTok CDN',
        hosting_ip_address: '161.117.88.92',
      },
      {
        brand_id: brandId,
        platform: 'Instagram',
        status: 'resolved',
        similarity_score: 96,
        site_visitors: 12000,
        revenue_lost: 1800,
        country: 'Turkey',
        seller_name: '@fakebrand_tr',
        infringing_url: 'https://instagram.com/fakebrand_tr',
        copycat_image_url: 'https://picsum.photos/seed/inf5/400/400',
        whois_registrar: 'Meta Platforms',
        whois_creation_date: '2023-11-20',
        whois_registrant_country: 'TR',
        hosting_provider: 'Meta CDN',
        hosting_ip_address: '157.240.1.35',
      },
      {
        brand_id: brandId,
        platform: 'Shopify',
        status: 'detected',
        similarity_score: 82,
        site_visitors: 3200,
        revenue_lost: 650,
        country: 'India',
        seller_name: 'BestDeals India',
        infringing_url: 'https://bestdeals-india.myshopify.com/products/mybrand-clone',
        copycat_image_url: 'https://picsum.photos/seed/inf6/400/400',
        whois_registrar: 'Shopify Inc',
        whois_creation_date: '2024-03-15',
        whois_registrant_country: 'IN',
        hosting_provider: 'Shopify',
        hosting_ip_address: '23.227.38.65',
      },
    ]

    const { error: infringementsError } = await supabase.from('infringements').insert(infringements)
    if (infringementsError) console.error('Infringements error:', infringementsError)
    else console.log('Infringements seeded successfully')

    // 5. Seed Activity Logs
    console.log('Seeding activity logs...')
    const activityLogs = [
      { user_id: userId, brand_id: brandId, action: 'New infringement detected', target: 'AliExpress listing #123', log_type: 'warning', icon: '🚨' },
      { user_id: userId, brand_id: brandId, action: 'Takedown request submitted', target: 'Case #INF-001', log_type: 'info', icon: '📤' },
      { user_id: userId, brand_id: brandId, action: 'Content removed', target: 'Instagram @fakebrand_tr', log_type: 'success', icon: '✅' },
      { user_id: userId, brand_id: brandId, action: 'High-risk seller identified', target: 'CheapGoods Store on AliExpress', log_type: 'danger', icon: '⚠️' },
      { user_id: userId, brand_id: brandId, action: 'Keyword added', target: '"MyBrand Authentic"', log_type: 'info', icon: '🔍' },
      { user_id: userId, brand_id: brandId, action: 'Weekly scan completed', target: '156 new matches found', log_type: 'info', icon: '📊' },
    ]

    const { error: activityError } = await supabase.from('activity_logs').insert(activityLogs)
    if (activityError) console.error('Activity logs error:', activityError)
    else console.log('Activity logs seeded successfully')

    console.log('Database seeding completed!')
    return { success: true }

  } catch (error) {
    console.error('Seeding error:', error)
    return { success: false, error }
  }
}

// Helper to clear all data for a brand (useful for re-seeding)
export async function clearBrandData(brandId: string) {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' }
  }

  console.log('Clearing data for brand:', brandId)

  await supabase.from('keywords').delete().eq('brand_id', brandId)
  await supabase.from('whitelist').delete().eq('brand_id', brandId)
  await supabase.from('ip_documents').delete().eq('brand_id', brandId)
  await supabase.from('infringements').delete().eq('brand_id', brandId)

  console.log('Brand data cleared')
  return { success: true }
}
