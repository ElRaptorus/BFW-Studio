import React, { useEffect, useState } from 'react';

interface LoadingIndicatorProps {
  noVisibilityDelay?: boolean;
  message?: string;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  noVisibilityDelay = false,
  message = 'Loading...',
}) => {
  const [visible, setVisible] = useState(noVisibilityDelay);

  useEffect(() => {
    if (noVisibilityDelay) {
      return;
    }
    const timer = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(timer);
  }, [noVisibilityDelay]);

  if (!visible) {
    return <div className="engine-loading-indicator--placeholder" />;
  }

  return <div className="engine-loading-indicator">{message}</div>;
};
