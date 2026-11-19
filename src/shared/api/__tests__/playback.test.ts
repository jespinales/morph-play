import { describe, expect, it } from 'vitest';
import { DEMO_SERVER_URL } from '../demo/demoData';
import { buildPlaybackStream, getChapterImageUrl } from '../playback';
import { MediaSourceInfo } from '../../types/jellyfin';

describe('playback stream builder', () => {
  const mp4Source: MediaSourceInfo = {
    Id: 'src-1',
    Container: 'mp4',
    SupportsDirectPlay: true,
    DefaultAudioStreamIndex: 1,
    MediaStreams: [
      { Type: 'Video', Index: 0, Codec: 'h264' },
      { Type: 'Audio', Index: 1, Codec: 'aac', Language: 'eng' },
      { Type: 'Subtitle', Index: 2, Codec: 'subrip', Language: 'spa', SupportsExternalStream: true },
      { Type: 'Subtitle', Index: 3, Codec: 'pgssub', Language: 'eng' },
    ],
  };

  it('uses DirectPlay for compatible MP4 without graphical subtitles', () => {
    const stream = buildPlaybackStream('https://jf.test', 'tok', 'item-1', mp4Source, 'sess-1', 1, 'auto', 2);
    expect(stream.playMethod).toBe('DirectPlay');
    expect(stream.isHls).toBe(false);
    expect(stream.allSubtitles.map((s) => s.delivery)).toEqual(['external', 'encode']);
    expect(stream.subtitleTracks).toHaveLength(1);
    expect(stream.encodedSubtitleIndex).toBeUndefined();
  });

  it('forces HLS burn-in transcode when selecting a graphical subtitle stream', () => {
    const stream = buildPlaybackStream('https://jf.test', 'tok', 'item-1', mp4Source, 'sess-1', 1, 'auto', 3);
    expect(stream.playMethod).toBe('Transcode');
    expect(stream.isHls).toBe(true);
    expect(stream.encodedSubtitleIndex).toBe(3);
    expect(stream.streamUrl).toContain('SubtitleStreamIndex=3');
    expect(stream.streamUrl).toContain('SubtitleMethod=Encode');
  });

  it('builds chapter thumbnail URLs only when an image tag exists', () => {
    expect(getChapterImageUrl('https://jf.test', 'item-1', 2, 'tag-9')).toBe(
      'https://jf.test/Items/item-1/Images/Chapter/2?maxWidth=360&quality=85&tag=tag-9'
    );
    expect(getChapterImageUrl('https://jf.test', 'item-1', 2, undefined)).toBeNull();
    expect(getChapterImageUrl(DEMO_SERVER_URL, 'item-1', 2, 'tag-9')).toBeNull();
  });
});
