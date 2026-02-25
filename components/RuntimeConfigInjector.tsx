import Script from 'next/script';
import { getServerRuntimeConfig } from '@/lib/runtime-config';

/**
 * Server Component that injects runtime configuration into the client.
 * This allows env vars set at runtime (not build time) to be available
 * to client components.
 */
export default function RuntimeConfigInjector() {
  const config = getServerRuntimeConfig();

  return (
    <Script
      id="runtime-config"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{
        __html: `window.__RUNTIME_CONFIG__ = ${JSON.stringify(config)};`,
      }}
    />
  );
}
