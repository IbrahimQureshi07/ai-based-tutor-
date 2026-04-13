import { clearNav } from '@/app/services/examNavigationStorage';
import { clearMockSession } from '@/app/services/mockTestSessionStorage';
import { clearFinalExamSession } from '@/app/services/finalExamSessionStorage';
import { clearAllLinearFlowSnapshots } from '@/app/services/linearFlowSessionStorage';

/** SessionStorage prefix for one-time AI tutor unlock toasts (see Results.tsx). */
export const AI_CHAT_DEDUP_PREFIX = 'exam_prep_ai_chat_dedup:';

/** Remove session-scoped “unlock” toast dedupe keys (next user / re-login can see them again). */
export function clearAiTutorUnlockChatDedupKeys(): void {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(AI_CHAT_DEDUP_PREFIX)) sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

/** Call on sign-out so the next user never inherits routes or in-progress tests. */
export function clearAllExamClientSessions(): void {
  clearNav();
  clearMockSession();
  clearFinalExamSession();
  clearAllLinearFlowSnapshots();
  clearAiTutorUnlockChatDedupKeys();
}
