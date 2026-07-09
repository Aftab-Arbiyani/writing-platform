import { HttpStatus } from '@nestjs/common';
import { ERROR_CODES } from '@qalam/shared';

import { AppException } from '../../common/exceptions/app.exception';

/** Admin referenced a queue name that is not registered. */
export class QueueNotFoundException extends AppException {
  constructor(name: string) {
    super(ERROR_CODES.QUEUE_NOT_FOUND, `No such queue: "${name}".`, HttpStatus.NOT_FOUND);
  }
}

/** Admin referenced a job id that does not exist in the given queue. */
export class JobNotFoundException extends AppException {
  constructor(jobId: string) {
    super(ERROR_CODES.JOB_NOT_FOUND, `No such job: "${jobId}".`, HttpStatus.NOT_FOUND);
  }
}

/** Retry requested for a job that is not in a failed state. */
export class JobNotRetryableException extends AppException {
  constructor() {
    super(ERROR_CODES.JOB_NOT_RETRYABLE, 'Only failed jobs can be retried.', HttpStatus.CONFLICT);
  }
}
