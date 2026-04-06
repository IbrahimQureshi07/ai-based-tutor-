import { useEffect } from 'react';
import { useApp } from '@/app/context/ExamContext';
import { StageOneAssessment } from '@/app/components/StageOneAssessment';

/** Stage 1 — 35 questions per topic (A1–B6), dataset + remediation + DB outcomes. */
export function Assessment() {
  const { selectedAssessmentTopic, setCurrentScreen, setSubjectSelectFor } = useApp();

  useEffect(() => {
    if (!selectedAssessmentTopic) {
      setSubjectSelectFor('assessment');
      setCurrentScreen('subjectSelect');
    }
  }, [selectedAssessmentTopic, setCurrentScreen, setSubjectSelectFor]);

  if (!selectedAssessmentTopic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return <StageOneAssessment topicKey={selectedAssessmentTopic} />;
}
