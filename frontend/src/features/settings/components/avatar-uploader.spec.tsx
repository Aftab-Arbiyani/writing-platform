import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/render';

import { useUploadAvatar } from '../hooks/use-profile-settings';
import { AvatarUploader } from './avatar-uploader';

vi.mock('../hooks/use-profile-settings', () => ({ useUploadAvatar: vi.fn() }));

const mutate = vi.fn();

function fileInput(): HTMLInputElement {
  const input = document.querySelector('input[type="file"]');
  if (!input) throw new Error('file input not found');
  return input as HTMLInputElement;
}

describe('AvatarUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useUploadAvatar).mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useUploadAvatar>);
  });

  it('offers to add an avatar when none is set', () => {
    renderWithProviders(<AvatarUploader avatarKey={null} />);
    expect(screen.getByRole('button', { name: 'Add avatar' })).toBeInTheDocument();
  });

  it('says “Change avatar” when one exists', () => {
    renderWithProviders(<AvatarUploader avatarKey="profiles/u1/avatar.webp" />);
    expect(screen.getByRole('button', { name: 'Change avatar' })).toBeInTheDocument();
  });

  it('rejects an unsupported type before uploading', () => {
    renderWithProviders(<AvatarUploader avatarKey={null} />);
    fireEvent.change(fileInput(), {
      target: { files: [new File(['x'], 'a.gif', { type: 'image/gif' })] },
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  it('uploads a valid image', () => {
    renderWithProviders(<AvatarUploader avatarKey={null} />);
    fireEvent.change(fileInput(), {
      target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({ file: expect.any(File) }),
      expect.anything(),
    );
  });
});
