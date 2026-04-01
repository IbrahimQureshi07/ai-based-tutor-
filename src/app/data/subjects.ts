import {
  Home,
  FileCheck,
  DollarSign,
  BarChart3,
  Calculator,
  FileText,
  Users,
  Eye,
  MapPin,
  Building2,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface SubjectMeta {
  /** Exact string stored in Supabase subject column */
  key: string;
  label: string;
  desc: string;
  section: 'A' | 'B';
  Icon: ComponentType<{ className?: string }>;
  accentClass: string;
  iconBgClass: string;
}

export const SUBJECTS: SubjectMeta[] = [
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
