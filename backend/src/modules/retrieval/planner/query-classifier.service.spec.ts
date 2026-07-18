import { RetrievalQueryType } from '@qalam/shared';

import { QueryClassifierService } from './query-classifier.service';

describe('QueryClassifierService', () => {
  const svc = new QueryClassifierService();

  it('honours an explicit hint without inspecting the query', () => {
    expect(svc.classify('anything at all', RetrievalQueryType.Location)).toBe(
      RetrievalQueryType.Location,
    );
  });

  it('classifies characters, locations, timeline, relationships, dialogue', () => {
    expect(svc.classify('who is the protagonist?')).toBe(RetrievalQueryType.Character);
    expect(svc.classify('where is the hidden city')).toBe(RetrievalQueryType.Location);
    expect(svc.classify('what is the order of events')).toBe(RetrievalQueryType.Timeline);
    expect(svc.classify('the relationship between Aria and Kael')).toBe(
      RetrievalQueryType.Relationship,
    );
    expect(svc.classify('what did she say to him')).toBe(RetrievalQueryType.Dialogue);
  });

  it('falls back to natural language when nothing matches', () => {
    expect(svc.classify('a quiet reflective mood')).toBe(RetrievalQueryType.NaturalLanguage);
    expect(svc.classify('')).toBe(RetrievalQueryType.NaturalLanguage);
  });
});
