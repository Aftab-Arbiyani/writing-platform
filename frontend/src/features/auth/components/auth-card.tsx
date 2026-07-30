import { fadeRise } from '@qalam/ui/motion';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * The card every auth screen renders into (docs/06 §3.7 — "auth is a corridor"). Centered
 * title + optional subtitle, a token-styled surface, and a standard `fadeRise` entrance
 * (docs/31 — variants only, no inline durations; reduced-motion handled by MotionProvider).
 */
export interface AuthCardProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <motion.section
      variants={fadeRise}
      initial="initial"
      animate="animate"
      className="flex flex-col gap-6 rounded-lg border border-line bg-surface p-6 shadow-[var(--q-shadow-2)] sm:p-8"
    >
      <header className="flex flex-col gap-1.5 text-center">
        <h1 className="font-serif text-2xl font-semibold text-ink">{title}</h1>
        {subtitle ? <p className="text-sm text-ink-secondary">{subtitle}</p> : null}
      </header>
      {children}
      {footer ? <footer className="text-center text-sm text-ink-secondary">{footer}</footer> : null}
    </motion.section>
  );
}
