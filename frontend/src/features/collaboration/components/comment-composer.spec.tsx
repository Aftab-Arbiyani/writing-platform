import { CommentKind, CommentStatus, POLICY_ACTIONS, StoryRole } from '@qalam/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ApiClientModule from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';

import { collaborationApi } from '../api/collaboration.api';
import { CommentComposer } from './comment-composer';
import { CommentThread } from './comment-thread';
import { MentionBody } from './mention-body';

vi.mock('../api/collaboration.api');

// Profiles resolve through the app-level by-id hook, i.e. straight to `get`. Mocking the module lets
// the roster be driven per test without a server.
vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof ApiClientModule>('@/lib/api-client');
  return { ...actual, get: vi.fn() };
});

const { get } = await import('@/lib/api-client');
const mockGet = vi.mocked(get);
const members = vi.mocked(collaborationApi.members);
const capabilities = vi.mocked(collaborationApi.capabilities);
const thread = vi.mocked(collaborationApi.thread);
const reply = vi.mocked(collaborationApi.reply);

const FARHEEN_ID = '550e8400-e29b-41d4-a716-446655440000';
const ALI_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const STRANGER_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

const ROOT = {
  id: 'c-1',
  storyId: 'story-1',
  authorId: FARHEEN_ID,
  parentId: null,
  kind: CommentKind.General,
  anchor: null,
  body: 'the ending needs work',
  status: CommentStatus.Open,
  resolvedById: null,
  mentions: [],
  createdAt: new Date('2026-08-10T10:00:00Z').toISOString(),
  updatedAt: new Date('2026-08-10T10:00:00Z').toISOString(),
};

const profile = (id: string, username: string, penName: string) => ({
  id,
  username,
  penName,
  avatarKey: null,
  isPrivate: false,
  restricted: false,
  counts: {},
  viewerRelation: {},
});

/**
 * Composing and rendering an @mention (**P-2**, docs/48 §5.1).
 *
 * The repeated defect class in this codebase (R-1, M5-1, W5-3, W8-1) is code that *looked* wired and
 * was not, so these assert reachability: text typed into the real control, and the argument that
 * reaches `collaborationApi` inspected for an id. The wire shape alone would pass even if the
 * typeahead never opened.
 */
describe('CommentComposer — mentions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    members.mockResolvedValue([
      { userId: FARHEEN_ID, role: StoryRole.Owner, invitedById: null, joinedAt: null },
      { userId: ALI_ID, role: StoryRole.Editor, invitedById: FARHEEN_ID, joinedAt: null },
    ]);
    mockGet.mockImplementation(async (path: string) => {
      if (path.includes(FARHEEN_ID)) return profile(FARHEEN_ID, 'farheen', 'Farheen Q');
      if (path.includes(ALI_ID)) return profile(ALI_ID, 'ali', 'Ali R');
      if (path.includes(STRANGER_ID)) throw new Error('404');
      throw new Error(`unexpected ${path}`);
    });
  });

  const openTypeahead = async (label: string, value: string): Promise<HTMLElement> => {
    const area = screen.getByLabelText(label, { exact: true });
    fireEvent.change(area, { target: { value } });
    return area;
  };

  it('typing @ and picking a person puts the uuid in the body and a name on screen', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <CommentComposer storyId="story-1" isPending={false} onSubmit={onSubmit} />,
    );

    const area = await openTypeahead('Comment', 'nice catch @far');

    // The combobox is genuinely a combobox, and it announces the active option.
    await waitFor(() => expect(area).toHaveAttribute('aria-expanded', 'true'));
    const option = screen.getByRole('option', { name: /Farheen Q/ });
    expect(area).toHaveAttribute('aria-activedescendant', option.id);

    fireEvent.click(option);

    // On screen: a handle. Never 37 characters of hex.
    await waitFor(() => expect(area).toHaveValue('nice catch @farheen '));
    expect(area).not.toHaveValue(expect.stringContaining(FARHEEN_ID));

    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        body: `nice catch @${FARHEEN_ID}`,
        mentions: [FARHEEN_ID],
      }),
    );
  });

  it('offers only people who can see the story', async () => {
    renderWithProviders(<CommentComposer storyId="story-1" isPending={false} onSubmit={vi.fn()} />);

    await openTypeahead('Comment', '@');

    // Every option is a member; the roster read is the only source of candidates.
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
    expect(screen.getByRole('option', { name: /Farheen Q/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Ali R/ })).toBeInTheDocument();

    // The handle route that resolves ANY user on the platform is never called — that is what would
    // let a mention carry a non-member's id, which `notifyComment` would notify with no access check.
    expect(mockGet).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/users\/[^/]+$/),
      expect.anything(),
    );
  });

  it('narrows the typeahead as the handle is typed', async () => {
    renderWithProviders(<CommentComposer storyId="story-1" isPending={false} onSubmit={vi.fn()} />);

    await openTypeahead('Comment', '@');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));

    await openTypeahead('Comment', '@ali');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1));
    expect(screen.getByRole('option', { name: /Ali R/ })).toBeInTheDocument();
  });

  it('keyboard-selects with Enter, and Escape leaves plain text that notifies nobody', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <CommentComposer storyId="story-1" isPending={false} onSubmit={onSubmit} />,
    );

    const area = await openTypeahead('Comment', '@');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));

    // Arrow off the default first option, and prove the announcement followed the highlight.
    fireEvent.keyDown(area, { key: 'ArrowDown' });
    const ali = screen.getByRole('option', { name: /Ali R/ });
    await waitFor(() => expect(area).toHaveAttribute('aria-activedescendant', ali.id));
    expect(ali).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(area, { key: 'Enter' });
    await waitFor(() => expect(area).toHaveValue('@ali '));

    // A second, never-resolved handle: Escape backs out and it stays literal.
    fireEvent.change(area, { target: { value: '@ali and @nobody' } });
    await waitFor(() => expect(area).toHaveAttribute('aria-expanded', 'false'));
    fireEvent.keyDown(area, { key: 'Escape' });

    fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        body: `@${ALI_ID} and @nobody`,
        mentions: [ALI_ID],
      }),
    );
  });

  it('counts the RAW body, so a comment the server would reject is caught here', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <CommentComposer storyId="story-1" isPending={false} onSubmit={onSubmit} />,
    );

    const area = await openTypeahead('Comment', '@far');
    fireEvent.click(await screen.findByRole('option', { name: /Farheen Q/ }));
    await waitFor(() => expect(area).toHaveValue('@farheen '));

    // Visible text is well under 5,000; the raw body is not, because the mention is 37 characters.
    fireEvent.change(area, { target: { value: `@farheen ${'x'.repeat(4980)}` } });

    await waitFor(() =>
      expect(screen.getByText(/Keep it under 5,000 characters/)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled();
    // The counter explains the gap rather than leaving it to be discovered at rejection time.
    expect(screen.getByText(/each mention counts as the person’s id/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

/**
 * The reply composer is a second call site, not a second component — and P-2's row is only closed if
 * mentions reach `POST /comments/:id/replies` too. Driven through `CommentThread` rather than by
 * rendering `CommentComposer` with `dense`, because what could silently break is the thread failing to
 * pass `storyId` (no roster → no typeahead) or dropping `mentions` on the way to the mutation.
 */
describe('CommentThread — mentions in a reply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    members.mockResolvedValue([
      { userId: FARHEEN_ID, role: StoryRole.Owner, invitedById: null, joinedAt: null },
    ]);
    capabilities.mockResolvedValue({
      storyId: 'story-1',
      capabilities: [
        {
          action: POLICY_ACTIONS.StoryComment,
          effect: 'allow',
          allowed: true,
          reason: 'role_allows',
          obligations: [],
        },
      ],
    } as never);
    thread.mockResolvedValue({ comment: ROOT, replies: [] });
    reply.mockResolvedValue({ ...ROOT, id: 'c-2', parentId: ROOT.id });
    mockGet.mockImplementation(async (path: string) => {
      if (path.includes(FARHEEN_ID)) return profile(FARHEEN_ID, 'farheen', 'Farheen Q');
      throw new Error('404');
    });
  });

  it('resolves a mention in a reply and posts the id to the replies endpoint', async () => {
    renderWithProviders(<CommentThread storyId="story-1" comment={ROOT} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Reply' }));

    const area = screen.getByLabelText('Reply', { exact: true });
    fireEvent.change(area, { target: { value: 'agreed @far' } });

    fireEvent.click(await screen.findByRole('option', { name: /Farheen Q/ }));
    await waitFor(() => expect(area).toHaveValue('agreed @farheen '));

    // Two buttons are now named "Reply" — the thread's toggle and the composer's submit. The submit
    // is the last, the same disambiguation the E2E page object makes.
    fireEvent.click(screen.getAllByRole('button', { name: 'Reply' }).at(-1) as HTMLElement);

    await waitFor(() =>
      expect(reply).toHaveBeenCalledWith(ROOT.id, {
        body: `agreed @${FARHEEN_ID}`,
        mentions: [FARHEEN_ID],
      }),
    );
  });
});

describe('MentionBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation(async (path: string) => {
      if (path.includes(FARHEEN_ID)) return profile(FARHEEN_ID, 'farheen', 'Farheen Q');
      throw new Error('404');
    });
  });

  it('renders a stored @<uuid> as a name', async () => {
    renderWithProviders(<MentionBody body={`nice catch @${FARHEEN_ID}`} />);

    expect(await screen.findByText('@farheen')).toBeInTheDocument();
    // The id itself never reaches the reader.
    expect(screen.queryByText(new RegExp(FARHEEN_ID))).not.toBeInTheDocument();
    expect(screen.getByLabelText('mention of Farheen Q')).toBeInTheDocument();
  });

  it('degrades an unresolvable id to the B3 fallback, never a raw UUID or a made-up name', async () => {
    renderWithProviders(<MentionBody body={`what about @${STRANGER_ID}?`} />);

    // B3's floor: a recognisable id fragment, obviously an id rather than a name.
    expect(await screen.findByText('@3f25…3301')).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(STRANGER_ID))).not.toBeInTheDocument();
  });
});
