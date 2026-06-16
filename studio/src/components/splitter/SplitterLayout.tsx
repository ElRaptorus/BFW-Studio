import React from 'react';

import { assertNotNull } from '@evil/bifrost_fw_sdk';

type SplitterPaneProps = {
  vertical: boolean;
  primary: boolean;
  size: number;
  percentage: boolean;
  children: any;
};

type SplitterLayoutProps = {
  customClassName: string;
  vertical: boolean;
  percentage: boolean;
  primaryIndex: number;
  primaryMinSize: number;
  secondaryDefaultSize?: number;
  secondaryInitialSize: number;
  secondaryMinSize: number;
  onDragStart: () => void;
  onDragEnd: () => void;
  onSecondaryPaneSizeChange: (size: number) => void;
  children: any;
  initMediator?: (instance: SplitterLayout) => void;
};

const DEFAULT_SPLITTER_SIZE = 4;

export class SplitterLayout extends React.Component<SplitterLayoutProps, any> {
  public static defaultProps = {
    customClassName: '',
    vertical: false,
    percentage: false,
    primaryIndex: 0,
    primaryMinSize: 0,
    secondaryInitialSize: undefined,
    secondaryMinSize: 0,
    onDragStart: null,
    onDragEnd: null,
    onSecondaryPaneSizeChange: null,
    children: [],
  };

  private container: any;
  private splitter: any;
  private doubleClickInterval = 300;

  constructor(props: SplitterLayoutProps) {
    super(props);
    this.handleResize = this.handleResize.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleSplitterMouseDown = this.handleSplitterMouseDown.bind(this);
    this.state = {
      lastMouseDown: 0,
      secondaryPaneSize: 0,
      resizing: false,
    };

    if (props.initMediator != null) {
      props.initMediator(this);
    }
  }

  componentDidMount(): void {
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('touchend', this.handleMouseUp);
    document.addEventListener('touchmove', this.handleTouchMove);

    let secondaryPaneSize;
    if (typeof this.props.secondaryInitialSize !== 'undefined') {
      secondaryPaneSize = this.props.secondaryInitialSize;
    } else {
      const containerRect = this.container.getBoundingClientRect();
      let splitterRect;
      if (this.splitter) {
        splitterRect = this.splitter.getBoundingClientRect();
      } else {
        // Simulate a splitter
        splitterRect = { width: DEFAULT_SPLITTER_SIZE, height: DEFAULT_SPLITTER_SIZE };
      }
      secondaryPaneSize = this.getSecondaryPaneSize(
        containerRect,
        splitterRect,
        {
          left: containerRect.left + (containerRect.width - splitterRect.width) / 2,
          top: containerRect.top + (containerRect.height - splitterRect.height) / 2,
        },
        false,
      );
    }
    this.setSecondaryPaneSize(secondaryPaneSize);
  }

  componentDidUpdate(prevProps: SplitterLayoutProps, prevState: any): void {
    if (prevState.secondaryPaneSize !== this.state.secondaryPaneSize && this.props.onSecondaryPaneSizeChange) {
      this.props.onSecondaryPaneSizeChange(this.state.secondaryPaneSize);
    }
    if (prevState.resizing !== this.state.resizing) {
      if (this.state.resizing) {
        if (this.props.onDragStart) {
          this.props.onDragStart();
        }
      } else if (this.props.onDragEnd) {
        this.props.onDragEnd();
      }
    }
  }

  componentWillUnmount(): void {
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('touchend', this.handleMouseUp);
    document.removeEventListener('touchmove', this.handleTouchMove);
  }

  private clearSelection(): void {
    if ((document.body as any).createTextRange) {
      // https://github.com/zesik/react-splitter-layout/issues/16
      // https://stackoverflow.com/questions/22914075/#37580789
      const range = (document.body as any).createTextRange();
      range.collapse();
      range.select();
    } else if (window.getSelection) {
      const selection = window.getSelection();
      if (selection == null) {
        return;
      }

      if (selection.empty) {
        selection.empty();
      } else if (selection.removeAllRanges) {
        selection.removeAllRanges();
      }
    } else if ((document as any).selection) {
      (document as any).selection.empty();
    }
  }

  private getSecondaryPaneSize(containerRect: any, splitterRect: any, clientPosition: any, offsetMouse: any): number {
    let totalSize;
    let splitterSize;
    let offset;
    if (this.props.vertical) {
      totalSize = containerRect.height;
      splitterSize = splitterRect.height;
      offset = clientPosition.top - containerRect.top;
    } else {
      totalSize = containerRect.width;
      splitterSize = splitterRect.width;
      offset = clientPosition.left - containerRect.left;
    }
    if (offsetMouse) {
      offset -= splitterSize / 2;
    }
    if (offset < 0) {
      offset = 0;
    } else if (offset > totalSize - splitterSize) {
      offset = totalSize - splitterSize;
    }

    let secondaryPaneSize;
    if (this.props.primaryIndex === 1) {
      secondaryPaneSize = offset;
    } else {
      secondaryPaneSize = totalSize - splitterSize - offset;
    }
    let primaryPaneSize = totalSize - splitterSize - secondaryPaneSize;
    if (this.props.percentage) {
      secondaryPaneSize = (secondaryPaneSize * 100) / totalSize;
      primaryPaneSize = (primaryPaneSize * 100) / totalSize;
      splitterSize = (splitterSize * 100) / totalSize;
      totalSize = 100;
    }

    if (primaryPaneSize < this.props.primaryMinSize) {
      secondaryPaneSize = Math.max(secondaryPaneSize - (this.props.primaryMinSize - primaryPaneSize), 0);
    } else if (secondaryPaneSize < this.props.secondaryMinSize) {
      secondaryPaneSize = Math.min(totalSize - splitterSize - this.props.primaryMinSize, this.props.secondaryMinSize);
    }

    return secondaryPaneSize;
  }

  private setSecondaryPaneSize(secondaryPaneSize: number): void {
    this.setState({ secondaryPaneSize });
  }

  maximizeSecondaryPane(): void {
    if (this.props.percentage) {
      this.setSecondaryPaneSize(100 - this.props.primaryMinSize);
    } else {
      throw new Error('maximizeSecondaryPane() is only supported in SplitterLayout with prop `percentage`');
    }
  }

  secondaryPaneIsMinimizedToDefault(): boolean {
    const secondaryPaneSize = this.props.secondaryDefaultSize || this.props.secondaryMinSize;
    assertNotNull(secondaryPaneSize, 'secondaryPaneSize');

    return this.state.secondaryPaneSize === secondaryPaneSize;
  }

  minimizeSecondaryPaneToDefault(): void {
    const secondaryPaneSize = this.props.secondaryDefaultSize || this.props.secondaryMinSize;
    assertNotNull(secondaryPaneSize, 'secondaryPaneSize');

    this.setSecondaryPaneSize(secondaryPaneSize);
  }

  private handleResize(): void {
    if (this.splitter && !this.props.percentage) {
      const containerRect = this.container.getBoundingClientRect();
      const splitterRect = this.splitter.getBoundingClientRect();
      const secondaryPaneSize = this.getSecondaryPaneSize(
        containerRect,
        splitterRect,
        {
          left: splitterRect.left,
          top: splitterRect.top,
        },
        false,
      );
      this.setState({ secondaryPaneSize });
    }
  }

  private handleMouseMove(e: any) {
    if (this.state.resizing) {
      const containerRect = this.container.getBoundingClientRect();
      const splitterRect = this.splitter.getBoundingClientRect();
      const secondaryPaneSize = this.getSecondaryPaneSize(
        containerRect,
        splitterRect,
        {
          left: e.clientX,
          top: e.clientY,
        },
        true,
      );
      this.clearSelection();
      this.setState({ secondaryPaneSize });
    }
  }

  private handleTouchMove(e: any): void {
    this.handleMouseMove(e.changedTouches[0]);
  }

  private handleSplitterMouseDown(event): void {
    event.preventDefault();

    const now = Date.now();
    const diff = now - this.state.lastMouseDown;

    if (diff < this.doubleClickInterval) {
      this.handleSplitterDoubleClick();
    } else {
      this.clearSelection();

      this.setState({ resizing: true, lastMouseDown: now });
    }
  }

  private handleSplitterDoubleClick(): void {
    const secondaryPaneSize = this.props.secondaryDefaultSize || this.props.secondaryMinSize;
    assertNotNull(secondaryPaneSize, 'secondaryPaneSize');

    if (this.state.secondaryPaneSize === secondaryPaneSize) {
      this.setSecondaryPaneSize(Math.floor(secondaryPaneSize * 1.5));
    } else {
      this.setSecondaryPaneSize(secondaryPaneSize);
    }
  }

  private handleMouseUp(): void {
    this.setState((prevState: any) => (prevState.resizing ? { resizing: false } : null));
  }

  render(): React.JSX.Element {
    let containerClasses = 'splitter-layout';
    if (this.props.customClassName) {
      containerClasses += ` ${this.props.customClassName}`;
    }
    if (this.props.vertical) {
      containerClasses += ' splitter-layout-vertical';
    }
    if (this.state.resizing) {
      containerClasses += ' layout-changing';
    }

    const children = React.Children.toArray(this.props.children).slice(0, 2);
    if (children.length === 0) {
      children.push(<div />);
    }
    const wrappedChildren: any[] = [];
    const primaryIndex = this.props.primaryIndex !== 0 && this.props.primaryIndex !== 1 ? 0 : this.props.primaryIndex;
    for (let i = 0; i < children.length; ++i) {
      let primary = true;
      let size = undefined;
      if (children.length > 1 && i !== primaryIndex) {
        primary = false;
        size = this.state.secondaryPaneSize;
      }
      wrappedChildren.push(
        <SplitterPane vertical={this.props.vertical} percentage={this.props.percentage} primary={primary} size={size}>
          {children[i]}
        </SplitterPane>,
      );
    }

    return (
      <div
        className={containerClasses}
        ref={(containerElement) => {
          this.container = containerElement;
        }}
      >
        {wrappedChildren[0]}
        {wrappedChildren.length > 1 && (
          <div role="separator" className="layout-splitter">
            <div
              className="layout-splitter__inner"
              ref={(splitterElement) => {
                this.splitter = splitterElement;
              }}
              onMouseDown={this.handleSplitterMouseDown}
              onTouchStart={this.handleSplitterMouseDown}
            ></div>
          </div>
        )}
        {wrappedChildren.length > 1 && wrappedChildren[1]}
      </div>
    );
  }
}

function SplitterPane(props: SplitterPaneProps): React.JSX.Element {
  const size = props.size || 0;
  const unit = props.percentage ? '%' : 'px';
  let classes = 'layout-pane';
  const style: any = {};
  if (!props.primary) {
    if (props.vertical) {
      style.height = `${size}${unit}`;
    } else {
      style.width = `${size}${unit}`;
    }
  } else {
    classes += ' layout-pane-primary';
  }
  return (
    <div className={classes} style={style}>
      {props.children}
    </div>
  );
}

SplitterPane.defaultProps = {
  vertical: false,
  primary: false,
  size: 0,
  percentage: false,

  children: [],
};
