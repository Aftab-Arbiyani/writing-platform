import { QButton, useToast } from '@qalam/ui';
import { ImagePlus } from 'lucide-react';
import { useRef, useState, type ReactElement } from 'react';

import { getErrorMessage } from '@/lib/errors';
import { messageFor } from '@/lib/error-messages';
import { mediaUrl } from '@/lib/media';

import { useUploadCover } from '../hooks/use-upload-cover';
import { validateCoverImage } from '../lib/image-validation';

/**
 * Cover upload / replace (docs/06 §3.4, docs/32 §6). Validates type + size client-side for
 * instant feedback, shows a determinate progress bar via the XHR-progress upload, and previews
 * the result from the returned key. There is no remove-cover endpoint in `v1` (docs/32 §11), so
 * only add/replace are offered.
 */
export function CoverUploader({
  pieceId,
  coverKey,
  onUploaded,
}: {
  pieceId: string;
  coverKey: string | null;
  onUploaded: (key: string) => void;
}): ReactElement {
  const upload = useUploadCover();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const url = mediaUrl(coverKey);

  const handleFile = (file: File): void => {
    const error = validateCoverImage(file);
    if (error) {
      toast.error('Couldn’t add that image', { description: messageFor(error) });
      return;
    }
    setProgress(0);
    upload.mutate(
      { id: pieceId, file, onProgress: setProgress },
      {
        onSuccess: ({ key }) => {
          setProgress(null);
          onUploaded(key);
          toast.success('Cover updated');
        },
        onError: (err) => {
          setProgress(null);
          toast.error('Couldn’t upload the cover', { description: getErrorMessage(err) });
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
          className="aspect-[2/1] w-full rounded-md border border-line object-cover"
        />
      ) : (
        <div className="flex aspect-[2/1] w-full items-center justify-center rounded-md border border-dashed border-line bg-raised text-xs text-ink-muted">
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
      <QButton
        variant="secondary"
        size="sm"
        icon={ImagePlus}
        loading={upload.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {coverKey ? 'Replace cover' : 'Add cover'}
      </QButton>
    </div>
  );
}
