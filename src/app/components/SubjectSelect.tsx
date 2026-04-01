import { motion } from 'motion/react';
import { useApp } from '@/app/context/ExamContext';
import { Button } from '@/app/components/ui/button';
import { ArrowLeft, BookOpen, ClipboardList, ChevronRight } from 'lucide-react';
import { SUBJECTS, type SubjectMeta } from '@/app/data/subjects';

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
  isPractice,
  onPick,
}: {
  meta: SubjectMeta;
  index: number;
  isPractice: boolean;
  onPick: (key: string) => void;
}) {
  const { Icon, label, desc, accentClass, iconBgClass } = meta;

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
              {isPractice ? '5 random questions' : 'Full topic mock'}
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
  } = useApp();

  const isPractice = subjectSelectFor === 'practice';

  const handlePick = (subjectKey: string) => {
    if (isPractice) {
      setSelectedPracticeSubject(subjectKey);
      setCurrentScreen('practice');
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
            ) : (
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-warning" />
              </div>
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                {isPractice ? 'Choose a topic' : 'Mock Test — Choose a topic'}
              </h1>
              <p className="text-muted-foreground text-sm">
                {isPractice
                  ? '5 random questions per session · different mix each time'
                  : 'Full question set for the chosen topic'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Section A */}
        <SubjectSection
          section="A"
          subjects={sectionA}
          isPractice={isPractice}
          onPick={handlePick}
          globalOffset={0}
        />

        <div className="my-8 border-t border-border/50" />

        {/* Section B */}
        <SubjectSection
          section="B"
          subjects={sectionB}
          isPractice={isPractice}
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
  isPractice,
  onPick,
  globalOffset,
}: {
  section: 'A' | 'B';
  subjects: SubjectMeta[];
  isPractice: boolean;
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
            isPractice={isPractice}
            onPick={onPick}
          />
        ))}
      </div>
    </div>
  );
}
