import type { ReactElement } from 'react';

/**
 * The one sentence every writing tool says about itself (D5 decision 9).
 *
 * **Why disclose at all, in a change whose whole point is to stop saying "AI".** The two are the
 * same decision, not opposite ones. This audience rejects AI branding *and* rejects concealment;
 * what they object to is a product that leads with the technology or hides it. A tool named for what
 * it does, with a quiet line saying how it works, is neither.
 *
 * So the placement is deliberate: at the FOOT of the tool, where a writer who wants to know finds
 * it, and not on the nav, the button, or the plan card. It is a footnote, not a badge.
 *
 * The second clause is a factual claim about the deployment, not reassurance — providers are
 * configured with training disabled, and D5 removed the conversation layer that was the only thing
 * storing draft text server-side. If either stops being true this sentence must change first.
 */
export function ModelDisclosureNote(): ReactElement {
  return (
    <p data-testid="model-disclosure" className="text-ink-muted border-t border-line pt-3 text-xs">
      Produced by a language model. Your text isn’t used to train it.
    </p>
  );
}
