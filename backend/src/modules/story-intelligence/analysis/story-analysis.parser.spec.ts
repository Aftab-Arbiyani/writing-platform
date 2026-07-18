import {
  StoryAnalysisKind,
  StoryAnalysisStatus,
  StoryEdgeType,
  StoryNodeType,
} from '@qalam/shared';

import { parseStoryAnalysis } from './story-analysis.parser';

describe('parseStoryAnalysis (structured objects first)', () => {
  it('degrades to a failed status with the raw text when no JSON is present', () => {
    const result = parseStoryAnalysis(StoryAnalysisKind.Character, 'the model refused to answer');
    expect(result.status).toBe(StoryAnalysisStatus.Failed);
    expect(result.rawOutput).toBe('the model refused to answer');
    expect(result.nodes).toEqual([]);
    expect(result.edges).toEqual([]);
    expect(result.structured).toEqual({});
  });

  it('recovers JSON wrapped in code fences + prose', () => {
    const raw =
      'Here you go:\n```json\n{"characters":[{"name":"Aria"}],"summary":"ok","confidence":50}\n```';
    const result = parseStoryAnalysis(StoryAnalysisKind.Character, raw);
    expect(result.status).toBe(StoryAnalysisStatus.Completed);
    expect(result.rawOutput).toBeNull();
    expect(result.summary).toBe('ok');
    expect(result.confidenceScore).toBeCloseTo(0.5);
  });

  describe('character', () => {
    const raw = JSON.stringify({
      characters: [
        {
          name: 'Aria',
          aliases: ['The Wanderer'],
          role: 'protagonist',
          traits: ['brave'],
          goals: ['find home'],
          motivations: ['belonging'],
          arc: 'grows into a leader',
          growth: 'learns to trust',
          firstChapter: 'Chapter 1',
          evidence: [{ chapterRef: 'Chapter 1', quote: 'Aria walked alone.' }],
        },
        { name: 'Kael', role: 'supporting' },
      ],
      relationships: [
        {
          from: 'Aria',
          to: 'Kael',
          type: 'ally',
          description: 'grows to trust Kael',
          evidence: [],
        },
      ],
      summary: 'A journey of trust.',
      recommendations: ['Give Kael a clearer motive'],
      confidence: 82,
      affectedChapters: ['Chapter 1'],
    });

    it('builds character nodes + a relationship edge + affected characters', () => {
      const result = parseStoryAnalysis(StoryAnalysisKind.Character, raw);
      expect(result.nodes).toHaveLength(2);
      const aria = result.nodes.find((n) => n.name === 'Aria');
      expect(aria?.type).toBe(StoryNodeType.Character);
      expect(aria?.aliases).toEqual(['The Wanderer']);
      expect(aria?.data.role).toBe('protagonist');
      expect(aria?.data.goals).toEqual(['find home']);
      expect(aria?.evidence[0]?.quote).toBe('Aria walked alone.');

      expect(result.edges).toHaveLength(1);
      expect(result.edges[0]?.type).toBe(StoryEdgeType.Relationship);
      expect(result.edges[0]?.sourceName).toBe('Aria');
      expect(result.edges[0]?.targetName).toBe('Kael');

      expect(result.affectedCharacters).toEqual(expect.arrayContaining(['Aria', 'Kael']));
      expect(result.confidenceScore).toBeCloseTo(0.82);
    });
  });

  describe('world building', () => {
    it('maps each world element to its node type', () => {
      const raw = JSON.stringify({
        locations: [{ name: 'Aethel', description: 'a floating city' }],
        organizations: [{ name: 'The Order', description: 'mage council' }],
        objects: [{ name: 'Sunstone', significance: 'powers the city' }],
        magicSystems: [{ name: 'Weaving', rules: ['costs memory'], description: 'thread magic' }],
        terminology: [{ term: 'Weaver', definition: 'a magic user' }],
        summary: 'Rich world.',
        confidence: 70,
      });
      const result = parseStoryAnalysis(StoryAnalysisKind.World, raw);
      const byType = (t: string): string[] =>
        result.nodes.filter((n) => n.type === t).map((n) => n.name);
      expect(byType(StoryNodeType.Location)).toEqual(['Aethel']);
      expect(byType(StoryNodeType.Organization)).toEqual(['The Order']);
      expect(byType(StoryNodeType.Object)).toEqual(['Sunstone']);
      expect(byType(StoryNodeType.Concept)).toEqual(expect.arrayContaining(['Weaving', 'Weaver']));
    });
  });

  describe('timeline', () => {
    it('orders events, links precedes/occurs-at/involves edges', () => {
      const raw = JSON.stringify({
        events: [
          {
            name: 'The Fall',
            description: 'the city fell',
            kind: 'flashback',
            order: 0,
            characters: ['Aria'],
            location: 'Aethel',
          },
          {
            name: 'The Return',
            description: 'Aria returns',
            kind: 'chronological',
            order: 1,
            characters: ['Aria'],
          },
        ],
        summary: 'Two beats.',
        confidence: 60,
      });
      const result = parseStoryAnalysis(StoryAnalysisKind.Timeline, raw);
      const events = result.nodes.filter((n) => n.type === StoryNodeType.Event);
      expect(events.map((e) => e.name)).toEqual(['The Fall', 'The Return']);
      expect(events[0]?.data.kind).toBe('flashback');
      expect(result.edges.some((e) => e.type === StoryEdgeType.Precedes)).toBe(true);
      expect(result.edges.some((e) => e.type === StoryEdgeType.OccursAt)).toBe(true);
      expect(result.edges.some((e) => e.type === StoryEdgeType.Involves)).toBe(true);
      expect(result.affectedCharacters).toEqual(['Aria']);
    });
  });

  describe('plot', () => {
    it('keeps structure in `structured` and makes a climax event node', () => {
      const raw = JSON.stringify({
        acts: [{ name: 'Act I', summary: 'setup', scenes: ['s1'] }],
        conflicts: [{ description: 'man vs self', kind: 'internal' }],
        plotHoles: [{ title: 'lost sword', detail: 'reappears', severity: 'major' }],
        climax: { description: 'the duel', chapterRef: 'Chapter 9' },
        pacing: { assessment: 'brisk', score: 70 },
        narrativeArc: 'rise-fall',
        summary: 'Solid.',
        confidence: 65,
      });
      const result = parseStoryAnalysis(StoryAnalysisKind.Plot, raw);
      const structured = result.structured as Record<string, unknown>;
      expect(Array.isArray(structured.acts)).toBe(true);
      expect(Array.isArray(structured.plotHoles)).toBe(true);
      const events = result.nodes.filter((n) => n.type === StoryNodeType.Event);
      expect(events.some((e) => e.name === 'Climax')).toBe(true);
    });
  });

  describe('style', () => {
    it('produces structured metrics and no graph writes', () => {
      const raw = JSON.stringify({
        readability: { score: 80, assessment: 'clear' },
        passiveVoice: { count: 3, examples: ['was seen'] },
        summary: 'Clean prose.',
        confidence: 75,
      });
      const result = parseStoryAnalysis(StoryAnalysisKind.Style, raw);
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
      const structured = result.structured as Record<string, unknown>;
      expect((structured.readability as Record<string, unknown>).score).toBe(80);
    });
  });
});
