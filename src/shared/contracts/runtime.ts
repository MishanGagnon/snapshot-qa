export type InferenceStatus = 'idle' | 'pending' | 'complete' | 'error';

export type ErrorCode =
  | 'MISSING_KEY'
  | 'MISSING_CONTEXT'
  | 'PERMISSION_DENIED'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'MODEL_ERROR';

export interface LatestResponse {
  status: InferenceStatus;
  responseId: number;
  text: string;
  errorCode?: ErrorCode;
  updatedAt: number;
  copiedForDisplay: boolean;
}

export interface PermissionStatus {
  screenRecording: string;
  accessibilityTrusted: boolean;
}
