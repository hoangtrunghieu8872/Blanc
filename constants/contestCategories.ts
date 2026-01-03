// ============ CONTEST CATEGORY OPTIONS (synced from Admin) ============
// Copied from `ContestHub_4_Admin/components/ContestManager.tsx` -> `CONTEST_CATEGORIES`.

export const CONTEST_CATEGORIES = [
  { value: 'it', label: 'IT & Tech (Hackathon, Coding, AI/ML)' },
  { value: 'data', label: 'Data & Analytics' },
  { value: 'cyber', label: 'Cybersecurity' },
  { value: 'robotics', label: 'Robotics & IoT' },
  { value: 'design', label: 'Design / UI-UX' },
  { value: 'business', label: 'Business & Strategy' },
  { value: 'startup', label: 'Startup & Innovation' },
  { value: 'marketing', label: 'Marketing & Growth' },
  { value: 'finance', label: 'Finance & Fintech' },
  { value: 'health', label: 'Health & Biotech' },
  { value: 'education', label: 'Education & EdTech' },
  { value: 'sustainability', label: 'Sustainability & Environment' },
  { value: 'gaming', label: 'Gaming & Esports' },
  { value: 'research', label: 'Research & Science' },
  { value: 'other', label: 'Other' },
] as const;

export type ContestCategoryValue = (typeof CONTEST_CATEGORIES)[number]['value'];

