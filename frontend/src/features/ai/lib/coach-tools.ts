/**
 * Craft Coach tools (W2/AF2) — the client vocabulary mapping each coaching lens to a **server**
 * prompt-template key. Every coach template returns the SAME structured JSON
 * ([`coach-report`](./coach-report.ts)); the tool only changes the lens.
 *
 * As with the writing actions, no prompt text lives here — identifiers and display copy only.
 */
export interface CoachTool {
  value: string;
  promptKey: string;
  label: string;
  description: string;
}

/** Typed as non-empty so the first entry can be the default without a null check. */
export const COACH_TOOLS: readonly [CoachTool, ...CoachTool[]] = [
  {
    value: 'chapter_feedback',
    promptKey: 'craft_coach.chapter_feedback',
    label: 'Chapter feedback',
    description: 'Holistic developmental notes on the whole chapter.',
  },
  {
    value: 'scene_feedback',
    promptKey: 'craft_coach.scene_feedback',
    label: 'Scene feedback',
    description: 'Stakes, tension, blocking, and sensory grounding.',
  },
  {
    value: 'pacing',
    promptKey: 'craft_coach.pacing',
    label: 'Pacing analysis',
    description: 'Where the writing drags, rushes, or stalls.',
  },
  {
    value: 'readability',
    promptKey: 'craft_coach.readability',
    label: 'Readability review',
    description: 'Sentence variety, clarity, and flow.',
  },
  {
    value: 'consistency',
    promptKey: 'craft_coach.consistency',
    label: 'Consistency review',
    description: 'Tense, POV, names, timeline, and stated facts.',
  },
  {
    value: 'review',
    promptKey: 'craft_coach.review',
    label: 'Full craft review',
    description: 'Strengths, weaknesses, score, and next steps.',
  },
];
