import { getServerRuntimeConfig } from '@/lib/runtime-config';

/**
 * Server Component that injects runtime configuration into the client.
 * This allows env vars set at runtime (not build time) to be available
 * to client components.
 */
export default function RuntimeConfigInjector() {
  const config = getServerRuntimeConfig();

  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `window.__RUNTIME_CONFIG__ = ${JSON.stringify(config)};`,
      }}
    />
  );
}
