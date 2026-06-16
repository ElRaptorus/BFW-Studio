import React from 'react';

import { EditorContent, Icon } from '@evil/bifrost_fw_sdk';

export default function MachineSanctumHome(props: any): React.JSX.Element {
  return (
    <EditorContent>
      <div className="machine-sanctum-subpage">
        <h2>Machine Sanctum</h2>
        <p>Use the links above to jump to the examples.</p>

        <div className="machine-sanctum-subpage__hero-icon">
          <Icon id="machine-sanctum/hero" />
        </div>
      </div>
    </EditorContent>
  );
}
