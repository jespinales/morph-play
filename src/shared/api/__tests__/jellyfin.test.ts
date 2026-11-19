import { describe, expect, it } from 'vitest';
import { dedupeResumeItemsBySeries } from '../jellyfin';
import { BaseItemDto } from '../../types/jellyfin';

describe('dedupeResumeItemsBySeries', () => {
  it('keeps only the most recently played episode per series while keeping movies', () => {
    const items: BaseItemDto[] = [
      {
        Id: 'ep-s1e1',
        Name: 'The Strongest Man',
        Type: 'Episode',
        SeriesId: 'series-opm',
        SeriesName: 'One Punch Man',
        UserData: { LastPlayedDate: '2026-11-18T12:00:00Z', PlaybackPositionTicks: 500 },
      },
      {
        Id: 'movie-1',
        Name: 'Example Film',
        Type: 'Movie',
        UserData: { LastPlayedDate: '2026-11-19T09:00:00Z', PlaybackPositionTicks: 900 },
      },
      {
        Id: 'ep-s3e1',
        Name: 'Strategy Meeting',
        Type: 'Episode',
        SeriesId: 'series-opm',
        SeriesName: 'One Punch Man',
        UserData: { LastPlayedDate: '2026-11-19T11:00:00Z', PlaybackPositionTicks: 300 },
      },
    ];

    const result = dedupeResumeItemsBySeries(items);
    expect(result.map((i) => i.Id)).toEqual(['ep-s3e1', 'movie-1']);
  });

  it('preserves server order when LastPlayedDate is absent and respects limit', () => {
    const items: BaseItemDto[] = [
      { Id: 'ep-first', Name: 'First Returned', Type: 'Episode', SeriesId: 'series-a' },
      { Id: 'ep-second', Name: 'Duplicate Series', Type: 'Episode', SeriesId: 'series-a' },
      { Id: 'movie-a', Name: 'Movie A', Type: 'Movie' },
      { Id: 'movie-b', Name: 'Movie B', Type: 'Movie' },
    ];

    const result = dedupeResumeItemsBySeries(items, 2);
    expect(result.map((i) => i.Id)).toEqual(['ep-first', 'movie-a']);
  });
});
