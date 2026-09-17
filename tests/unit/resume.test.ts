import { describe, expect, it } from 'vitest';
import {
  buildResumeModel,
  legalName,
  parseLink,
  type ResumeAchievementInput,
  type ResumeProfileInput,
} from '../../src/lib/resume.ts';
import { RESUME_SECTIONS, RESUME_SECTION_CAP } from '../../src/site.config.ts';

type Data = ResumeAchievementInput['data'];
const ach = (id: string, over: Partial<Data> & Pick<Data, 'category'>): ResumeAchievementInput => ({
  id,
  data: { title: id, date: new Date('2025-01-01T00:00:00Z'), ...over },
});

const profile: ResumeProfileInput = {
  data: {
    name: 'Sasipat (Hua) Tejahempinyo',
    nickname: 'Hua',
    headline: 'Senior at BASIS Bangkok',
    school: 'BASIS International School Bangkok',
    classOf: 2027,
    location: 'Bangkok, Thailand',
    email: 'test@example.com',
    links: ['GitHub | https://github.com/huachxng', 'https://example.com/portfolio'],
    skills: ['Python', 'R'],
    languages: ['Thai', 'English'],
    education: ['BASIS International School Bangkok ()', 'Stanford University ()'],
  },
};

const fixture: ResumeAchievementInput[] = [
  ach('ap-scholar', { category: 'academics', org: 'College Board', result: 'AP Scholar with Distinction', date: new Date('2025-07-03T00:00:00Z') }),
  ach('kangaroo', { category: 'mathematics', org: 'Kangaroo Math Thailand', date: new Date('2024-01-01T00:00:00Z'), dateText: '2024' }),
  ach('navy-open', { category: 'athletics', org: 'Royal Thai Navy', result: '1st runner-up', date: new Date('2024-11-22T00:00:00Z'), endDate: new Date('2024-11-24T00:00:00Z') }),
  ach('nhs', { category: 'leadership', org: 'NHS', resumeLine: 'President, National Honor Society (Sep 2023–present).', date: new Date('2023-09-01T00:00:00Z'), dateText: 'Sep 2023 – present' }),
  ach('stanford', { category: 'camps', org: 'Stanford University', resumeSection: 'Education', date: new Date('2026-06-22T00:00:00Z'), endDate: new Date('2026-08-16T00:00:00Z') }),
  ach('hidden', { category: 'ventures', resume: false }),
  ach('no-org', { category: 'research', result: 'Working paper' }),
];

describe('buildResumeModel', () => {
  const model = buildResumeModel(fixture, profile);
  const titles = model.sections.map((s) => s.title);
  const find = (t: string) => model.sections.find((s) => s.title === t)!;

  it('maps categories to sections and keeps the fixed section order', () => {
    expect(titles).toEqual(['Education', 'Research', 'Honors & Awards', 'Athletics', 'Leadership & Service']);
    const order = titles.map((t) => RESUME_SECTIONS.indexOf(t));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(find('Honors & Awards').items.map((i) => i.id)).toEqual(['ap-scholar', 'kangaroo']);
  });

  it('builds the default line, the date text and the href', () => {
    const [ap] = find('Honors & Awards').items;
    expect(ap.line).toBe('ap-scholar — College Board, AP Scholar with Distinction');
    expect(ap.dateText).toBe('Jul 2025');
    expect(ap.href).toBe('/achievements/ap-scholar');
    expect(find('Athletics').items[0].dateText).toBe('Nov 2024');
    expect(find('Honors & Awards').items[1].dateText).toBe('2024');
    expect(find('Research').items[0].line).toBe('no-org — Working paper');
    expect(find('Education').items[0].dateText).toBe('Jun–Aug 2026');
  });

  it('honours resumeLine and resumeSection overrides', () => {
    expect(find('Leadership & Service').items[0].line).toBe('President, National Honor Society (Sep 2023–present).');
    expect(find('Education').items.map((i) => i.id)).toEqual(['stanford']);
    expect(titles).not.toContain('Programs');
  });

  it('drops entries with resume: false and counts the rest', () => {
    expect(JSON.stringify(model)).not.toContain('hidden');
    expect(model.count).toBe(6);
  });

  it('uses the legal name in the header and never the pen name', () => {
    expect(model.header.name).toBe('Sasipat Tejahempinyo');
    expect(model.header.nickname).toBe('Hua');
    expect(model.header.email).toBe('test@example.com');
    expect(model.header.github).toBe('https://github.com/huachxng');
    expect(model.header.links).toEqual([
      { label: 'GitHub', href: 'https://github.com/huachxng' },
      { label: 'example.com/portfolio', href: 'https://example.com/portfolio' },
    ]);
    expect(model.fileName).toBe('Sasipat-Tejahempinyo-Resume.pdf');
    expect(JSON.stringify(model)).not.toMatch(/Noah/);
  });

  it('puts the school line first and cleans empty placeholders', () => {
    expect(model.education).toEqual(['BASIS International School Bangkok — Class of 2027', 'Stanford University']);
    const authored = buildResumeModel([], {
      data: { ...profile.data, education: ['BASIS International School Bangkok, High Honors track (2023–2027)'] },
    });
    expect(authored.education).toEqual(['BASIS International School Bangkok, High Honors track (2023–2027)']);
  });

  it('carries skills and languages through', () => {
    expect(model.skills).toEqual(['Python', 'R']);
    expect(model.languages).toEqual(['Thai', 'English']);
    expect(model.coursework).toEqual([]);
  });

  it('survives a JSON round trip unchanged', () => {
    expect(JSON.parse(JSON.stringify(model))).toEqual(model);
  });
});

describe('cap and ordering', () => {
  const many = Array.from({ length: 11 }, (_, i) =>
    ach(`race-${i}`, { category: 'athletics', date: new Date(Date.UTC(2020 + (i % 6), i, 1)) }),
  );

  it('orders date desc within a section and returns overflow under more', () => {
    const model = buildResumeModel(many, profile);
    const section = model.sections.find((s) => s.title === 'Athletics')!;
    expect(section.items).toHaveLength(RESUME_SECTION_CAP);
    expect(section.more).toHaveLength(11 - RESUME_SECTION_CAP);
    const all = [...section.items, ...section.more].map((i) => many.find((m) => m.id === i.id)!.data.date.getTime());
    expect(all).toEqual([...all].sort((a, b) => b - a));
    expect(model.count).toBe(11);
  });

  it('accepts a custom cap', () => {
    const [section] = buildResumeModel(many, profile, { cap: 3 }).sections;
    expect(section.title).toBe('Athletics');
    expect(section.items).toHaveLength(3);
    expect(section.more).toHaveLength(8);
  });
});

describe('helpers', () => {
  it('legalName strips nicknames and falls back to the configured legal name', () => {
    expect(legalName('Sasipat (Hua) Tejahempinyo')).toBe('Sasipat Tejahempinyo');
    expect(legalName('Sasipat "Hua" Tejahempinyo')).toBe('Sasipat Tejahempinyo');
    expect(legalName('')).toBe('Sasipat Tejahempinyo');
  });

  it('parseLink handles "Label | url" and bare urls', () => {
    expect(parseLink('GitHub | https://github.com/x')).toEqual({ label: 'GitHub', href: 'https://github.com/x' });
    expect(parseLink('https://www.example.com/')).toEqual({ label: 'example.com', href: 'https://www.example.com/' });
    expect(parseLink('   ')).toBeUndefined();
  });
});

describe('archery score fallback', () => {
  const scores = ['Elimination | 6-4 | vs seed 3', 'Ranking round | 560/720 | 72 arrows | 70 m'];
  const line = (over: Partial<Data>) =>
    buildResumeModel([ach('kasetsart', { category: 'athletics', org: 'Kasetsart University', result: '1st runner-up, Recurve Women U25', ...over })], profile)
      .sections[0].items[0].line;

  it('appends the best score when there is no resumeLine', () => {
    expect(line({ scores })).toBe('kasetsart — Kasetsart University, 1st runner-up, Recurve Women U25 (560/720, 72 arrows, 70 m)');
  });
  it('does not repeat a total that result already quotes', () => {
    expect(line({ scores, result: '1st runner-up (560 points / 72 arrows)' })).toBe('kasetsart — Kasetsart University, 1st runner-up (560 points / 72 arrows)');
    expect(line({ scores, result: 'scored 1560' })).toContain('(560/720');
  });
  it('resumeLine still wins, and unreadable or match-only scores add nothing', () => {
    expect(line({ scores, resumeLine: 'Custom line.' })).toBe('Custom line.');
    expect(line({ scores: ['personal best', 'Elimination | 6-4'] })).toBe('kasetsart — Kasetsart University, 1st runner-up, Recurve Women U25');
    expect(line({ scores: [] })).toBe('kasetsart — Kasetsart University, 1st runner-up, Recurve Women U25');
  });
});
