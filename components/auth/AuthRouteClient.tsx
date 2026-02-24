'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthScreen from '@/components/AuthScreen';
import { AuthProvider, useAuth } from '@/context/AuthContext';

const resolveNextPath = (value: string | null): string => {
  if (!value || !value.startsWith('/')) {
    return '/app';
  }

  return value;
};

const AuthRouteContent: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = resolveNextPath(searchParams.get('next'));

  useEffect(() => {
    if (!loading && user) {
      router.replace(nextPath);
    }
  }, [loading, nextPath, router, user]);

  if (!loading && user) {
    return null;
  }

  return <AuthScreen />;
};

const AuthRouteClient: React.FC = () => {
  return (
    <AuthProvider>
      <AuthRouteContent />
    </AuthProvider>
  );
};

export default AuthRouteClient;
