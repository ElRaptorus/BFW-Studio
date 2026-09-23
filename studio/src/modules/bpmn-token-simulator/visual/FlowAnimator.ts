const ANIMATION_TOKEN_CLASS = 'token-sim-flow-token';
const LAYER_NAME = 'token-simulation';

interface ActiveAnimation {
  circle: SVGCircleElement;
  animationId: number;
  startTime: number;
  durationMs: number;
  pausedElapsed: number;
  done: () => void;
  connection: any;
  /** Set for sequence-flow tokens, whose cancellation the engine announces by this id */
  engineAnimationId?: number;
  segments: { from: { x: number; y: number }; to: { x: number; y: number }; length: number }[];
  totalLength: number;
}

export class FlowAnimator {
  private canvas: any;
  private activeAnimations: ActiveAnimation[] = [];
  private _paused = false;

  constructor(canvas: any) {
    this.canvas = canvas;
  }

  animate(
    connection: any,
    durationMs: number,
    done: () => void,
    tokenClass?: string,
    engineAnimationId?: number,
  ): void {
    const waypoints: { x: number; y: number }[] = connection.waypoints;
    if (!waypoints || waypoints.length < 2) {
      done();
      return;
    }
    if (durationMs <= 0) {
      done();
      return;
    }

    const layer: SVGGElement = this.canvas.getLayer(LAYER_NAME, 1);

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', String(waypoints[0].x));
    circle.setAttribute('cy', String(waypoints[0].y));
    circle.setAttribute('r', '6');
    circle.setAttribute('class', tokenClass ?? ANIMATION_TOKEN_CLASS);
    layer.appendChild(circle);

    const segments = this.computeSegments(waypoints);
    const totalLength = segments.reduce((sum, seg) => sum + seg.length, 0);

    const entry: ActiveAnimation = {
      circle,
      animationId: 0,
      startTime: performance.now(),
      durationMs,
      pausedElapsed: 0,
      done,
      connection,
      engineAnimationId,
      segments,
      totalLength,
    };
    this.activeAnimations.push(entry);

    if (!this._paused) {
      this.startTicking(entry);
    }
  }

  pause(): void {
    if (this._paused) {
      return;
    }
    this._paused = true;
    const now = performance.now();
    for (const entry of this.activeAnimations) {
      cancelAnimationFrame(entry.animationId);
      entry.animationId = 0;
      entry.pausedElapsed = now - entry.startTime;
    }
  }

  resume(): void {
    if (!this._paused) {
      return;
    }
    this._paused = false;
    const now = performance.now();
    for (const entry of this.activeAnimations) {
      entry.startTime = now - entry.pausedElapsed;
      this.startTicking(entry);
    }
  }

  clear(): void {
    this._paused = false;
    for (const entry of this.activeAnimations) {
      cancelAnimationFrame(entry.animationId);
      entry.circle.remove();
    }
    this.activeAnimations = [];
  }

  /**
   * Stops the animations with the given engine animation ids without calling their `done`:
   * the engine has already taken those tokens back. Animations of other scopes on the same
   * connection keep running.
   */
  cancelAnimations(engineAnimationIds: number[]): void {
    const cancelledIds = new Set(engineAnimationIds);
    const isCancelled = (entry: ActiveAnimation) =>
      entry.engineAnimationId !== undefined && cancelledIds.has(entry.engineAnimationId);
    for (const entry of this.activeAnimations.filter(isCancelled)) {
      cancelAnimationFrame(entry.animationId);
      entry.circle.remove();
    }
    this.activeAnimations = this.activeAnimations.filter((entry) => !isCancelled(entry));
  }

  showRipple(element: any, durationMs: number): void {
    const layer: SVGGElement = this.canvas.getLayer(LAYER_NAME, 1);
    const cx = element.x + (element.width ?? 0) / 2;
    const cy = element.y + (element.height ?? 0) / 2;
    const rippleCount = 3;
    const stagger = 150;

    for (let i = 0; i < rippleCount; i++) {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(cx));
      circle.setAttribute('cy', String(cy));
      circle.setAttribute('r', '8');
      circle.setAttribute('class', 'token-sim-signal-ripple');
      circle.style.animationDuration = `${durationMs}ms`;
      circle.style.animationDelay = `${i * stagger}ms`;
      layer.appendChild(circle);

      setTimeout(
        () => {
          circle.remove();
        },
        durationMs + i * stagger + 50,
      );
    }
  }

  private easeInOut(normalizedProgress: number): number {
    return normalizedProgress < 0.5
      ? 2 * normalizedProgress * normalizedProgress
      : 1 - Math.pow(-2 * normalizedProgress + 2, 2) / 2;
  }

  private startTicking(entry: ActiveAnimation): void {
    const tick = (now: number) => {
      if (this._paused) {
        return;
      }

      const elapsed = now - entry.startTime;
      const progress = Math.min(elapsed / entry.durationMs, 1);
      const targetDist = this.easeInOut(progress) * entry.totalLength;

      const pos = this.interpolatePosition(entry.segments, targetDist);
      entry.circle.setAttribute('cx', String(pos.x));
      entry.circle.setAttribute('cy', String(pos.y));

      if (progress < 1) {
        entry.animationId = requestAnimationFrame(tick);
      } else {
        entry.circle.remove();
        this.activeAnimations = this.activeAnimations.filter((activeAnimation) => activeAnimation !== entry);
        entry.done();
      }
    };

    entry.animationId = requestAnimationFrame(tick);
  }

  private computeSegments(waypoints: { x: number; y: number }[]): {
    from: { x: number; y: number };
    to: { x: number; y: number };
    length: number;
  }[] {
    const segments: {
      from: { x: number; y: number };
      to: { x: number; y: number };
      length: number;
    }[] = [];

    for (let i = 1; i < waypoints.length; i++) {
      const from = waypoints[i - 1];
      const to = waypoints[i];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      segments.push({ from, to, length: Math.sqrt(dx * dx + dy * dy) });
    }

    return segments;
  }

  private interpolatePosition(
    segments: { from: { x: number; y: number }; to: { x: number; y: number }; length: number }[],
    targetDist: number,
  ): { x: number; y: number } {
    let accumulated = 0;

    for (const seg of segments) {
      if (accumulated + seg.length >= targetDist) {
        const localProgress = seg.length > 0 ? (targetDist - accumulated) / seg.length : 0;
        return {
          x: seg.from.x + (seg.to.x - seg.from.x) * localProgress,
          y: seg.from.y + (seg.to.y - seg.from.y) * localProgress,
        };
      }
      accumulated += seg.length;
    }

    const last = segments[segments.length - 1];
    return last ? { x: last.to.x, y: last.to.y } : { x: 0, y: 0 };
  }
}
