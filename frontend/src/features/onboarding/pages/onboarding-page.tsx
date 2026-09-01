import { QButton } from '@qalam/ui';
import { BookOpen, BookOpenText, Shield } from 'lucide-react';
import { type ReactElement, useState } from 'react';
import { useNavigate } from 'react-router';

import { usePageTitle } from '@/hooks/use-page-title';
import { ROUTES } from '@/lib/routes';
import { useOnboardingStore } from '@/stores/onboarding.store';

import { OnboardingSlide, type OnboardingSlideData } from '../components/onboarding-slide';

/**
 * The first-run intro (docs/48 §2 row 7) — a three-slide introduction shown once, then never again.
 *
 * **A port of mobile's `onboarding_screen.dart`, not a web original.** Same three slides in the same
 * order (welcome · platform · privacy), the **same copy verbatim** from `app_en.arb`, the same dot
 * indicators, the same "Next" that becomes "Get started" on the last slide, and the same hand-off:
 * Skip and Get started are treated identically — both persist completion and go to sign-in. Under
 * the parity rule (§1 of the register) web ships the same product here, not a richer one.
 *
 * Two things mobile does that web deliberately does not, because they have no web analogue: a light
 * haptic on page change, and a swipeable `PageView`. Web advances by button, which is also what
 * makes it keyboard-operable without extra work — the control that moves the carousel is a real
 * button, not a gesture with a fallback.
 *
 * Fully offline: no query, no mutation, nothing to fail. Mobile's screen says the same
 * ("Fully offline (no network)"), which is why the intro can run before any session exists.
 */
const SLIDES: readonly OnboardingSlideData[] = [
  {
    icon: BookOpen,
    title: 'A place for your words',
    body: 'Qalam is a quiet writing sanctuary — warm paper and ink, for Hindi and Urdu writers first.',
  },
  {
    icon: BookOpenText,
    title: 'Read and write, beautifully',
    body: 'Follow writers you love, save what moves you, and publish prose that reads the way it should.',
  },
  {
    icon: Shield,
    title: 'Your words, your control',
    body: 'You decide what you share. We keep only what we need, and never sell your writing.',
  },
];

export function OnboardingPage(): ReactElement {
  usePageTitle('Welcome');
  const navigate = useNavigate();
  const markComplete = useOnboardingStore((state) => state.markComplete);
  const [page, setPage] = useState(0);

  const lastIndex = SLIDES.length - 1;
  const onLast = page === lastIndex;

  // Skip and Get started are the same commitment — the reader has been offered the intro and is
  // done with it — so they share one path rather than two that could drift apart.
  const finish = (): void => {
    markComplete();
    void navigate(ROUTES.login, { replace: true });
  };

  const next = (): void => {
    if (onLast) {
      finish();
      return;
    }
    setPage((current) => current + 1);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center px-4 py-3">
        <span className="text-ink font-serif text-lg font-semibold">Qalam</span>
        <QButton variant="ghost" size="sm" className="ms-auto" onClick={finish}>
          Skip
        </QButton>
      </header>

      <main className="flex flex-1 flex-col justify-center py-8">
        {/* One slide is mounted at a time. Mobile keeps a swipeable PageView; here the button is the
            only way forward, so rendering the others would add nothing but an a11y tree to hide. */}
        <OnboardingSlide data={SLIDES[page] as OnboardingSlideData} />
      </main>

      <footer className="flex flex-col items-center gap-6 p-6">
        {/* Decorative: the button below already announces position through its label change, and a
            reader does not need "step 2 of 3" twice. */}
        <div className="flex items-center gap-1" aria-hidden>
          {SLIDES.map((slide, index) => (
            <span
              key={slide.title}
              className={`h-2 rounded-full transition-all ${
                index === page ? 'bg-accent w-5' : 'bg-line w-2'
              }`}
            />
          ))}
        </div>

        <QButton size="lg" className="w-full max-w-sm" onClick={next}>
          {onLast ? 'Get started' : 'Next'}
        </QButton>
      </footer>
    </div>
  );
}
