// OpenWebNinja provider service registry.
// Each service can be toggled on/off per brand via scan_settings.

export type OpenWebNinjaService =
  | 'reverse_image_search'
  | 'product_search'
  | 'realtime_lens_data'
  | 'website_contacts'
  | 'social_links'
  | 'web_unblocker';

export type ServiceCategory = 'core' | 'enrichment' | 'enforcement' | 'monitoring';

export interface ServiceDefinition {
  key: OpenWebNinjaService;
  label: string;
  description: string;
  category: ServiceCategory;
  /** Direct OpenWebNinja API base URL (e.g. https://api.openwebninja.com/reverse-image-search) */
  apiBaseUrl: string;
  defaultEnabled: boolean;
  estimatedCostUsd: number;
  /** Column name in scan_settings for the toggle */
  settingsColumn: string;
  /** Column name in scan_settings for cost override */
  costColumn: string;
}

export const SERVICE_CATALOG: ServiceDefinition[] = [
  {
    key: 'reverse_image_search',
    label: 'Reverse Image Search',
    description: 'Find exact matches of brand images across the web',
    category: 'core',
    apiBaseUrl: 'https://api.openwebninja.com/reverse-image-search',
    defaultEnabled: true,
    estimatedCostUsd: 0.0025,
    settingsColumn: 'enable_reverse_image_search',
    costColumn: 'reverse_image_search_cost_usd',
  },
  {
    key: 'realtime_lens_data',
    label: 'Visual Search',
    description: 'Visual matches, object detection, and OCR via Google Lens',
    category: 'core',
    apiBaseUrl: 'https://api.openwebninja.com/realtime-lens-data',
    defaultEnabled: false,
    estimatedCostUsd: 0.0025,
    settingsColumn: 'enable_amazon_data',
    costColumn: 'amazon_data_cost_usd',
  },
  {
    key: 'product_search',
    label: 'Product Search',
    description: 'Search Google Shopping for product listings, offers, and reviews',
    category: 'enrichment',
    apiBaseUrl: 'https://api.openwebninja.com/realtime-product-search',
    defaultEnabled: false,
    estimatedCostUsd: 0.0025,
    settingsColumn: 'enable_product_search',
    costColumn: 'product_search_cost_usd',
  },
  {
    key: 'website_contacts',
    label: 'Website Contacts',
    description: 'Extract emails, phone numbers, and social links from websites',
    category: 'enforcement',
    apiBaseUrl: 'https://api.openwebninja.com/website-contacts-scraper',
    defaultEnabled: false,
    estimatedCostUsd: 0.0025,
    settingsColumn: 'enable_website_contacts',
    costColumn: 'website_contacts_cost_usd',
  },
  {
    key: 'social_links',
    label: 'Social Links',
    description: 'Find social profiles across Facebook, Instagram, TikTok, and more',
    category: 'monitoring',
    apiBaseUrl: 'https://api.openwebninja.com/social-links-search',
    defaultEnabled: false,
    estimatedCostUsd: 0.0025,
    settingsColumn: 'enable_social_links',
    costColumn: 'social_links_cost_usd',
  },
  {
    key: 'web_unblocker',
    label: 'Web Unblocker',
    description: 'Fetch web pages with JS rendering, proxies, and smart retries',
    category: 'monitoring',
    apiBaseUrl: 'https://api.openwebninja.com/web-unblocker',
    defaultEnabled: false,
    estimatedCostUsd: 0.0005,
    settingsColumn: 'enable_web_unblocker',
    costColumn: 'web_unblocker_cost_usd',
  },
];

export const getServiceDefinition = (key: OpenWebNinjaService): ServiceDefinition | undefined =>
  SERVICE_CATALOG.find((s) => s.key === key);

export const getServicesByCategory = (category: ServiceCategory): ServiceDefinition[] =>
  SERVICE_CATALOG.filter((s) => s.category === category);

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  core: 'Core',
  enrichment: 'Enrichment',
  enforcement: 'Enforcement',
  monitoring: 'Monitoring',
};
