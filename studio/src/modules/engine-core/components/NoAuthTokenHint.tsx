import type { Bifrost } from '#bifrost/Bifrost';

import React from 'react';

interface NoAuthTokenHintProps {
  studio: Bifrost;
  engineUrl: string;
}

export const NoAuthTokenHint: React.FC<NoAuthTokenHintProps> = ({ studio, engineUrl }) => {
  const handleClick = () => {
    studio.commands.executeCommand('engine.setAuthToken', [engineUrl]);
  };

  return (
    <div className="engine-no-auth-hint">
      <p>No auth token configured for this engine.</p>
      <button className="engine-no-auth-hint__action" onClick={handleClick} type="button">
        Set Auth Token
      </button>
    </div>
  );
};
