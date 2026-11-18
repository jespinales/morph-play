export const TICKS_PER_SECOND = 10_000_000;

export function ticksToSeconds(ticks?: number): number {
  if (!ticks || ticks <= 0) return 0;
  return ticks / TICKS_PER_SECOND;
}

export function secondsToTicks(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.round(seconds * TICKS_PER_SECOND);
}

/** Resolve valid resume offset in seconds, ignoring trivial starts or near-end timestamps. */
export function resolveResumeStartSeconds(positionTicks?: number, durationTicks?: number): number {
  const startSeconds = ticksToSeconds(positionTicks);
  if (startSeconds <= 5) return 0;
  const durationSeconds = ticksToSeconds(durationTicks);
  if (durationSeconds > 0 && startSeconds >= durationSeconds - 10) return 0;
  return startSeconds;
}

export function formatDurationFromTicks(ticks?: number): string {
  const totalMinutes = Math.round(ticksToSeconds(ticks) / 60);
  if (totalMinutes <= 0) return '';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins}m`;
}

export function formatPlayerTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const paddedSecs = secs.toString().padStart(2, '0');
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${paddedSecs}`;
  }
  return `${mins}:${paddedSecs}`;
}
