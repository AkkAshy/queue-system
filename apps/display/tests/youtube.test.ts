import { describe, it, expect } from 'vitest';
import { youtubeId, youtubeEmbed } from '../lib/youtube';

describe('youtubeId', () => {
  it('parses youtu.be short links', () => {
    expect(youtubeId('https://youtu.be/aqz-KE-bpKQ')).toBe('aqz-KE-bpKQ');
  });
  it('parses watch?v= links', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=10')).toBe('aqz-KE-bpKQ');
  });
  it('parses /embed/ links', () => {
    expect(youtubeId('https://www.youtube.com/embed/aqz-KE-bpKQ')).toBe('aqz-KE-bpKQ');
  });
  it('returns null for empty or invalid input', () => {
    expect(youtubeId('')).toBeNull();
    expect(youtubeId(null)).toBeNull();
    expect(youtubeId('not a url')).toBeNull();
  });
});

describe('youtubeEmbed', () => {
  it('builds an autoplay/mute/loop nocookie embed', () => {
    const e = youtubeEmbed('https://youtu.be/aqz-KE-bpKQ') ?? '';
    expect(e).toContain('youtube-nocookie.com/embed/aqz-KE-bpKQ');
    expect(e).toContain('autoplay=1');
    expect(e).toContain('mute=1');
    expect(e).toContain('loop=1');
    expect(e).toContain('playlist=aqz-KE-bpKQ');
  });
  it('returns null when there is no valid id', () => {
    expect(youtubeEmbed('')).toBeNull();
  });
});
