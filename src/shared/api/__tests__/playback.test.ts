import { describe, expect, it } from 'vitest';
import { DEMO_SERVER_URL } from '../demo/demoData';
import {
  buildPlaybackStream,
  getChapterImageUrl,
  getSubtitleFontAttachments,
  getUserAvatarUrl,
  qualityToBitrate,
  qualityToMaxHeight,
} from '../playback';
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

  it('uses server TranscodingUrl when encoded subtitle matches PlaybackInfo URL', () => {
    const negotiatedSource: MediaSourceInfo = {
      ...mp4Source,
      TranscodingUrl:
        '/Videos/item-1/main.m3u8?SubtitleStreamIndex=3&SubtitleMethod=Encode&PlaySessionId=sess-2',
    };
    const stream = buildPlaybackStream(
      'https://jf.test',
      'tok',
      'item-1',
      negotiatedSource,
      'sess-2',
      1,
      'auto',
      3
    );
    expect(stream.streamUrl).toBe(
      'https://jf.test/Videos/item-1/main.m3u8?SubtitleStreamIndex=3&SubtitleMethod=Encode&PlaySessionId=sess-2'
    );
  });

  it('builds chapter thumbnail URLs and 12.4.0 UserImage avatar URLs', () => {
    expect(getChapterImageUrl('https://jf.test', 'item-1', 2, 'tag-9')).toBe(
      'https://jf.test/Items/item-1/Images/Chapter/2?maxWidth=360&quality=85&tag=tag-9'
    );
    expect(getChapterImageUrl('https://jf.test', 'item-1', 2, undefined)).toBeNull();
    expect(getChapterImageUrl(DEMO_SERVER_URL, 'item-1', 2, 'tag-9')).toBeNull();
    expect(getUserAvatarUrl('https://jf.test', { Id: 'u1', Name: 'Alice', PrimaryImageTag: 'ava1' })).toBe(
      'https://jf.test/UserImage?userId=u1&tag=ava1'
    );
  });

  it('delivers ASS/SSA subtitles for client-side JASSUB rendering without forcing transcode burn-in', () => {
    const assSource: MediaSourceInfo = {
      Id: 'src-ass',
      Container: 'mp4',
      SupportsDirectPlay: true,
      DefaultAudioStreamIndex: 1,
      MediaStreams: [
        { Type: 'Video', Index: 0, Codec: 'h264' },
        { Type: 'Audio', Index: 1, Codec: 'aac', Language: 'jpn' },
        { Type: 'Subtitle', Index: 2, Codec: 'ass', Language: 'spa', SupportsExternalStream: true },
      ],
      MediaAttachments: [
        { Index: 3, FileName: 'CustomFont.ttf', MimeType: 'font/ttf' },
        { Index: 4, FileName: 'cover.jpg', MimeType: 'image/jpeg' },
      ],
    };

    const stream = buildPlaybackStream('https://jf.test', 'tok', 'item-2', assSource, 'sess-3', 1, 'auto', 2);
    expect(stream.playMethod).toBe('DirectPlay');
    expect(stream.encodedSubtitleIndex).toBeUndefined();
    expect(stream.allSubtitles[0]).toMatchObject({
      index: 2,
      delivery: 'ass',
      src: 'https://jf.test/Videos/item-2/src-ass/Subtitles/2/0/Stream.ass?ApiKey=tok',
      fallbackVttSrc: 'https://jf.test/Videos/item-2/src-ass/Subtitles/2/0/Stream.vtt?ApiKey=tok',
    });

    expect(getSubtitleFontAttachments('https://jf.test', 'item-2', assSource, 'tok')).toEqual([
      'https://jf.test/Videos/item-2/src-ass/Attachments/3?ApiKey=tok',
    ]);
  });

  it('caps transcode stream bitrate and height when a lower quality tier is selected', () => {
    const hdSource: MediaSourceInfo = {
      Id: 'src-hd',
      Container: 'mp4',
      SupportsDirectPlay: true,
      DefaultAudioStreamIndex: 1,
      Bitrate: 15_000_000,
      MediaStreams: [
        { Type: 'Video', Index: 0, Codec: 'h264', Height: 1080 },
        { Type: 'Audio', Index: 1, Codec: 'aac', Language: 'eng' },
      ],
    };

    expect(qualityToBitrate('360p')).toBe(1_500_000);
    expect(qualityToMaxHeight('720p')).toBe(720);
    expect(qualityToMaxHeight('auto')).toBeUndefined();

    const stream = buildPlaybackStream('https://jf.test', 'tok', 'item-3', hdSource, 'sess-4', 1, '720p');
    expect(stream.playMethod).toBe('Transcode');
    expect(stream.isHls).toBe(true);
    expect(stream.streamUrl).toContain('VideoBitrate=8000000');
    expect(stream.streamUrl).toContain('MaxHeight=720');
  });
});
