/**
 * Responsive utility functions and constants for cross-device compatibility
 */

// Breakpoint definitions
export const BREAKPOINTS = {
  sm: 640,   // Small screens (mobile)
  md: 768,   // Medium screens (tablet)
  lg: 1024,  // Large screens (desktop)
  xl: 1280,  // Extra large screens (large desktop)
  '2xl': 1536, // 2x extra large screens (TV/ultrawide)
} as const;

// Touch target minimum size (44px recommended by WCAG)
export const MIN_TOUCH_TARGET_SIZE = 44;

// Safe area insets for mobile devices
export const SAFE_AREA_INSETS = {
  top: 'env(safe-area-inset-top)',
  bottom: 'env(safe-area-inset-bottom)',
  left: 'env(safe-area-inset-left)',
  right: 'env(safe-area-inset-right)',
};

// Check if device is touch-capable
export function isTouchDevice(): boolean {
  return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}

// Check if device is a mobile device
export function isMobileDevice(): boolean {
  return window.innerWidth <= BREAKPOINTS.sm;
}

// Check if device is a tablet
export function isTabletDevice(): boolean {
  return window.innerWidth > BREAKPOINTS.sm && window.innerWidth <= BREAKPOINTS.md;
}

// Check if device is desktop or larger
export function isDesktopDevice(): boolean {
  return window.innerWidth > BREAKPOINTS.md;
}

// Check if device is a TV or very large screen
export function isTvDevice(): boolean {
  return window.innerWidth >= BREAKPOINTS.xl;
}

// Get device type string
export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' | 'tv' {
  if (isMobileDevice()) return 'mobile';
  if (isTabletDevice()) return 'tablet';
  if (isTvDevice()) return 'tv';
  return 'desktop';
}

// Debounce function for resize events
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
  };
}

// Throttle function for scroll events
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}