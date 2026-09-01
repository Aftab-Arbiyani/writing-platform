/**
 * Public surface of the onboarding feature (docs/48 §2 row 7) — one page, reached by one lazy route.
 *
 * The durable "has this browser seen it" flag is NOT here: it lives at
 * `stores/onboarding.store.ts`, because the router guard reads it and `app/` may not reach into a
 * feature (docs/26 §4). Mobile splits it the same way and for the same reason.
 */
export { OnboardingPage } from './pages/onboarding-page';
