import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMe } from '@/hooks/use-me';
import { renderWithProviders } from '@/test/render';
import type { ProfileResponse } from '@/types/profile';

import { useUpdateProfile, useUploadAvatar, useUploadCover } from '../hooks/use-profile-settings';
import { useGenreOptions, useLanguageOptions } from '../hooks/use-taxonomy';
import { EditProfilePage } from './edit-profile-page';

vi.mock('@/hooks/use-me', () => ({ useMe: vi.fn() }));
vi.mock('../hooks/use-taxonomy', () => ({
  useLanguageOptions: vi.fn(),
  useGenreOptions: vi.fn(),
}));
vi.mock('../hooks/use-profile-settings', () => ({
  useUpdateProfile: vi.fn(),
  useUploadAvatar: vi.fn(),
  useUploadCover: vi.fn(),
}));

const idleMutation = { mutate: vi.fn(), isPending: false };

function profile(over: Partial<ProfileResponse> = {}): ProfileResponse {
  return {
    id: 'u1',
    username: 'meera',
    penName: 'Meera',
    avatarKey: null,
    coverKey: null,
    bio: 'Poet.',
    location: 'Lucknow',
    websiteUrl: '',
    isPrivate: false,
    socialLinks: {},
    defaultLanguageId: 'l1',
    genres: [],
    counts: {
      followers: 0,
      following: 0,
      piecesPublished: 0,
      totalReads: 0,
      totalLikes: 0,
      totalClaps: 0,
      bookmarksReceived: 0,
      responseCount: 0,
    },
    viewerRelation: { isSelf: true, isFollowing: false, hasPendingRequest: false },
    restricted: false,
    ...over,
  };
}

describe('EditProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMe).mockReturnValue({
      data: profile(),
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useMe>);
    vi.mocked(useLanguageOptions).mockReturnValue({
      data: [
        {
          id: 'l1',
          code: 'ur',
          nameEn: 'Urdu',
          nativeName: 'اردو',
          direction: 'rtl',
          script: null,
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useLanguageOptions>);
    vi.mocked(useGenreOptions).mockReturnValue({
      data: [{ id: 'g1', slug: 'ghazal', name: 'Ghazal' }],
      isLoading: false,
    } as unknown as ReturnType<typeof useGenreOptions>);
    vi.mocked(useUpdateProfile).mockReturnValue(
      idleMutation as unknown as ReturnType<typeof useUpdateProfile>,
    );
    vi.mocked(useUploadAvatar).mockReturnValue(
      idleMutation as unknown as ReturnType<typeof useUploadAvatar>,
    );
    vi.mocked(useUploadCover).mockReturnValue(
      idleMutation as unknown as ReturnType<typeof useUploadCover>,
    );
  });

  it('prefills the form from the current profile', async () => {
    renderWithProviders(<EditProfilePage />, { route: '/settings/profile' });
    const penName = await screen.findByLabelText('Pen name');
    expect(penName).toHaveValue('Meera');
    expect(screen.getByLabelText('Bio')).toHaveValue('Poet.');
    expect(screen.getByLabelText('Location')).toHaveValue('Lucknow');
    expect(screen.getByText('Preferred language')).toBeInTheDocument();
  });

  it('reveals the sticky Save bar once the form is dirty', async () => {
    renderWithProviders(<EditProfilePage />, { route: '/settings/profile' });
    const penName = await screen.findByLabelText('Pen name');
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    fireEvent.change(penName, { target: { value: 'Meera Kumari' } });
    expect(await screen.findByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });
});
