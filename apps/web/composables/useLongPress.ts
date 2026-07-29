interface LongPressOptions {
  delay?: number;
  moveTolerance?: number;
}

const DEFAULT_DELAY_MS = 450;
const DEFAULT_MOVE_TOLERANCE_PX = 10;

export function useLongPress<T>(
  onTrigger: (item: T, event: PointerEvent) => void,
  options: LongPressOptions = {},
) {
  const delay = options.delay ?? DEFAULT_DELAY_MS;
  const moveTolerance = options.moveTolerance ?? DEFAULT_MOVE_TOLERANCE_PX;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let startPoint: { x: number; y: number } | null = null;

  function cancel(): void {
    if (timer) clearTimeout(timer);
    timer = null;
    startPoint = null;
  }

  function start(event: PointerEvent, item: T): void {
    if (event.pointerType === 'mouse') return;
    cancel();
    startPoint = { x: event.clientX, y: event.clientY };
    timer = setTimeout(() => {
      timer = null;
      if ('vibrate' in navigator) navigator.vibrate(8);
      onTrigger(item, event);
    }, delay);
  }

  function move(event: PointerEvent): void {
    if (!startPoint || !timer) return;
    // Drifting past the tolerance means the user is scrolling, not pressing.
    const distance = Math.hypot(event.clientX - startPoint.x, event.clientY - startPoint.y);
    if (distance > moveTolerance) cancel();
  }

  // Suppresses the Android long-press menu while a touch press is in flight.
  function onContextMenu(event: Event): void {
    if (startPoint) event.preventDefault();
  }

  onScopeDispose(cancel);

  return { start, move, cancel, onContextMenu };
}
