import { QButton } from '@qalam/ui';
import { fadeRise } from '@qalam/ui/motion';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactElement } from 'react';

/**
 * Sticky Save bar for a dirty form (docs/06 §3.8, §10.1). Fades/rises in via the shared
 * `fadeRise` variant (reduced-motion is collapsed by the MotionProvider). Rendered INSIDE the
 * `<form>` so its primary button submits (`htmlType="submit"`); Discard resets. It docks to the
 * bottom of the content column and announces itself politely.
 */
export function SaveBar({
  visible,
  isSaving,
  onDiscard,
}: {
  visible: boolean;
  isSaving: boolean;
  onDiscard: () => void;
}): ReactElement {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          variants={fadeRise}
          initial="initial"
          animate="animate"
          exit="exit"
          role="region"
          aria-label="Unsaved changes"
          className="sticky bottom-4 z-10 mt-2 flex items-center justify-between gap-3 rounded-lg border border-line bg-raised/95 px-4 py-3 shadow-[var(--q-shadow-2)] backdrop-blur"
        >
          <span aria-live="polite" className="text-sm text-ink-secondary">
            You have unsaved changes
          </span>
          <div className="flex items-center gap-2">
            <QButton variant="ghost" size="sm" onClick={onDiscard} disabled={isSaving}>
              Discard
            </QButton>
            <QButton variant="primary" size="sm" htmlType="submit" loading={isSaving}>
              Save changes
            </QButton>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
