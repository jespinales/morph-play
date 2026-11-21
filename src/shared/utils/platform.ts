/**
 * Detects iOS and iPadOS WebKit browsers (Safari, Chrome on iOS, etc.), including iPadOS desktop mode.
 */
export function isIosBrowser(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  maxTouchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0,
  platform = typeof navigator !== 'undefined' ? navigator.platform : ''
): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  return platform === 'MacIntel' && maxTouchPoints > 1;
}
