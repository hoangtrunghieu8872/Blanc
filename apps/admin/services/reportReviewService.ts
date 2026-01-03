import api from './api';

export type ReviewStatus = 'draft' | 'submitted' | 'needs_changes' | 'approved';

export interface ReviewReportOwner {
  id: string | null;
  name: string;
  email: string;
  avatar?: string | null;
  role?: string;
}

export interface ReviewReportSummary {
  id: string;
  title: string;
  template: string;
  status: string;
  reviewStatus: ReviewStatus;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  user: ReviewReportOwner;
}

export interface ReviewFeedbackItem {
  id: string;
  reportId: string;
  authorId: string;
  authorRole: string;
  authorName?: string | null;
  authorAvatar?: string | null;
  message: string;
  createdAt?: string | null;
}

export interface ReviewReportActivity {
  id: string;
  title: string;
  description?: string | null;
  occurredAt?: string | null;
}

export interface ReviewReportEvidence {
  id: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  url: string;
  uploadedAt?: string | null;
}

export interface ReviewReportDetail extends ReviewReportSummary {
  content?: string;
  activities?: ReviewReportActivity[];
  evidence?: ReviewReportEvidence[];
}

export interface ReviewListResponse {
  items: ReviewReportSummary[];
  total: number;
  limit: number;
  skip: number;
  hasMore: boolean;
}

export interface ReviewDetailResponse {
  report: ReviewReportDetail;
  feedback: ReviewFeedbackItem[];
}

export const reportReviewService = {
  list: async (params: {
    status?: ReviewStatus | 'all';
    template?: string;
    search?: string;
    limit?: number;
    skip?: number;
  } = {}): Promise<ReviewListResponse> => {
    const response = await api.get<ReviewListResponse>('/review/reports', { params });
    return response.data;
  },

  getById: async (id: string): Promise<ReviewDetailResponse> => {
    const response = await api.get<ReviewDetailResponse>(`/review/reports/${encodeURIComponent(id)}`);
    return response.data;
  },

  addFeedback: async (id: string, message: string): Promise<ReviewFeedbackItem> => {
    const response = await api.post<{ feedback: ReviewFeedbackItem }>(
      `/review/reports/${encodeURIComponent(id)}/feedback`,
      { message }
    );
    return response.data.feedback;
  },

  updateStatus: async (id: string, reviewStatus: Exclude<ReviewStatus, 'draft'>): Promise<void> => {
    await api.patch(`/review/reports/${encodeURIComponent(id)}/status`, { reviewStatus });
  },
};

export default reportReviewService;
