'use client';

import { useEffect } from 'react';
import App from '@/App';
import type { RuntimeConfig } from '@/lib/runtime-config';

interface AppWithConfigProps {
  runtimeConfig: RuntimeConfig;
}

export default function AppWithConfig({ runtimeConfig }: AppWithConfigProps) {
  // Set the runtime config on the window object for other modules to access
  useEffect(() => {
    (window as any).__RUNTIME_CONFIG__ = runtimeConfig;
  }, [runtimeConfig]);

  // Also set it immediately (before first render of child components)
  if (typeof window !== 'undefined') {
    (window as any).__RUNTIME_CONFIG__ = runtimeConfig;
  }

  return <App />;
}
