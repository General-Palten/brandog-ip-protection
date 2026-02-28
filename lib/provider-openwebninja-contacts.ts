// OpenWebNinja Website Contacts Scraper provider.
// Extracts emails, phone numbers, and social profile URLs from domains.

import { callOpenWebNinja } from './openwebninja-client';
import type { SerpApiSearchCall } from './provider-serpapi';

export interface WebsiteContacts {
  domain: string;
  emails: string[];
  phones: string[];
  socialLinks: SocialLink[];
}

export interface SocialLink {
  platform: string;
  url: string;
}

interface ContactEmailEntry {
  value: string;
  sources?: string[];
}

interface ContactsApiDataItem {
  domain?: string;
  query?: string;
  emails?: ContactEmailEntry[];
  phone_numbers?: string[];
  socials?: Record<string, string | string[]>;
  [key: string]: unknown;
}

interface ContactsApiResponse {
  status: string;
  request_id?: string;
  data?: ContactsApiDataItem[];
}

export async function scrapeWebsiteContacts(
  domain: string,
  apiKey: string,
  options?: { matchEmailDomain?: boolean; externalMatching?: boolean }
): Promise<{ contacts: WebsiteContacts; latencyMs: number; ok: boolean; error?: string }> {
  const cleaned = cleanDomain(domain);
  const params: Record<string, string> = { query: cleaned };
  if (options?.matchEmailDomain) params.match_email_domain = 'true';
  if (options?.externalMatching) params.external_matching = 'true';

  const result = await callOpenWebNinja<ContactsApiResponse>({
    service: 'website_contacts',
    path: '/scrape-contacts',
    params,
    apiKey,
  });

  const empty: WebsiteContacts = { domain: cleaned, emails: [], phones: [], socialLinks: [] };

  if (!result.ok || !Array.isArray(result.data?.data) || result.data.data.length === 0) {
    return { contacts: empty, latencyMs: result.latencyMs, ok: result.ok, error: result.error };
  }

  const raw = result.data.data[0];
  const emails = dedupeStrings((raw.emails || []).map((e) => (typeof e === 'string' ? e : e.value)));
  const phones = dedupeStrings(raw.phone_numbers || []);
  const socialLinks = parseSocialLinks(raw.socials || {});

  return {
    contacts: { domain: cleaned, emails, phones, socialLinks },
    latencyMs: result.latencyMs,
    ok: true,
  };
}

export function toContactsSearchCallShape(
  result: { ok: boolean; latencyMs: number; error?: string },
  contacts: WebsiteContacts,
  domain: string
): SerpApiSearchCall {
  return {
    endpoint: 'openwebninja_website_contacts',
    ok: result.ok,
    status: result.ok ? 200 : 0,
    payload: { emails: contacts.emails.length, phones: contacts.phones.length, socials: contacts.socialLinks.length } as unknown as Record<string, any>,
    error: result.error,
    latencyMs: result.latencyMs,
    query: { domain, service: 'website_contacts' },
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
