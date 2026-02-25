import { systemPreferences } from 'electron';
import { PermissionStatus } from '@shared/contracts';

export class PermissionService {
  getStatus(): PermissionStatus {
    return {
      screenRecording: systemPreferences.getMediaAccessStatus('screen'),
      accessibilityTrusted: systemPreferences.isTrustedAccessibilityClient(false)
    };
  }
}
