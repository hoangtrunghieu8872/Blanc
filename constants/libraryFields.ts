import { ContestCategoryValue } from './contestCategories';

export type LibraryFieldValue = '' | ContestCategoryValue;

export const LIBRARY_FIELD_LABELS: Record<ContestCategoryValue, string> = {
  it: 'IT & Tech',
  data: 'Data & Analytics',
  cyber: 'Cybersecurity',
  robotics: 'Robotics & IoT',
  design: 'Design / UI-UX',
  business: 'Business & Strategy',
  startup: 'Startup & Innovation',
  marketing: 'Marketing & Growth',
  finance: 'Finance & Fintech',
  health: 'Health & Biotech',
  education: 'Education & EdTech',
  sustainability: 'Sustainability & Environment',
  gaming: 'Gaming & Esports',
  research: 'Research & Science',
  other: 'Other',
};

export const LIBRARY_FIELDS: Array<{ value: LibraryFieldValue; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'it', label: LIBRARY_FIELD_LABELS.it },
  { value: 'design', label: LIBRARY_FIELD_LABELS.design },
  { value: 'data', label: LIBRARY_FIELD_LABELS.data },
  { value: 'marketing', label: LIBRARY_FIELD_LABELS.marketing },
  { value: 'cyber', label: LIBRARY_FIELD_LABELS.cyber },
  { value: 'robotics', label: LIBRARY_FIELD_LABELS.robotics },
  { value: 'business', label: LIBRARY_FIELD_LABELS.business },
  { value: 'startup', label: LIBRARY_FIELD_LABELS.startup },
  { value: 'finance', label: LIBRARY_FIELD_LABELS.finance },
  { value: 'health', label: LIBRARY_FIELD_LABELS.health },
  { value: 'education', label: LIBRARY_FIELD_LABELS.education },
  { value: 'sustainability', label: LIBRARY_FIELD_LABELS.sustainability },
  { value: 'gaming', label: LIBRARY_FIELD_LABELS.gaming },
  { value: 'research', label: LIBRARY_FIELD_LABELS.research },
  { value: 'other', label: LIBRARY_FIELD_LABELS.other },
];

const FIELD_PATTERNS: Record<ContestCategoryValue, RegExp> = {
  it: /\b(react|next\.?js|node\.?js|javascript|typescript|ts|python|java\b|golang|go\b|c\+\+|cpp|c#|dotnet|\.net|php|ruby|swift|kotlin|android|ios|flutter|dart|html|css|web|frontend|back[- ]?end|full[- ]?stack|devops|docker|kubernetes|git|api|algorithm|coding|code|programming|lập\s*trình|phần\s*mềm|software)\b/i,
  data: /\b(data|analytics|analysis|bi|business intelligence|power\s*bi|tableau|sql|nosql|etl|warehouse|lakehouse|big\s*data|spark|hadoop|ml|ai|machine\s*learning|deep\s*learning|neural|nlp|llm|gen(erative)?\s*ai|computer\s*vision|cv\b|thị\s*giác\s*máy|trí\s*tuệ\s*nhân\s*tạo|dữ\s*liệu|phân\s*tích)\b/i,
  cyber: /\b(cyber|cybersecurity|security|infosec|pentest|penetration|vulnerability|exploit|malware|forensics|soc\b|siem|xdr|iam|owasp|zero\s*trust|bảo\s*mật|an\s*ninh\s*mạng|kiểm\s*thử\s*xâm\s*nhập)\b/i,
  robotics: /\b(robot|robotics|iot\b|internet\s*of\s*things|embedded|arduino|raspberry\s*pi|stm32|microcontroller|firmware|sensor|hardware|pcb|mạch|nhúng|phần\s*cứng)\b/i,
  design: /\b(ui|ux|ui\/ux|design|figma|sketch|adobe|photoshop|illustrator|after\s*effects|motion|animation|graphic|branding|typography|layout|thiết\s*kế|đồ\s*họa)\b/i,
  business: /\b(business|strategy|management|operations|product\s*management|product|pm\b|ba\b|business\s*analyst|case\s*study|consulting|leadership|sales|crm|kpi|okrs?|kinh\s*doanh|chiến\s*lược|quản\s*trị|quản\s*lý)\b/i,
  startup: /\b(startup|innovation|entrepreneur(ship)?|pitch|venture|mvp\b|incubator|accelerator|founder|go[- ]?to[- ]?market|gtm\b|khởi\s*nghiệp|đổi\s*mới)\b/i,
  marketing: /\b(marketing|growth|seo\b|sem\b|ads?|facebook\s*ads|google\s*ads|tiktok|content|social|brand(ing)?|pr\b|copywriting|email\s*marketing|crm|tiếp\s*thị|tăng\s*trưởng)\b/i,
  finance: /\b(finance|fintech|bank(ing)?|accounting|audit|investment|trading|stocks?|portfolio|risk|crypto|blockchain|defi|tài\s*chính|kế\s*toán|đầu\s*tư)\b/i,
  health: /\b(health|biotech|bio\b|medical|medicine|pharma|clinical|genomics?|proteomics?|lab|sức\s*khỏe|y\s*tế|sinh\s*học)\b/i,
  education: /\b(education|edtech|learning|teaching|training|course|curriculum|lms\b|giáo\s*dục|giảng\s*dạy|đào\s*tạo)\b/i,
  sustainability: /\b(sustainability|environment|climate|renewable|carbon|esg\b|green|recycle|circular|môi\s*trường|bền\s*vững|khí\s*hậu)\b/i,
  gaming: /\b(gaming|esports|game\s*dev|gameplay|unity|unreal|steam|trò\s*chơi|game)\b/i,
  research: /\b(research|science|scientific|paper|publication|journal|thesis|academic|study\b|nghiên\s*cứu|khoa\s*học)\b/i,
  other: /$^/i,
};

export function matchesLibraryField(field: ContestCategoryValue, rawText: string): boolean {
  const text = String(rawText || '');

  if (field === 'other') {
    return (Object.keys(FIELD_PATTERNS) as ContestCategoryValue[])
      .filter((key) => key !== 'other')
      .every((key) => !FIELD_PATTERNS[key].test(text));
  }

  return FIELD_PATTERNS[field]?.test(text) ?? false;
}

