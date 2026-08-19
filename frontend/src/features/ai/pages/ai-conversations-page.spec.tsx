import type { AiConversationSummary } from '@qalam/api-types';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { aiApi } from '../api/ai.api';
import { AiConversationsPage } from './ai-conversations-page';

vi.mock('../api/ai.api');

const listConversations = vi.mocked(aiApi.listConversations);
const createConversation = vi.mocked(aiApi.createConversation);
const updateConversation = vi.mocked(aiApi.updateConversation);
const deleteConversation = vi.mocked(aiApi.deleteConversation);
const exportConversation = vi.mocked(aiApi.exportConversation);

function row(over: Partial<AiConversationSummary> = {}): AiConversationSummary {
  return {
    id: 'c1',
    title: 'Rain over the city',
    feature: 'writing_assistant',
    status: 'active',
    messageCount: 4,
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-02T11:30:00.000Z',
    ...over,
  };
}

function page(items: AiConversationSummary[]) {
  return { items, meta: { limit: 20, nextCursor: null, hasMore: false } };
}

/**
 * `QDialog`-backed `useConfirm` resolves through AntD's modal. The delete spec drives it by clicking
 * the real confirm button rather than stubbing the hook, so the confirmation is part of what is
 * asserted — a delete that skipped its confirm would still pass a stubbed version.
 */
async function confirmDialog(label: RegExp): Promise<void> {
  const button = await screen.findByRole('button', { name: label });
  fireEvent.click(button);
}

describe('AiConversationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listConversations.mockResolvedValue(page([row()]) as never);
    createConversation.mockResolvedValue(row({ id: 'c2', title: null }) as never);
    updateConversation.mockResolvedValue(row({ title: 'Renamed' }) as never);
    deleteConversation.mockResolvedValue(undefined as never);
  });

  it('lists a conversation with its feature, message count and updated time', async () => {
    renderWithProviders(<AiConversationsPage />);
    expect(await screen.findByText('Rain over the city')).toBeInTheDocument();
    expect(screen.getByText(/Writing assistant · 4 messages/)).toBeInTheDocument();
  });

  it('renders the untitled placeholder rather than an empty row', async () => {
    // `title` is genuinely nullable — POST stores null when none is given — so this is the common
    // case. An empty link would be unclickable-looking and unreadable to a screen reader.
    listConversations.mockResolvedValue(page([row({ title: null })]) as never);
    renderWithProviders(<AiConversationsPage />);
    expect(await screen.findByText('Untitled conversation')).toBeInTheDocument();
  });

  it('singularises a one-message conversation', async () => {
    listConversations.mockResolvedValue(page([row({ messageCount: 1 })]) as never);
    renderWithProviders(<AiConversationsPage />);
    expect(await screen.findByText(/· 1 message ·/)).toBeInTheDocument();
  });

  it('shows the empty state when the caller has no conversations', async () => {
    // This is mobile's permanent state (docs/48 §3.12, W8-1), so the copy has to point at the way
    // out rather than just reporting emptiness.
    listConversations.mockResolvedValue(page([]) as never);
    renderWithProviders(<AiConversationsPage />);
    expect(await screen.findByText('No conversations yet')).toBeInTheDocument();
  });

  describe('create', () => {
    it('starts a conversation on the writing_assistant feature', async () => {
      renderWithProviders(<AiConversationsPage />);
      fireEvent.click(await screen.findByRole('button', { name: 'New conversation' }));
      // The one user-facing assistant feature (packages/shared/src/ai.ts:87-90). A feature value the
      // AiFeature enum does not contain would 400 on @IsEnum.
      await waitFor(() =>
        expect(createConversation).toHaveBeenCalledWith({ feature: 'writing_assistant' }),
      );
    });
  });

  describe('rename', () => {
    it('sends only the title', async () => {
      renderWithProviders(<AiConversationsPage />);
      fireEvent.click(await screen.findByRole('button', { name: /^Rename / }));
      const input = screen.getByRole('textbox', { name: 'Conversation title' });
      fireEvent.change(input, { target: { value: 'A better title' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() =>
        expect(updateConversation).toHaveBeenCalledWith('c1', { title: 'A better title' }),
      );
    });

    it('does not call the server for a blank title', async () => {
      renderWithProviders(<AiConversationsPage />);
      fireEvent.click(await screen.findByRole('button', { name: /^Rename / }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Conversation title' }), {
        target: { value: '   ' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      // `@MaxLength` permits it and the DTO has no @IsNotEmpty, so a blank rename would succeed
      // server-side and leave a titleless row — worse than refusing it here.
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).toBeNull());
      expect(updateConversation).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes only after the confirmation is accepted', async () => {
      renderWithProviders(<AiConversationsPage />);
      fireEvent.click(await screen.findByRole('button', { name: /^Delete / }));
      expect(deleteConversation).not.toHaveBeenCalled();

      await confirmDialog(/^Delete$/);
      await waitFor(() => expect(deleteConversation).toHaveBeenCalledWith('c1'));
    });
  });

  describe('export', () => {
    it('downloads the export document as a file rather than rendering it', async () => {
      const document_ = {
        id: 'c1',
        feature: 'writing_assistant',
        title: 'Rain over the city',
        status: 'active',
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-02T11:30:00.000Z',
        messages: [],
      };
      exportConversation.mockResolvedValue(document_ as never);

      const createObjectURL = vi.fn(() => 'blob:export');
      const revokeObjectURL = vi.fn();
      vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      renderWithProviders(<AiConversationsPage />);
      fireEvent.click(await screen.findByRole('button', { name: /^Export / }));

      await waitFor(() => expect(exportConversation).toHaveBeenCalledWith('c1'));
      // A download, not a route change and not a rendered page: the route returns plain JSON with no
      // Content-Disposition, so the anchor click is the only thing that makes it a file.
      await waitFor(() => expect(click).toHaveBeenCalled());
      expect(createObjectURL).toHaveBeenCalled();

      click.mockRestore();
      vi.unstubAllGlobals();
    });
  });

  /**
   * Archive, added once it meant something (docs/48 §3.21).
   *
   * This block used to assert the OPPOSITE — that no archive control exists — because
   * `status:'archived'` persisted and hid nothing (W8-2), so the control would have reported success
   * and changed nothing visible. The backend gained the status filter in `b45ac03`, which is exactly
   * the condition the old test named as the thing that should change it.
   *
   * The load-bearing assertion is the pair: archiving is offered only alongside the shelf that makes
   * it reversible. Without that shelf this is a delete with a gentler label, which is how it behaved
   * on mobile between `b45ac03` and this change.
   */
  describe('archive', () => {
    it('archives a row from the active shelf', async () => {
      renderWithProviders(<AiConversationsPage />);
      await screen.findByText('Rain over the city');

      fireEvent.click(screen.getByRole('button', { name: /^Archive Rain over the city$/ }));

      await waitFor(() =>
        expect(updateConversation).toHaveBeenCalledWith('c1', { status: 'archived' }),
      );
    });

    it('reads the archived shelf from the server, not by filtering the active one', async () => {
      renderWithProviders(<AiConversationsPage />);
      await screen.findByText('Rain over the city');

      fireEvent.click(screen.getByRole('tab', { name: 'Archived' }));

      // The status is a query parameter: archived rows are not in the active page to filter down to.
      await waitFor(() =>
        expect(listConversations).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'archived' }),
        ),
      );
    });

    it('offers restore rather than archive on the archived shelf', async () => {
      renderWithProviders(<AiConversationsPage />);
      await screen.findByText('Rain over the city');
      listConversations.mockResolvedValue(page([row({ status: 'archived' })]) as never);

      fireEvent.click(screen.getByRole('tab', { name: 'Archived' }));

      const restore = await screen.findByRole('button', {
        name: /^Restore Rain over the city$/,
      });
      fireEvent.click(restore);

      await waitFor(() =>
        expect(updateConversation).toHaveBeenCalledWith('c1', { status: 'active' }),
      );
      expect(screen.queryByRole('button', { name: /^Archive Rain over the city$/ })).toBeNull();
    });

    it('labels an archived row, for a shelf reached without the tabs', async () => {
      listConversations.mockResolvedValue(page([row({ status: 'archived' })]) as never);
      renderWithProviders(<AiConversationsPage />);
      expect(await screen.findByText('Archived')).toBeInTheDocument();
    });

    it('says the archive is empty rather than that there are no conversations', async () => {
      renderWithProviders(<AiConversationsPage />);
      await screen.findByText('Rain over the city');
      listConversations.mockResolvedValue(page([]) as never);

      fireEvent.click(screen.getByRole('tab', { name: 'Archived' }));

      // "No conversations yet" would be false here — the active shelf has one.
      expect(await screen.findByText('Nothing archived')).toBeInTheDocument();
    });
  });

  describe('filter', () => {
    it('filters the loaded rows client-side', async () => {
      listConversations.mockResolvedValue(
        page([row(), row({ id: 'c2', title: 'Notes on structure' })]) as never,
      );
      renderWithProviders(<AiConversationsPage />);
      await screen.findByText('Rain over the city');

      fireEvent.change(screen.getByRole('searchbox', { name: /Filter conversations/ }), {
        target: { value: 'structure' },
      });

      expect(screen.getByText('Notes on structure')).toBeInTheDocument();
      expect(screen.queryByText('Rain over the city')).toBeNull();
      // There is no `q` on ConversationListQueryDto — sending one would 400. The filter must stay
      // client-side, so the list is fetched exactly once.
      expect(listConversations).toHaveBeenCalledTimes(1);
    });

    it('says so when nothing loaded matches', async () => {
      renderWithProviders(<AiConversationsPage />);
      await screen.findByText('Rain over the city');
      fireEvent.change(screen.getByRole('searchbox', { name: /Filter conversations/ }), {
        target: { value: 'zzz' },
      });
      expect(screen.getByRole('status')).toHaveTextContent(/No loaded conversation matches/);
    });
  });
});
