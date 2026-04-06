import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useApp } from '@/app/context/ExamContext';
import { Button } from '@/app/components/ui/button';
import { ArrowLeft, BookOpen, ClipboardList, ChevronRight, ClipboardCheck } from 'lucide-react';
import { SUBJECTS, type SubjectMeta } from '@/app/data/subjects';
import { getCurrentUserId } from '@/app/services/userWrongQuestions';
import { fetchCompletedAssessmentTopicCodes } from '@/app/services/assessmentStageOne';

const SECTION_META = {
  A: {
    title: 'National Topics',
    subtitle: 'Federal real estate principles',
    color: 'text-primary',
    badge: 'bg-primary/10 text-primary',
  },
  B: {
    title: 'State Topics',
    subtitle: 'South Carolina-specific content',
    color: 'text-rose-500',
    badge: 'bg-rose-500/10 text-rose-500',
  },
} as const;

function SubjectCard({
  meta,
  index,
  mode,
  completedTopic,
  onPick,
}: {
  meta: SubjectMeta;
  index: number;
  mode: 'practice' | 'mock' | 'assessment';
  completedTopic?: boolean;
  onPick: (key: string) => void;
}) {
  const { Icon, label, desc, accentClass, iconBgClass } = meta;

  const subtitle =
    mode === 'practice'
      ? '5 random questions'
      : mode === 'mock'
        ? 'Full topic mock'
        : '35 questions · 12 easy / 13 medium / 10 hard';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: 'easeOut' }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
    >
      <button
        onClick={() => onPick(meta.key)}
        className={`w-full text-left p-5 rounded-2xl border-2 bg-card transition-all duration-200 group hover:shadow-lg ${accentClass}`}
      >
        <div className="flex items-start gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${iconBgClass}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm leading-snug">{label}</h3>
              <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
            <span className="inline-block mt-2 text-xs font-medium text-muted-foreground">
              {subtitle}
              {mode === 'assessment' && completedTopic && (
                <span className="ml-2 text-success font-semibold">· Completed before</span>
              )}
            </span>
          </div>
        </div>
      </button>
    </motion.div>
  );
}

export function SubjectSelect() {
  const {
    setCurrentScreen,
    subjectSelectFor,
    setSelectedPracticeSubject,
    setSelectedMockSubject,
    setSelectedAssessmentTopic,
  } = useApp();

  const [completedAssessmentTopics, setCompletedAssessmentTopics] = useState<string[]>([]);

  useEffect(() => {
    if (subjectSelectFor !== 'assessment') return;
    void (async () => {
      const uid = await getCurrentUserId();
      if (!uid) return;
      const codes = await fetchCompletedAssessmentTopicCodes(uid);
      setCompletedAssessmentTopics(codes);
    })();
  }, [subjectSelectFor]);

  const isPractice = subjectSelectFor === 'practice';
  const isAssessment = subjectSelectFor === 'assessment';

  const handlePick = (subjectKey: string) => {
    if (isPractice) {
      setSelectedPracticeSubject(subjectKey);
      setCurrentScreen('practice');
    } else if (isAssessment) {
      setSelectedAssessmentTopic(subjectKey);
      setCurrentScreen('assessment');
    } else {
      setSelectedMockSubject(subjectKey);
      setCurrentScreen('mock');
    }
  };

  const sectionA = SUBJECTS.filter((s) => s.section === 'A');
  const sectionB = SUBJECTS.filter((s) => s.section === 'B');

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Back button */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          <Button variant="ghost" className="mb-6 gap-2" onClick={() => setCurrentScreen('dashboard')}>
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Button>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-2">
            {isPractice ? (
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
            ) : isAssessment ? (
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <ClipboardCheck className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-warning" />
              </div>
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                {isPractice
                  ? 'Choose a topic'
                  : isAssessment
                    ? 'Stage 1 — Choose a topic'
                    : 'Mock Test — Choose a topic'}
              </h1>
              <p className="text-muted-foreground text-sm">
                {isPractice
                  ? '5 random questions per session · different mix each time'
                  : isAssessment
                    ? '35 questions per topic · first-try score + medium/hard wrong tracking'
                    : 'Full question set for the chosen topic'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Section A */}
        <SubjectSection
          section="A"
          subjects={sectionA}
          mode={subjectSelectFor}
          completedAssessmentTopics={completedAssessmentTopics}
          onPick={handlePick}
          globalOffset={0}
        />

        <div className="my-8 border-t border-border/50" />

        {/* Section B */}
        <SubjectSection
          section="B"
          subjects={sectionB}
          mode={subjectSelectFor}
          completedAssessmentTopics={completedAssessmentTopics}
          onPick={handlePick}
          globalOffset={sectionA.length}
        />
      </div>
    </div>
  );
}

function SubjectSection({
  section,
  subjects,
  mode,
  completedAssessmentTopics,
  onPick,
  globalOffset,
}: {
  section: 'A' | 'B';
  subjects: SubjectMeta[];
  mode: 'practice' | 'mock' | 'assessment';
  completedAssessmentTopics: string[];
  onPick: (key: string) => void;
  globalOffset: number;
}) {
  const meta = SECTION_META[section];

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, delay: globalOffset * 0.05 }}
        className="flex items-center gap-3 mb-4"
      >
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${meta.badge}`}>
          Section {section}
        </span>
        <div>
          <h2 className={`font-bold text-base ${meta.color}`}>{meta.title}</h2>
          <p className="text-xs text-muted-foreground">{meta.subtitle}</p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {subjects.map((s, i) => (
          <SubjectCard
            key={s.key}
            meta={s}
            index={globalOffset + i}
            mode={mode}
            completedTopic={mode === 'assessment' && completedAssessmentTopics.includes(s.key)}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}
