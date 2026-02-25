import { ErrorCode } from '@shared/contracts';

export class InferenceError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'InferenceError';
  }
}
