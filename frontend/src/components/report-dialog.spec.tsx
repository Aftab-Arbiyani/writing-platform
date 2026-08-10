import { ReportEntityType, ReportReason, ReportStatus } from '@qalam/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-client';
import { reportsApi } from '@/lib/reports-api';
import { renderWithProviders } from '@/test/render';
import type { Report } from '@/types/report';

import { REPORT_DESCRIPTION_MAX } from '@/hooks/use-report';

import { ReportDialog } from './report-dialog';

vi.mock('@/lib/reports-api');

const create = vi.mocked(reportsApi.create);

function filed(over: Partial<Report> = {}): Report {
  return {
    id: 'report-1',
    entityType: ReportEntityType.Piece,
    entityId: 'piece-1',
    reason: ReportReason.Spam,
    description: null,
    status: ReportStatus.Pending,
    priority: 'low' as Report['priority'],
    createdAt: new Date('2026-08-10T10:00:00Z').toISOString(),
    ...over,
  };
}

function open(entityType: ReportEntityType, entityId = 'entity-1', subject = 'this piece') {
  return renderWithProviders(
    <ReportDialog
      open
      onClose={vi.fn()}
      entityType={entityType}
      entityId={entityId}
      subject={subject}
    />,
  );
}

describe('ReportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue(filed());
  });

  /**
   * The generalization is the point of this component: ONE dialog for all four
   * `ReportEntityType`s, rather than four bespoke ones that would each drift.
   */
  it.each([
    [ReportEntityType.Piece, 'Report this piece'],
    [ReportEntityType.Comment, 'Report this comment'],
    [ReportEntityType.Response, 'Report this response'],
    [ReportEntityType.User, 'Report this person'],
  ])('titles itself for %s and submits that entity type', async (entityType, heading) => {
    open(entityType, 'target-9');

    expect(screen.getByText(heading)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        entityType,
        entityId: 'target-9',
        // Defaults to the first reason rather than nothing, so the button is never dead on open.
        reason: ReportReason.Spam,
      });
    });
  });

  it('offers the whole reason catalogue, with “Something else” last', () => {
    open(ReportEntityType.Piece);
    const options = screen.getAllByRole('radio');
    expect(options).toHaveLength(10);
    expect(options[0]).toHaveAccessibleName('Spam');
    expect(options[9]).toHaveAccessibleName('Something else');
  });

  it('sends the reason the reader picked', async () => {
    open(ReportEntityType.Piece, 'piece-7');

    fireEvent.click(screen.getByRole('radio', { name: 'Harassment or bullying' }));
    expect(screen.getByRole('radio', { name: 'Harassment or bullying' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));
    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        entityType: ReportEntityType.Piece,
        entityId: 'piece-7',
        reason: ReportReason.Harassment,
      });
    });
  });

  it('sends a trimmed description when one is given, and omits it when blank', async () => {
    open(ReportEntityType.Piece, 'piece-7');

    fireEvent.change(screen.getByLabelText('Anything else? (optional)'), {
      target: { value: '   They keep posting the same link.   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        entityType: ReportEntityType.Piece,
        entityId: 'piece-7',
        reason: ReportReason.Spam,
        description: 'They keep posting the same link.',
      });
    });
  });

  /**
   * The 1000-char bound is `CreateReportDto`'s, and it is enforced BEFORE the request — a rejected
   * report is a reader who has to retype their explanation.
   */
  it('refuses a description over the limit client-side, and says why', () => {
    open(ReportEntityType.Piece);

    fireEvent.change(screen.getByLabelText('Anything else? (optional)'), {
      target: { value: 'x'.repeat(REPORT_DESCRIPTION_MAX + 1) },
    });

    expect(screen.getByRole('button', { name: 'Send report' })).toBeDisabled();
    expect(
      screen.getByText(`Keep it under ${REPORT_DESCRIPTION_MAX.toLocaleString('en')} characters.`),
    ).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('accepts a description exactly at the limit', async () => {
    open(ReportEntityType.Piece);

    fireEvent.change(screen.getByLabelText('Anything else? (optional)'), {
      target: { value: 'x'.repeat(REPORT_DESCRIPTION_MAX) },
    });
    expect(screen.getByRole('button', { name: 'Send report' })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));
    await waitFor(() => {
      expect(create).toHaveBeenCalledTimes(1);
    });
  });

  /** `other` is encouraged-not-required: the DTO marks description optional whatever the reason. */
  it('encourages detail for “Something else” without requiring it', async () => {
    open(ReportEntityType.Piece);

    fireEvent.click(screen.getByRole('radio', { name: 'Something else' }));
    expect(screen.getByText(/helps a lot when the reason is/)).toBeInTheDocument();
    // Still submittable — a hint, not a gate.
    expect(screen.getByRole('button', { name: 'Send report' })).not.toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));
    await waitFor(() => {
      expect(create).toHaveBeenCalledWith(expect.objectContaining({ reason: ReportReason.Other }));
    });
  });

  /** A report is SUBMITTED, not resolved. The confirmation must not claim otherwise. */
  it('confirms honestly that a moderator will look, not that anything was done', async () => {
    open(ReportEntityType.Piece);
    // The dialog says so before submitting, too.
    expect(screen.getByText(/nothing changes straight away/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));
    expect(await screen.findByText('Report sent for review')).toBeInTheDocument();
  });

  it('surfaces a failure instead of claiming the report was sent', async () => {
    create.mockRejectedValue(
      new ApiError(429, { code: 'RATE_LIMIT_EXCEEDED', message: 'Slow down.' }),
    );
    open(ReportEntityType.Piece);

    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    expect(await screen.findByText('Couldn’t send the report')).toBeInTheDocument();
    expect(screen.queryByText('Report sent for review')).not.toBeInTheDocument();
  });
});
