import { describe, it, expect } from 'vitest';
import { extractInlineTags, allTags, normalizeTag } from '../../src/lib/tags.ts';

describe('normalizeTag', () => {
  it('lowercases, strips the hash, trims and keeps nesting', () => {
    expect(normalizeTag('#Topic/Sub')).toBe('topic/sub');
    expect(normalizeTag('  AI Bubble ')).toBe('ai-bubble');
    expect(normalizeTag('foo/')).toBe('foo');
  });
});

describe('extractInlineTags', () => {
  it('finds tags in prose and keeps nested tags whole', () => {
    expect(extractInlineTags('Text about #alpha and #Topic/Sub here.')).toEqual(['alpha', 'topic/sub']);
  });
  it('excludes tags inside code, URLs, headings and math', () => {
    const body = [
      '# Heading #headtag',
      '## Another #h2tag',
      'Inline `#codetag` and https://example.com/#urlfrag stay put.',
      '```',
      '#fenced',
      '```',
      'Math $x #mathtag$ and $$\n#blockmath\n$$',
      'Real #realtag at the end.',
    ].join('\n');
    expect(extractInlineTags(body)).toEqual(['realtag']);
  });
  it('excludes number-only tags but keeps tags with letters or underscores', () => {
    expect(extractInlineTags('#2026 #2026-goals #_private #123abc')).toEqual(['2026-goals', '_private', '123abc']);
  });
  it('ignores commented-out tags and wikilink text', () => {
    expect(extractInlineTags('%% #secret %% [[Note#heading]] #shown')).toEqual(['shown']);
  });
  it('requires a boundary before the hash', () => {
    expect(extractInlineTags('C#lang word#tag &#38; a/#path')).toEqual([]);
  });
  it('supports Thai and other Unicode letters', () => {
    // Note: the tag regex accepts \p{L}\p{N} but not combining marks (\p{M}), so Thai vowel/tone marks
    // such as ู in #ธนู truncate the tag today; see docs/HANDOFF-quality.md for the suggested fix.
    expect(extractInlineTags('ยิงธนู #ไทย และ #Économie')).toEqual(['ไทย', 'économie']);
  });
});

describe('allTags', () => {
  it('unions frontmatter and inline tags, normalised and sorted', () => {
    expect(allTags(['Zeta', ' shared ', 'Topic/Sub'], 'Body with #alpha and #shared.')).toEqual(['alpha', 'shared', 'topic/sub', 'zeta']);
  });
  it('accepts a single string and ignores junk', () => {
    expect(allTags('Single', '')).toEqual(['single']);
    expect(allTags(undefined, '')).toEqual([]);
    expect(allTags([1, '', '  '], '')).toEqual([]);
  });
});
