export function isMobileViewport(): boolean {
  return window.matchMedia('(max-width: 768px)').matches;
}

export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function shouldUseLowQuality(): boolean {
  return isMobileViewport() || (isTouchDevice() && window.devicePixelRatio <= 2);
}
