import React from 'react';

import { LoadingIndicator } from './LoadingIndicator';

interface PaneLoadingWrapperProps {
  isLoading: boolean;
  children: React.ReactNode;
}

/**
 * Wraps debugger pane content with a "Loading..." placeholder while
 * FNI detail is being fetched on demand (§3.5.4).
 */
export const PaneLoadingWrapper: React.FC<PaneLoadingWrapperProps> = ({ isLoading, children }) => {
  if (isLoading) {
    return <LoadingIndicator noVisibilityDelay message="Loading..." />;
  }

  return <>{children}</>;
};
