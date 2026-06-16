import React from 'react';

import type { Studio } from '@evil/bifrost_fw_sdk';

interface NoAuthTokenHintProps {
  studio: Studio;
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
