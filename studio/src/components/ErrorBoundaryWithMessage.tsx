import type { ErrorInfo } from 'react';
import React from 'react';

/**
 * Provides an ErrorBoundary for components.
 *
 * See https://reactjs.org/docs/error-boundaries.html
 */
export class ErrorBoundaryWithMessage extends React.PureComponent<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorData: '<no error data>' };
  }

  static getDerivedStateFromError(error: Error): object {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({
      errorData: `${error.stack || error.message}\n\nComponent Stack:\n${info.componentStack}`,
    });
    if (this.props.onError != null) {
      this.props.onError(error, info);
    }
  }

  render(): React.JSX.Element {
    const message = this.props.message || 'Something went wrong.';

    if (this.state.hasError) {
      return (
        <div className="error-boundary" data-test--react-error-boundary={this.state.errorData}>
          <h1>
            <span className="ph-duotone ph-bug" />
            Something went wrong.
          </h1>
          <span>{message}</span>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}
