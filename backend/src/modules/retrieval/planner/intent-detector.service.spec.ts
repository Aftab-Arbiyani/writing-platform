import { RetrievalIntent } from '@qalam/shared';

import { IntentDetectionService } from './intent-detector.service';

describe('IntentDetectionService', () => {
  const svc = new IntentDetectionService();

  it('honours an explicit intent', () => {
    expect(svc.detect('anything', RetrievalIntent.Recommend)).toBe(RetrievalIntent.Recommend);
  });

  it('detects ask / recommend / explore / search from phrasing', () => {
    expect(svc.detect('who killed the king?')).toBe(RetrievalIntent.Ask);
    expect(svc.detect('recommend stories like mine')).toBe(RetrievalIntent.Recommend);
    expect(svc.detect('show all characters')).toBe(RetrievalIntent.Explore);
    expect(svc.detect('dark forest ballad')).toBe(RetrievalIntent.Search);
    expect(svc.detect('')).toBe(RetrievalIntent.Explore);
  });
});
