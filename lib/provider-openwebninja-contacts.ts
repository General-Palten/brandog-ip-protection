// OpenWebNinja Website Contacts Scraper provider.
// Extracts emails, phone numbers, and social profile URLs from domains.

import { callOpenWebNinja } from './openwebninja-client';

export interface WebsiteContacts {
  emails: string[];
  phones: string[];
  socialLinks: SocialLink[];
}

export interface SocialLink {
  platform: string;
  url: string;
}

interface ContactsApiResponse {
  status: string;
  request_id?: string;
  data?: {
    emails?: string[];
    phone_numbers?: string[];
    socials?: Record<string, string | string[]>;
    [key: string]: unknown;
  };
}

export async function scrapeWebsiteContacts(
  domain: string,
  apiKey: string
): Promise<{ contacts: WebsiteContacts; latencyMs: number; ok: boolean; error?: string }> {
  const result = await callOpenWebNinja<ContactsApiResponse>({
    service: 'website_contacts',
    path: '/get-contacts',
    params: { domain: cleanDomain(domain) },
    apiKey,
  });

  const empty: WebsiteContacts = { emails: [], phones: [], socialLinks: [] };

  if (!result.ok || !result.data?.data) {
    return { contacts: empty, latencyMs: result.latencyMs, ok: result.ok, error: result.error };
  }

  const raw = result.data.data;
  const emails = dedupeStrings(raw.emails || []);
  const phones = dedupeStrings(raw.phone_numbers || []);
  const socialLinks = parseSocialLinks(raw.socials || {});

  return {
    contacts: { emails, phones, socialLinks },
    latencyMs: result.latencyMs,
    ok: true,
  };
}

function cleanDomain(input: string): string {
  let domain = input.trim();
  // Strip protocol
  domain = domain.replace(/^https?:\/\//, '');
  // Strip path
  domain = domain.split('/')[0];
  // Strip www
  domain = domain.replace(/^www\./, '');
  return domain;
}

function dedupeStrings(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter((s) => {
    const lower = (s || '').trim().toLowerCase();
    if (!lower || seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

function parseSocialLinks(socials: Record<string, string | string[]>): SocialLink[] {
  const links: SocialLink[] = [];
  for (const [platform, value] of Object.entries(socials)) {
    const urls = Array.isArray(value) ? value : [value];
    for (const url of urls) {
      if (typeof url === 'string' && url.trim()) {
        links.push({ platform, url: url.trim() });
      }
    }
  }
  return links;
}
