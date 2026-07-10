import { SEARCH_QUERY_MIN } from '@qalam/shared';
import { QAvatar, QSpinner } from '@qalam/ui';
import { Modal } from 'antd';
import { CornerDownLeft, FileText, Hash, Search, Tag, TrendingUp, Clock } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ReactElement } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { mediaUrl } from '@/lib/media';
import { feedPath, piecePath, profilePath, searchPath } from '@/lib/routes';

import { useAutocomplete } from '../hooks/use-autocomplete';
import { matchesAction, useCommandActions } from '../hooks/use-command-actions';
import { useRecentSearches } from '../hooks/use-recent-searches';
import { useSuggestionNav } from '../hooks/use-suggestion-nav';
import { useTrending } from '../hooks/use-trending';
import { useSearchStore } from '../stores/search.store';
import { HighlightText } from './highlight-text';

/** Platform-aware modifier label for the footer hint (⌘ on macOS, Ctrl elsewhere). */
export const IS_MAC =
  typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent);

interface Option {
  id: string;
  run: () => void;
  node: ReactNode;
}

interface Section {
  key: string;
  title?: string;
  options: Option[];
}

const optionDomId = (index: number): string => `cmdk-option-${String(index)}`;

function Row({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }): ReactElement {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Icon size={16} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </span>
  );
}

/**
 * The universal Command Palette (⌘K / Ctrl+K) — a Notion/Linear/GitHub-style overlay that lets a
 * reader SEARCH and JUMP from anywhere without leaving the page (docs/06 §2 keyboard model). One
 * instance is mounted in the app shell. Empty: jump-to commands + recent + trending. Typing (2+):
 * debounced instant suggestions (writers/pieces/tags/genres) + matching commands + a "search
 * everything" escape hatch. Full ARIA combobox: ↑/↓ rove, ↵ runs the highlighted row (or submits
 * the query), Esc/backdrop close. Picking a result is SPA navigation — no reload, no forced trip
 * to `/search` just to type.
 */
export function CommandPalette(): ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const open = useSearchStore((s) => s.commandOpen);
  const setOpen = useSearchStore((s) => s.setCommandOpen);
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');

  const trimmed = text.trim();
  const hasText = trimmed.length > 0;
  const hasQuery = trimmed.length >= SEARCH_QUERY_MIN;

  const autocomplete = useAutocomplete(text);
  const recent = useRecentSearches();
  const trending = useTrending(open);

  const close = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const actions = useCommandActions(close);

  const runQuery = useCallback(
    (query: string) => {
      const value = query.trim();
      if (value.length >= SEARCH_QUERY_MIN) recent.record(value);
      close();
      void navigate(searchPath({ q: value }));
    },
    [navigate, recent, close],
  );

  const goTo = useCallback(
    (path: string) => {
      close();
      void navigate(path);
    },
    [navigate, close],
  );

  // Reset the field each time the palette opens.
  useEffect(() => {
    if (open) setText('');
  }, [open]);

  // Close on a real route change (a safety net beyond each option's own close()); skip the
  // initial mount so it never dismisses a palette opened before this effect first runs.
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    setOpen(false);
    // `setOpen` is a stable store setter; we only want to react to pathname changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Global shortcuts: ⌘K / Ctrl+K toggles from anywhere; `/` opens when not typing in a field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const isToggle = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isToggle) {
        event.preventDefault();
        setOpen(!useSearchStore.getState().commandOpen);
        return;
      }
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const el = event.target as HTMLElement | null;
        const tag = el?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || el?.isContentEditable) return;
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [setOpen]);

  const sections = useMemo<Section[]>(() => {
    const out: Section[] = [];

    // A "search everything" action is always first when the user has typed something.
    if (hasText) {
      out.push({
        key: 'run',
        options: [
          {
            id: 'run-search',
            run: () => runQuery(trimmed),
            node: (
              <Row icon={Search}>
                Search everything for “<span className="font-medium text-ink">{trimmed}</span>”
              </Row>
            ),
          },
        ],
      });
    }

    // Instant suggestions (2+ chars).
    if (hasQuery && autocomplete.data) {
      const d = autocomplete.data;
      if (d.writers.length > 0) {
        out.push({
          key: 'writers',
          title: 'Writers',
          options: d.writers.map((w) => {
            const name = w.penName ?? `@${w.username}`;
            return {
              id: `w:${w.username}`,
              run: () => goTo(profilePath(w.username)),
              node: (
                <span className="flex min-w-0 items-center gap-3">
                  <QAvatar size={22} src={mediaUrl(w.avatarKey)} name={name} />
                  <span className="min-w-0 flex-1 truncate">
                    <HighlightText text={name} query={trimmed} className="font-medium text-ink" />
                    <span className="ms-1 text-ink-muted">@{w.username}</span>
                  </span>
                </span>
              ),
            };
          }),
        });
      }
      if (d.pieces.length > 0) {
        out.push({
          key: 'pieces',
          title: 'Pieces',
          options: d.pieces.map((p, i) => ({
            id: `p:${p.slug ?? String(i)}`,
            run: () => (p.slug ? goTo(piecePath(p.slug)) : runQuery(p.title)),
            node: (
              <Row icon={FileText}>
                <HighlightText text={p.title} query={trimmed} />
              </Row>
            ),
          })),
        });
      }
      if (d.tags.length > 0) {
        out.push({
          key: 'tags',
          title: 'Tags',
          options: d.tags.map((t) => ({
            id: `t:${t.slug}`,
            run: () => goTo(feedPath({ tab: 'latest', tag: t.slug })),
            node: (
              <Row icon={Hash}>
                <HighlightText text={t.name} query={trimmed} />
              </Row>
            ),
          })),
        });
      }
      if (d.genres.length > 0) {
        out.push({
          key: 'genres',
          title: 'Genres',
          options: d.genres.map((g) => ({
            id: `g:${g.slug}`,
            run: () => goTo(feedPath({ tab: 'latest', genre: g.slug })),
            node: (
              <Row icon={Tag}>
                <HighlightText text={g.name} query={trimmed} />
              </Row>
            ),
          })),
        });
      }
    }

    // Commands — all of them when idle, filtered when typing.
    const matched = hasText ? actions.filter((a) => matchesAction(a, trimmed)) : actions;
    if (matched.length > 0) {
      out.push({
        key: 'commands',
        title: hasText ? 'Commands' : 'Jump to',
        options: matched.map((a) => ({
          id: a.id,
          run: a.run,
          node: <Row icon={a.icon}>{a.label}</Row>,
        })),
      });
    }

    // Recent + trending only when the field is empty.
    if (!hasText) {
      if (recent.items.length > 0) {
        out.push({
          key: 'recent',
          title: 'Recent searches',
          options: recent.items.slice(0, 6).map((item) => ({
            id: `r:${item.id}`,
            run: () => runQuery(item.query),
            node: <Row icon={Clock}>{item.query}</Row>,
          })),
        });
      }
      const keywords = trending.data?.keywords ?? [];
      if (keywords.length > 0) {
        out.push({
          key: 'trending',
          title: 'Trending',
          options: keywords.slice(0, 6).map((k) => ({
            id: `k:${k.keyword}`,
            run: () => runQuery(k.keyword),
            node: <Row icon={TrendingUp}>{k.keyword}</Row>,
          })),
        });
      }
    }

    return out;
  }, [
    hasText,
    hasQuery,
    trimmed,
    autocomplete.data,
    actions,
    recent.items,
    trending.data,
    runQuery,
    goTo,
  ]);

  const flatOptions = useMemo(() => sections.flatMap((s) => s.options), [sections]);

  const { activeIndex, setActiveIndex, handleKeyDown, reset } = useSuggestionNav({
    count: flatOptions.length,
    onSelect: (index) => flatOptions[index]?.run(),
    onSubmit: () => {
      if (trimmed.length > 0) runQuery(trimmed);
    },
    onEscape: close,
  });

  useEffect(() => {
    reset();
  }, [trimmed, sections.length, reset]);

  const showLoading = hasQuery && (autocomplete.isTyping || autocomplete.isFetching);
  const showNoSuggestions =
    hasQuery && !showLoading && autocomplete.isSuccess && flatOptions.length <= 1;
  const activeId = activeIndex >= 0 ? optionDomId(activeIndex) : undefined;

  let cursor = 0;

  return (
    <Modal
      open={open}
      onCancel={close}
      footer={null}
      closable={false}
      title={null}
      width={640}
      style={{ top: '12vh' }}
      styles={{ content: { padding: 0, overflow: 'hidden' }, body: { padding: 0 } }}
      destroyOnHidden
      afterOpenChange={(isOpen) => {
        if (isOpen) inputRef.current?.focus();
      }}
      aria-label="Command palette"
    >
      <div className="flex flex-col">
        {/* Search field */}
        <div className="border-line flex items-center gap-3 border-b px-4">
          <Search size={18} strokeWidth={1.75} className="shrink-0 text-ink-muted" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded
            aria-controls="cmdk-listbox"
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-label="Search writers, pieces, tags, or run a command"
            placeholder="Search or jump to…"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            className="h-14 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-muted"
          />
          {showLoading ? <QSpinner size="small" /> : null}
        </div>

        {/* Results */}
        <ul
          id="cmdk-listbox"
          role="listbox"
          aria-label="Results"
          className="max-h-[52vh] overflow-y-auto p-2"
        >
          {sections.map((section) => (
            <li key={section.key} className="mb-1 last:mb-0">
              {section.title ? (
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {section.title}
                </p>
              ) : null}
              <ul>
                {section.options.map((option) => {
                  const index = cursor;
                  cursor += 1;
                  const active = index === activeIndex;
                  return (
                    <li key={option.id}>
                      <button
                        type="button"
                        id={optionDomId(index)}
                        role="option"
                        aria-selected={active}
                        onMouseMove={() => {
                          if (!active) setActiveIndex(index);
                        }}
                        onClick={option.run}
                        className={[
                          'flex w-full items-center rounded-md px-3 py-2.5 text-start text-sm',
                          active ? 'bg-raised text-ink' : 'text-ink-secondary',
                        ].join(' ')}
                      >
                        {option.node}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}

          {showNoSuggestions ? (
            <li className="px-3 py-8 text-center text-sm text-ink-muted">
              No matches for “{trimmed}”. Press Enter to search everything.
            </li>
          ) : null}
        </ul>

        {/* Footer hints */}
        <div className="border-line flex items-center gap-4 border-t px-4 py-2.5 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            to navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>
              <CornerDownLeft size={11} strokeWidth={2} aria-hidden />
            </Kbd>
            to select
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>esc</Kbd>
            to close
          </span>
        </div>
      </div>
    </Modal>
  );
}

/** A small keycap for the footer hints. */
function Kbd({ children }: { children: ReactNode }): ReactElement {
  return (
    <kbd className="border-line inline-flex min-w-5 items-center justify-center rounded border bg-raised px-1 py-0.5 font-mono text-[11px] text-ink-secondary">
      {children}
    </kbd>
  );
}
