import { Compass, Home, LogIn, Moon, PenLine, Search, Settings, Sun, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/lib/routes';
import { useAuthStore } from '@/stores/auth.store';
import { useThemeStore } from '@/stores/theme.store';

/**
 * A command-palette ACTION (the "command" half of the palette, docs/06 §2 keyboard model) —
 * jump-to-page navigation + a couple of app actions (theme). Distinct from search RESULTS, which
 * come from the FTS endpoints. `keywords` widen fuzzy matching ("dark" → theme, "home" → feed).
 */
export interface CommandAction {
  id: string;
  label: string;
  icon: LucideIcon;
  keywords: string[];
  /** Runs the action (already closes the palette via the passed `close`). */
  run: () => void;
}

/**
 * The static command set, scoped to the session (auth-only destinations appear only when signed
 * in; Sign in only when out) and the current theme (the toggle flips label + effect). `close` is
 * invoked before navigating so the overlay dismisses as the route changes.
 */
export function useCommandActions(close: () => void): CommandAction[] {
  const navigate = useNavigate();
  const isAuthed = useAuthStore((s) => s.status === 'authenticated');
  const isAnonymous = useAuthStore((s) => s.status === 'anonymous');
  const resolvedTheme = useThemeStore((s) => s.resolved);
  const setMode = useThemeStore((s) => s.setMode);

  return useMemo(() => {
    const go = (path: string) => () => {
      close();
      void navigate(path);
    };

    const actions: CommandAction[] = [
      {
        id: 'nav-feed',
        label: 'Go to Home',
        icon: Home,
        keywords: ['home', 'feed', 'timeline'],
        run: go(ROUTES.feed),
      },
      {
        id: 'nav-discover',
        label: 'Discover',
        icon: Compass,
        keywords: ['explore', 'browse', 'trending'],
        run: go(ROUTES.discover),
      },
      {
        id: 'nav-search',
        label: 'Open full search',
        icon: Search,
        keywords: ['search', 'find', 'results'],
        run: go(ROUTES.search),
      },
      {
        id: 'nav-write',
        label: 'Write a piece',
        icon: PenLine,
        keywords: ['write', 'new', 'compose', 'draft'],
        run: go(ROUTES.write),
      },
    ];

    if (isAuthed) {
      actions.push(
        {
          id: 'nav-profile',
          label: 'Your profile',
          icon: User,
          keywords: ['profile', 'me', 'account'],
          run: go(ROUTES.me),
        },
        {
          id: 'nav-settings',
          label: 'Settings',
          icon: Settings,
          keywords: ['settings', 'preferences', 'account'],
          run: go(ROUTES.settings),
        },
      );
    }
    if (isAnonymous) {
      actions.push({
        id: 'nav-login',
        label: 'Sign in',
        icon: LogIn,
        keywords: ['login', 'sign in', 'account'],
        run: go(ROUTES.login),
      });
    }

    const goingDark = resolvedTheme === 'light';
    actions.push({
      id: 'toggle-theme',
      label: goingDark ? 'Switch to dark mode' : 'Switch to light mode',
      icon: goingDark ? Moon : Sun,
      keywords: ['theme', 'dark', 'light', 'appearance', 'mode'],
      run: () => {
        setMode(goingDark ? 'dark' : 'light');
        close();
      },
    });

    return actions;
  }, [navigate, isAuthed, isAnonymous, resolvedTheme, setMode, close]);
}

/** Case-insensitive substring match over an action's label + keywords. */
export function matchesAction(action: CommandAction, query: string): boolean {
  const q = query.trim().toLocaleLowerCase();
  if (q.length === 0) return true;
  if (action.label.toLocaleLowerCase().includes(q)) return true;
  return action.keywords.some((k) => k.includes(q));
}
