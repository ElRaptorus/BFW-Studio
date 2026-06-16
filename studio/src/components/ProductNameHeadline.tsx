import { ReleaseChannelName } from '#bifrost/common/Environment';

import React from 'react';

type HeadlineProps = {
  productName: string;
  releaseChannelName: string;
};

export default function ProductNameHeadline(props: HeadlineProps): React.JSX.Element {
  let releaseChannelName = '';

  switch (props.releaseChannelName) {
    case ReleaseChannelName.bloodforge:
      releaseChannelName = 'bloodforge';
      break;
    case ReleaseChannelName.Unknown:
      releaseChannelName = 'development';
      break;
  }

  const showReleaseChannelName = releaseChannelName !== '';

  return (
    <h1>
      {props.productName}
      {showReleaseChannelName ? <small className="text-muted"> {releaseChannelName}</small> : null}
    </h1>
  );
}
