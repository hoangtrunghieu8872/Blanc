import { api } from '../lib/api';
import { ReportActivity, ReportEvidence } from '../types';
import { ReportFeedbackItem } from './reportService';

export type ReviewStatus = 'draft' | 'submitted' | 'needs_changes' | 'approved';

export interface ReviewReportOwner {
  id: string | null;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
}

export interface ReviewReportSummary {
  id: string;
  title: string;
  template: string;
  status: 'Draft' | 'Ready' | 'Sent';
  reviewStatus: ReviewStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  relatedType?: 'contest' | 'course' | null;
  relatedId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  user: ReviewReportOwner;
}

export interface ReviewReportDetail extends ReviewReportSummary {
  content: string;
  activities: ReportActivity[];
  evidence: ReportEvidence[];
}

export interface ReviewReportsListResponse {
  items: ReviewReportSummary[];
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
}

export interface ReviewReportDetailResponse {
  report: ReviewReportDetail;
  feedback: ReportFeedbackItem[];
}

export interface ReviewReportsListParams {
  status?: ReviewStatus | 'all';
  template?: string;
  search?: string;
  limit?: number;
  skip?: number;
}

export const reviewReportService = {
  list: async (params: ReviewReportsListParams = {}): Promise<ReviewReportsListResponse> => {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set('status', params.status);
    if (params.template) searchParams.set('template', params.template);
    if (params.search) searchParams.set('search', params.search);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.skip) searchParams.set('skip', String(params.skip));
    const query = searchParams.toString();
    return api.get<ReviewReportsListResponse>(query ? `/review/reports?${query}` : '/review/reports');
  },

  getById: async (id: string): Promise<ReviewReportDetailResponse> => {
    return api.get<ReviewReportDetailResponse>(`/review/reports/${id}`);
  },

  addFeedback: async (id: string, message: string): Promise<{ feedback: ReportFeedbackItem }> => {
    return api.post<{ feedback: ReportFeedbackItem }>(`/review/reports/${id}/feedback`, { message });
  },

  updateStatus: async (
    id: string,
    reviewStatus: Extract<ReviewStatus, 'needs_changes' | 'approved' | 'submitted'>
  ): Promise<{ ok: boolean; reportId: string; reviewStatus: ReviewStatus }> => {
    return api.patch<{ ok: boolean; reportId: string; reviewStatus: ReviewStatus }>(`/review/reports/${id}/status`, {
      reviewStatus,
    });
  },
};

export default reviewReportService;

