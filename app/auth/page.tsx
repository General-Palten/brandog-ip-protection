import { Suspense } from 'react';
import AuthRouteClient from '@/components/auth/AuthRouteClient';

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthRouteClient />
    </Suspense>
  );
}
