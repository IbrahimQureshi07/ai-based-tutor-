import { clearNav } from '@/app/services/examNavigationStorage';
import { clearMockSession } from '@/app/services/mockTestSessionStorage';
import { clearFinalExamSession } from '@/app/services/finalExamSessionStorage';
import { clearAllLinearFlowSnapshots } from '@/app/services/linearFlowSessionStorage';

/** Call on sign-out so the next user never inherits routes or in-progress tests. */
export function clearAllExamClientSessions(): void {
  clearNav();
  clearMockSession();
  clearFinalExamSession();
  clearAllLinearFlowSnapshots();
}
