import { ReportReason, ReportSeverity } from '@qalam/shared';

import { AiSafetyDetector } from './ai-safety.detector';
import { ContentSafetyService } from './content-safety.service';
import { HeuristicSafetyDetector } from './heuristic-safety.detector';

describe('ContentSafetyService', () => {
  const service = new ContentSafetyService([new HeuristicSafetyDetector(), new AiSafetyDetector()]);

  it('flags a link-heavy spam message', async () => {
    const verdict = await service.evaluate({
      text: 'buy now http://a.com http://b.com http://c.com http://d.com',
    });
    expect(verdict.flagged).toBe(true);
    expect(verdict.signals.some((s) => s.reason === ReportReason.Spam)).toBe(true);
  });

  it('flags severe self-harm language as critical', async () => {
    const verdict = await service.evaluate({ text: 'kys' });
    expect(verdict.flagged).toBe(true);
    expect(verdict.recommendedSeverity).toBe(ReportSeverity.Critical);
  });

  it('passes benign content', async () => {
    const verdict = await service.evaluate({ text: 'A thoughtful paragraph about writing craft.' });
    expect(verdict.flagged).toBe(false);
    expect(verdict.score).toBe(0);
    expect(verdict.recommendedSeverity).toBeNull();
  });

  it('isolates a failing detector', async () => {
    const boom = {
      name: 'boom',
      detect() {
        throw new Error('detector down');
      },
    };
    const resilient = new ContentSafetyService([boom, new HeuristicSafetyDetector()]);
    const verdict = await resilient.evaluate({ text: 'kys' });
    expect(verdict.flagged).toBe(true); // heuristic still ran
  });
});
