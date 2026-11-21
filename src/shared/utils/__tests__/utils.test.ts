import { describe, expect, it } from 'vitest';
import { isSafeLogoUrl, normalizeServerUrl } from '../url';
import {
  formatDurationFromTicks,
  formatPlayerTime,
  resolveResumeStartSeconds,
  secondsToTicks,
  ticksToSeconds,
} from '../time';
import { parseCueLines } from '../subtitles';
import { getTrickplayFrame, selectTrickplayInfo } from '../trickplay';
import { parseServerBrandFromCss, upsertServerBrandInCss } from '../brand';
import { isIosBrowser } from '../platform';

describe('url utils', () => {
  it('normalizes server URLs and preserves demo protocol', () => {
    expect(normalizeServerUrl('  jellyfin.local:8096/  ')).toBe('http://jellyfin.local:8096');
    expect(normalizeServerUrl('https://media.example.com///')).toBe('https://media.example.com');
    expect(normalizeServerUrl('demo://jellyfin.local')).toBe('demo://jellyfin.local');
    expect(normalizeServerUrl('   ')).toBe('');
  });

  it('allows only safe logo URLs', () => {
    expect(isSafeLogoUrl('/brand/logo.svg')).toBe(true);
    expect(isSafeLogoUrl('https://cdn.example.com/logo.png')).toBe(true);
    expect(isSafeLogoUrl('data:image/svg+xml;base64,abc')).toBe(true);
    expect(isSafeLogoUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeLogoUrl('//evil.example.com/logo.png')).toBe(false);
    expect(isSafeLogoUrl('')).toBe(false);
  });
});

describe('time utils', () => {
  it('converts ticks and seconds accurately', () => {
    expect(ticksToSeconds(25_000_000)).toBe(2.5);
    expect(ticksToSeconds(undefined)).toBe(0);
    expect(secondsToTicks(12.5)).toBe(125_000_000);
    expect(secondsToTicks(-5)).toBe(0);
  });

  it('formats durations and player timestamps', () => {
    expect(formatDurationFromTicks(5400 * 10_000_000)).toBe('1h 30m');
    expect(formatDurationFromTicks(1800 * 10_000_000)).toBe('30m');
    expect(formatPlayerTime(65)).toBe('1:05');
    expect(formatPlayerTime(3661)).toBe('1:01:01');
    expect(formatPlayerTime(-1)).toBe('0:00');
  });
  it('resolves resume offset ignoring trivial starts and near-end timestamps', () => {
    expect(resolveResumeStartSeconds(undefined, secondsToTicks(1800))).toBe(0);
    expect(resolveResumeStartSeconds(secondsToTicks(4), secondsToTicks(1800))).toBe(0);
    expect(resolveResumeStartSeconds(secondsToTicks(900), secondsToTicks(1800))).toBe(900);
    expect(resolveResumeStartSeconds(secondsToTicks(1795), secondsToTicks(1800))).toBe(0);
    expect(resolveResumeStartSeconds(secondsToTicks(120), 0)).toBe(120);
  });
});

describe('subtitle utils', () => {
  it('strips ASS and HTML tags and splits lines', () => {
    expect(parseCueLines('{\\an8}<b>Hello</b>\n<i>World</i>\n')).toEqual(['Hello', 'World']);
  });
});

describe('trickplay utils', () => {
  it('selects resolution closest to 320px and computes tile grid coordinates', () => {
    const selection = selectTrickplayInfo({
      Id: 'item-1',
      Name: 'Movie',
      Type: 'Movie',
      Trickplay: {
        src1: {
          '160': { Width: 160, Height: 90, TileWidth: 5, TileHeight: 5, ThumbnailCount: 50, Interval: 10000 },
          '320': { Width: 320, Height: 180, TileWidth: 5, TileHeight: 5, ThumbnailCount: 50, Interval: 10000 },
        },
      },
    });
    expect(selection?.info.Width).toBe(320);
    const frame = getTrickplayFrame('https://jf.test', 'tok', 'item-1', selection!, 265);
    // 265s / 10s = index 26 -> tile 1 (25 per tile), offset 1 -> col 1, row 0
    expect(frame?.url).toContain('/Videos/item-1/Trickplay/320/1.jpg');
    expect(frame?.col).toBe(1);
    expect(frame?.row).toBe(0);
  });
});

describe('brand CSS metadata utils', () => {
  it('stores, updates, parses, and removes MorphPlay brand metadata while preserving admin CSS', () => {
    const initialCss = '.header { color: red; }';
    const withBrand = upsertServerBrandInCss(initialCss, {
      appName: 'WasiPlay',
      logoUrl: 'https://cdn.example.com/logo.svg',
    });

    expect(withBrand).toContain('.header { color: red; }');
    expect(parseServerBrandFromCss(withBrand)).toEqual({
      appName: 'WasiPlay',
      logoUrl: 'https://cdn.example.com/logo.svg',
    });

    const updated = upsertServerBrandInCss(withBrand, {
      appName: 'CineHome',
      logoUrl: 'javascript:alert(1)',
    });
    expect(parseServerBrandFromCss(updated)).toEqual({ appName: 'CineHome' });

    const cleared = upsertServerBrandInCss(updated, null);
    expect(cleared).toBe('.header { color: red; }');
    expect(parseServerBrandFromCss(cleared)).toBeNull();
  });
});

describe('platform utils', () => {
  it('detects iOS Chrome, Safari, and iPadOS touch browsers while excluding Android and desktop', () => {
    expect(
      isIosBrowser(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.0.0 Mobile/15E148 Safari/604.1',
        5,
        'iPhone'
      )
    ).toBe(true);
    expect(
      isIosBrowser(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
        5,
        'MacIntel'
      )
    ).toBe(true);
    expect(
      isIosBrowser(
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
        5,
        'Linux armv8l'
      )
    ).toBe(false);
    expect(
      isIosBrowser(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        0,
        'Win32'
      )
    ).toBe(false);
  });
});
