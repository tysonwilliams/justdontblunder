import { ErrorBoundary as RouterErrorBoundary, type ErrorBoundaryProps } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { reportClientError } from '@/src/observability/clientError';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportClientError(error, { platform: Platform.OS });
  }, [error]);

  return <RouterErrorBoundary error={error} retry={retry} />;
}
