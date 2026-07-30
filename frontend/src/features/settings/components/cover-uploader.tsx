import { QButton, useToast } from '@qalam/ui';
import { ImagePlus } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';

import { getErrorMessage } from '@/lib/errors';
import { messageFor } from '@/lib/error-messages';
import { mediaUrl } from '@/lib/media';

import { useUploadCover } from '../hooks/use-profile-settings';
import { validateCoverImage } from '../lib/image-validation';

/**
 * Profile cover upload / replace (docs/06 §3.8, docs/32 §6). 3:1 preview, client-side type+size
 * validation (≤10 MB, JPEG/PNG/WebP), determinate progress, instant preview from the returned
 * key. Distinct from the writing feature's piece-cover uploader (different endpoint + cap). No
 * remove endpoint in `v1` — replace only (docs/32 §11).
 */
export function CoverUploader({ coverKey }: { coverKey: string | null }): ReactElement {
  const upload = useUploadCover();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [key, setKey] = useState<string | null>(coverKey);
  const [progress, setProgress] = useState<number | null>(null);
  const url = mediaUrl(key);

  useEffect(() => {
    setKey(coverKey);
  }, [coverKey]);

  const handleFile = (file: File): void => {
    const error = validateCoverImage(file);
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
          toast.success('Cover updated');
        },
        onError: (err) => {
          setProgress(null);
          toast.error('Couldn’t upload your cover', { description: getErrorMessage(err) });
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {url ? (
        <img
          src={url}
          alt="Cover preview"
          width={1200}
          height={400}
          loading="lazy"
          className="aspect-[3/1] w-full rounded-md border border-line object-cover dark:brightness-[0.92]"
        />
      ) : (
        <div className="flex aspect-[3/1] w-full items-center justify-center rounded-md border border-dashed border-line bg-raised text-xs text-ink-muted">
          No cover yet
        </div>
      )}

      {progress !== null ? (
        <progress
          value={progress}
          max={100}
          aria-label="Cover upload progress"
          className="h-1 w-full"
        />
      ) : null}

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
      <div className="flex items-center gap-3">
        <QButton
          variant="secondary"
          size="sm"
          icon={ImagePlus}
          loading={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {key ? 'Replace cover' : 'Add cover'}
        </QButton>
        <span className="text-xs text-ink-muted">JPEG, PNG, or WebP · up to 10 MB</span>
      </div>
    </div>
  );
}
