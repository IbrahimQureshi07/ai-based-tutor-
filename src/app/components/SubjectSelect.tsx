import { motion } from 'motion/react';
import { useApp } from '@/app/context/ExamContext';
import { Button } from '@/app/components/ui/button';
import {
  ArrowLeft,
  BookOpen,
  ClipboardList,
  Home,
  DollarSign,
  BarChart3,
  Calculator,
  FileCheck,
  FileText,
  Users,
  Eye,
  MapPin,
  Building2,
  ChevronRight,
} from 'lucide-react';

interface SubjectMeta {
  /** Exact string stored in Supabase subject column */
  key: string;
  label: string;
  desc: string;
  section: 'A' | 'B';
  Icon: React.ComponentType<{ className?: string }>;
  accentClass: string;
  iconBgClass: string;
}

const SUBJECTS: SubjectMeta[] = [
  {
    key: 'A1 Real Property',
    label: 'A1 — Real Property',
    desc: 'Land, ownership types & property rights',
    section: 'A',
    Icon: Home,
    accentClass: 'border-blue-500/40 hover:border-blue-500',
    iconBgClass: 'bg-blue-500/10 text-blue-500',
  },
  {
    key: 'A2 Real Property',
    label: 'A2 — Real Property (cont.)',
    desc: 'Deeds, title transfer & encumbrances',
    section: 'A',
    Icon: FileCheck,
    accentClass: 'border-indigo-500/40 hover:border-indigo-500',
    iconBgClass: 'bg-indigo-500/10 text-indigo-500',
  },
  {
    key: 'A3 Financing',
    label: 'A3 — Financing',
    desc: 'Mortgages, loans & lending basics',
    section: 'A',
    Icon: DollarSign,
    accentClass: 'border-emerald-500/40 hover:border-emerald-500',
    iconBgClass: 'bg-emerald-500/10 text-emerald-500',
  },
  {
    key: 'A4 Appraisal and Valuation',
    label: 'A4 — Appraisal & Valuation',
    desc: 'Property value methods & approaches',
    section: 'A',
    Icon: BarChart3,
    accentClass: 'border-violet-500/40 hover:border-violet-500',
    iconBgClass: 'bg-violet-500/10 text-violet-500',
  },
  {
    key: 'A5 Real Estate Math',
    label: 'A5 — Real Estate Math',
    desc: 'Tax, commission & financial calculations',
    section: 'A',
    Icon: Calculator,
    accentClass: 'border-orange-500/40 hover:border-orange-500',
    iconBgClass: 'bg-orange-500/10 text-orange-500',
  },
  {
    key: 'A6 Closing and Settlem',
    label: 'A6 — Closing & Settlement',
    desc: 'Closing process, statements & proration',
    section: 'A',
    Icon: FileText,
    accentClass: 'border-teal-500/40 hover:border-teal-500',
    iconBgClass: 'bg-teal-500/10 text-teal-500',
  },
  {
    key: 'B1 Contracts',
    label: 'B1 — Contracts',
    desc: 'Contract law, offers & acceptance',
    section: 'B',
    Icon: FileText,
    accentClass: 'border-rose-500/40 hover:border-rose-500',
    iconBgClass: 'bg-rose-500/10 text-rose-500',
  },
  {
    key: 'B2 Agency',
    label: 'B2 — Agency',
    desc: 'Agent duties, fiduciary obligations',
    section: 'B',
    Icon: Users,
    accentClass: 'border-pink-500/40 hover:border-pink-500',
    iconBgClass: 'bg-pink-500/10 text-pink-500',
  },
  {
    key: 'B3 Agency',
    label: 'B3 — Agency (Advanced)',
    desc: 'Buyer representation & dual agency',
    section: 'B',
    Icon: Users,
    accentClass: 'border-fuchsia-500/40 hover:border-fuchsia-500',
    iconBgClass: 'bg-fuchsia-500/10 text-fuchsia-500',
  },
  {
    key: 'B4 Disclosure',
    label: 'B4 — Disclosure',
    desc: 'Seller disclosure & material defects',
    section: 'B',
    Icon: Eye,
    accentClass: 'border-amber-500/40 hover:border-amber-500',
    iconBgClass: 'bg-amber-500/10 text-amber-500',
  },
  {
    key: 'B5 South Carolina Real Estate',
    label: 'B5 — SC Real Estate Law',
    desc: 'South Carolina-specific statutes & rules',
    section: 'B',
    Icon: MapPin,
    accentClass: 'border-cyan-500/40 hover:border-cyan-500',
    iconBgClass: 'bg-cyan-500/10 text-cyan-500',
  },
  {
    key: 'B6 Governmental Controls',
    label: 'B6 — Governmental Controls',
    desc: 'Zoning, eminent domain & land-use law',
    section: 'B',
    Icon: Building2,
    accentClass: 'border-lime-500/40 hover:border-lime-500',
    iconBgClass: 'bg-lime-500/10 text-lime-500',
  },
];

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
