import { ErrorCode, LatestResponse } from '@shared/contracts';

const initialState: LatestResponse = {
  status: 'idle',
  responseId: 0,
  text: '',
  updatedAt: Date.now(),
  copiedForDisplay: false
};

export class LatestResponseStore {
  private state: LatestResponse = { ...initialState };

  get(): LatestResponse {
    return { ...this.state };
  }

  setPending(nextId: number): LatestResponse {
    this.state = {
      status: 'pending',
      responseId: nextId,
      text: '',
      updatedAt: Date.now(),
      copiedForDisplay: false
    };
    return this.get();
  }

  setComplete(responseId: number, text: string): LatestResponse {
    this.state = {
      status: 'complete',
      responseId,
      text,
      updatedAt: Date.now(),
      copiedForDisplay: false
    };
    return this.get();
  }

  setError(responseId: number, text: string, code: ErrorCode): LatestResponse {
    this.state = {
      status: 'error',
      responseId,
      text,
      errorCode: code,
      updatedAt: Date.now(),
      copiedForDisplay: false
    };
    return this.get();
  }

  markCopiedForDisplay(responseId: number): void {
    if (this.state.responseId !== responseId) {
      return;
    }

    this.state = {
      ...this.state,
      copiedForDisplay: true
    };
  }
}
