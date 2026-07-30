import { QAvatar, QButton, useToast } from '@qalam/ui';
import { Camera } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';

import { getErrorMessage } from '@/lib/errors';
import { messageFor } from '@/lib/error-messages';
import { mediaUrl } from '@/lib/media';

import { useUploadAvatar } from '../hooks/use-profile-settings';
import { validateAvatarImage } from '../lib/image-validation';

/**
 * Avatar upload / replace (docs/06 §3.8, docs/32 §6). Round 80px preview, client-side type+size
 * validation (≤5 MB, JPEG/PNG/WebP), a determinate progress bar via the XHR-progress upload, and
 * an instant preview from the returned key. No remove endpoint in `v1` — replace only (docs/32
 * §11). The mutation invalidates the identity + profile caches so every surface updates.
 */
export function AvatarUploader({ avatarKey }: { avatarKey: string | null }): ReactElement {
  const upload = useUploadAvatar();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [key, setKey] = useState<string | null>(avatarKey);
  const [progress, setProgress] = useState<number | null>(null);

  // Adopt an externally-refreshed key (e.g. after the identity query refetches).
  useEffect(() => {
    setKey(avatarKey);
  }, [avatarKey]);

  const handleFile = (file: File): void => {
    const error = validateAvatarImage(file);
    if (error) {
      toast.error('Couldn’t add that image', { description: messageFor(error) });
      return;
    }
    setProgress(0);
    upload.mutate(
      { file, onProgress: setProgress },
      {
        onSuccess: (result) => {
          setProgress(null);
          setKey(result.key);
          toast.success('Avatar updated');
        },
        onError: (err) => {
          setProgress(null);
          toast.error('Couldn’t upload your avatar', { description: getErrorMessage(err) });
        },
      },
    );
  };

  return (
    <div className="flex items-center gap-4">
      <QAvatar
        size={80}
        src={mediaUrl(key)}
        name="Your avatar"
        className="dark:brightness-[0.92]"
      />
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
        <QButton
          variant="secondary"
          size="sm"
          icon={Camera}
          loading={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {key ? 'Change avatar' : 'Add avatar'}
        </QButton>
        {progress !== null ? (
          <progress
            value={progress}
            max={100}
            aria-label="Avatar upload progress"
            className="h-1 w-40"
          />
        ) : (
          <span className="text-xs text-ink-muted">JPEG, PNG, or WebP · up to 5 MB</span>
        )}
      </div>
    </div>
  );
}
