import { AiFeature } from '@qalam/shared';
import { useMutation } from '@tanstack/react-query';

import { operandOf, useAiEditorTarget } from '@/stores/ai-editor-target.store';

import { aiApi } from '../api/ai.api';
import { parseCoachReport, type CoachReport } from '../lib/coach-report';
import type { CoachTool } from '../lib/coach-tools';

export interface CoachResult {
  tool: CoachTool;
  /** Parsed when the model honoured its JSON contract; null when it did not. */
  report: CoachReport | null;
  /** Always kept, so a failed parse can still show the writer what came back. */
  raw: string;
}

/**
 * Run a Craft Coach lens over the current draft (W2/AF2).
 *
 * **Buffered, not streamed** — the opposite choice from the Writing Assistant, and deliberate:
 * a coach response is a single JSON object that means nothing until it is complete, so
 * streaming it would show the writer a half-parsed brace rather than progress. The assistant
 * streams because prose reads as it arrives; the coach does not because a report does not.
 *
 * A response that cannot be parsed is not an error — `report` is null and `raw` carries the
 * text, and the UI shows that instead (see `coach-report`).
 */
export function useCraftCoach() {
  const target = useAiEditorTarget((s) => s.target);

  return useMutation<CoachResult, unknown, CoachTool>({
    mutationFn: async (tool: CoachTool): Promise<CoachResult> => {
      const context = target?.getContext();
      const operand = context ? operandOf(context) : '';
      if (operand === '') throw new Error('Nothing to review yet.');

      const response = await aiApi.complete({
        feature: AiFeature.CraftCoach,
        promptKey: tool.promptKey,
        messages: [{ role: 'user', content: operand }],
        context: [
          {
            type: 'writing_metadata',
            params: {
              title: context?.title ?? '',
              language: context?.language ?? '',
              wordCount: context?.wordCount ?? 0,
            },
          },
        ],
      });

      const raw = response.message.content;
      return { tool, report: parseCoachReport(raw), raw };
    },
  });
}
