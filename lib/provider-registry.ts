// OpenWebNinja provider service registry.
// Each service can be toggled on/off per brand via scan_settings.

export type OpenWebNinjaService =
  | 'reverse_image_search'
  | 'product_search'
  | 'amazon_data'
  | 'website_contacts'
  | 'social_links'
  | 'web_unblocker';

export type ServiceCategory = 'core' | 'enrichment' | 'enforcement' | 'monitoring';

export interface ServiceDefinition {
  key: OpenWebNinjaService;
  label: string;
  description: string;
  category: ServiceCategory;
  rapidApiHost: string;
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
    description: 'Find where brand images appear across the web',
    category: 'core',
    rapidApiHost: 'reverse-image-search1.p.rapidapi.com',
    defaultEnabled: true,
    estimatedCostUsd: 0.0025,
    settingsColumn: 'enable_reverse_image_search',
    costColumn: 'reverse_image_search_cost_usd',
  },
  {
    key: 'product_search',
    label: 'Product Search',
    description: 'Enrich matches with multi-source product data via Google Shopping',
    category: 'enrichment',
    rapidApiHost: 'real-time-product-search.p.rapidapi.com',
    defaultEnabled: false,
    estimatedCostUsd: 0.0025,
    settingsColumn: 'enable_product_search',
    costColumn: 'product_search_cost_usd',
  },
  {
    key: 'amazon_data',
    label: 'Amazon Data',
    description: 'Seller profiles, reviews, and product details from Amazon',
    category: 'enrichment',
    rapidApiHost: 'real-time-amazon-data.p.rapidapi.com',
    defaultEnabled: false,
    estimatedCostUsd: 0.0025,
    settingsColumn: 'enable_amazon_data',
    costColumn: 'amazon_data_cost_usd',
  },
  {
    key: 'website_contacts',
    label: 'Website Contacts',
    description: 'Auto-extract emails and contact info for takedown notices',
    category: 'enforcement',
    rapidApiHost: 'website-contacts-scraper.p.rapidapi.com',
    defaultEnabled: false,
    estimatedCostUsd: 0.0025,
    settingsColumn: 'enable_website_contacts',
    costColumn: 'website_contacts_cost_usd',
  },
  {
    key: 'social_links',
    label: 'Social Links',
    description: 'Find seller social profiles across platforms',
    category: 'monitoring',
    rapidApiHost: 'social-links-search.p.rapidapi.com',
    defaultEnabled: false,
    estimatedCostUsd: 0.0025,
    settingsColumn: 'enable_social_links',
    costColumn: 'social_links_cost_usd',
  },
  {
    key: 'web_unblocker',
    label: 'Web Unblocker',
    description: 'Re-crawl listings to monitor status changes and re-listings',
    category: 'monitoring',
    rapidApiHost: 'web-unblocker1.p.rapidapi.com',
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
