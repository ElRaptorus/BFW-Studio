import React from 'react';

export interface GatewayConfigButtonProps {
  configured: boolean;
  onConfigure: () => void;
}

export function GatewayConfigButton(props: GatewayConfigButtonProps): React.ReactElement {
  const { configured, onConfigure } = props;
  const className = `token-sim-gateway-config-btn ${configured ? 'token-sim-gateway-config-btn--configured' : ''}`;

  return (
    <button
      className={className}
      onClick={onConfigure}
      title={configured ? 'Change pre-configured path' : 'Pre-configure path'}
      aria-label={configured ? 'Change pre-configured path' : 'Pre-configure path'}
    >
      <i className="ph-fill ph-signpost" />
    </button>
  );
}
