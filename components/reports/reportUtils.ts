import { Report, ReportActivity, ReportEvidence } from '../../types';

export type AnyReviewStatus = 'draft' | 'submitted' | 'needs_changes' | 'approved' | undefined;

export function isMentorRole(role?: string) {
  return role === 'mentor' || role === 'admin' || role === 'super_admin';
}

export function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('vi-VN');
}

export function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('vi-VN');
}

export function toDatetimeLocalInput(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function safeUuid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

export function reviewStatusLabel(status: AnyReviewStatus) {
  switch (status) {
    case 'submitted':
      return 'Đang chờ mentor';
    case 'needs_changes':
      return 'Cần chỉnh sửa';
    case 'approved':
      return 'Đã duyệt';
    case 'draft':
    default:
      return 'Bản nháp';
  }
}

export function reviewStatusBadgeClass(status: AnyReviewStatus) {
  switch (status) {
    case 'submitted':
      return 'bg-amber-50 text-amber-700 border-amber-100';
    case 'needs_changes':
      return 'bg-rose-50 text-rose-700 border-rose-100';
    case 'approved':
      return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    case 'draft':
    default:
      return 'bg-slate-50 text-slate-700 border-slate-100';
  }
}

export function normalizeUrl(value: string) {
  const raw = value.trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export function isHttpUrl(value: string) {
  if (!value) return false;
  const normalized = normalizeUrl(value);
  if (!/^https?:\/\//i.test(normalized)) return false;
  return normalized !== 'https://' && normalized !== 'http://';
}

export function readDismissedEvidenceReminders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('reports_evidence_reminders_dismissed');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export function writeDismissedEvidenceReminders(value: Record<string, string>) {
  try {
    localStorage.setItem('reports_evidence_reminders_dismissed', JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function normalizeActivitiesForSave(activities: ReportActivity[]): ReportActivity[] {
  return (activities || [])
    .filter((a) => String(a.title || '').trim())
    .map((a) => ({
      ...a,
      title: String(a.title || '').trim(),
      description: a.description ? String(a.description).trim() : null,
    }));
}

export function normalizeEvidenceForSave(evidence: ReportEvidence[]): ReportEvidence[] {
  return (evidence || [])
    .filter((ev) => {
      const name = String(ev.fileName || '').trim();
      const url = String(ev.url || '').trim();
      return Boolean(name || url);
    })
    .map((ev) => {
      const name = String(ev.fileName || '').trim();
      const urlRaw = String(ev.url || '').trim();
      return {
        ...ev,
        fileId: '',
        mimeType: 'link',
        fileName: name,
        url: urlRaw ? normalizeUrl(urlRaw) : '',
        uploadedAt: ev.uploadedAt || new Date().toISOString(),
      };
    });
}

export function validateActivities(activities: ReportActivity[]) {
  const invalid = (activities || []).find((a) => !String(a.title || '').trim());
  return invalid ? 'Thành tích: tiêu đề là bắt buộc.' : null;
}

export function validateEvidence(evidence: ReportEvidence[]) {
  for (const ev of evidence || []) {
    const name = String(ev.fileName || '').trim();
    const url = String(ev.url || '').trim();

    if (!name && !url) continue;
    if (!name || !url) return 'Minh chứng: cần nhập đủ Tên minh chứng và Link.';
    if (!isHttpUrl(url)) return 'Minh chứng: link phải là http/https hợp lệ.';
  }
  return null;
}

export function canSubmitForReview(report: Pick<Report, 'reviewStatus'>) {
  return report.reviewStatus !== 'submitted';
}

