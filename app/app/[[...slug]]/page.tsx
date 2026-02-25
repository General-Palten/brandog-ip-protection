import AppWithConfig from '@/components/AppWithConfig';
import { getServerRuntimeConfig } from '@/lib/runtime-config';

export default function ConsolePage() {
  const config = getServerRuntimeConfig();
  return <AppWithConfig runtimeConfig={config} />;
}
