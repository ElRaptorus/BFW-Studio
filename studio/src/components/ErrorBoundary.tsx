import type { ErrorInfo } from 'react';
import React from 'react';

/**
 * React component used to contain errors in part of the component tree.
 *
 * Example:
 *
 * Say we have a fragile component that throws a runtime error:
 *
 *    function FragileComponent(props: any) {
 *      throw new Error('oops - undefined is NOT a function!')
 *    }
 *
 * When we render this, our entire frontend errors out:
 *
 *    <FragileComponent />
 *
 * When we wrap it in an `ErrorBoundary`, the faulty component does affect the rest of the render tree:
 *
 *    <ErrorBoundary>
 *      <FragileComponent />
 *    </ErrorBoundary>
 */
export class ErrorBoundary extends React.PureComponent<any, any> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorData: '<no error data>' };
  }

  static getDerivedStateFromError(error: Error): any {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidUpdate(prevProps: any): void {
    if (this.state.hasError && prevProps.resetKeys !== this.props.resetKeys) {
      this.setState({ hasError: false, errorData: '<no error data>' });
    }
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
    const className = this.props.className || 'error-boundary';
    const message = this.props.message || 'Something went wrong.';

    if (this.state.hasError) {
      return (
        <div className={className} data-test--react-error-boundary={this.state.errorData}>
          <span>{message}</span>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}
