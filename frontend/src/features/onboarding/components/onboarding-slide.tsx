import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';

/**
 * One intro slide — a calm icon in an accent-tinted circle, a title, a warm body.
 *
 * A direct port of mobile's `onboarding_slide.dart`, including its intent: "literary, unhurried,
 * generous whitespace". The 96px circle and 40px icon are mobile's numbers, kept so the two clients
 * read as the same product rather than two interpretations of it.
 */
export interface OnboardingSlideData {
  icon: LucideIcon;
  title: string;
  body: string;
}

export function OnboardingSlide({ data }: { data: OnboardingSlideData }): ReactElement {
  const Icon = data.icon;
  return (
    <div className="flex flex-col items-center px-6 text-center">
      <div className="bg-accent-subtle flex size-24 items-center justify-center rounded-full">
        <Icon size={40} strokeWidth={1.5} className="text-accent" aria-hidden />
      </div>
      <h2 className="text-ink mt-8 font-serif text-2xl font-semibold">{data.title}</h2>
      <p className="text-ink-secondary mt-3 max-w-sm text-base leading-relaxed">{data.body}</p>
    </div>
  );
}
