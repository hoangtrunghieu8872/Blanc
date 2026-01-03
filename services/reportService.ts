import { api } from '../lib/api';
import { Report, ReportActivity, ReportEvidence, ReportTemplate, ReportsResponse } from '../types';

export interface CreateReportData {
    title: string;
    template: string;
    content?: string;
    status?: 'Draft' | 'Ready' | 'Sent';
    relatedType?: 'contest' | 'course' | null;
    relatedId?: string | null;
}

export interface UpdateReportData {
    title?: string;
    content?: string;
    status?: 'Draft' | 'Ready' | 'Sent';
    activities?: ReportActivity[];
    evidence?: ReportEvidence[];
    relatedType?: 'contest' | 'course' | null;
    relatedId?: string | null;
}

export interface GetReportsParams {
    status?: string;
    template?: string;
    search?: string;
    limit?: number;
    skip?: number;
}

export interface ReportFeedbackItem {
    id: string;
    reportId: string;
    authorId: string;
    authorRole: string;
    authorName?: string | null;
    authorAvatar?: string | null;
    message: string;
    createdAt?: string | null;
}

export const reportService = {
    /**
     * Lấy danh sách báo cáo của user
     */
    getAll: async (params?: GetReportsParams): Promise<ReportsResponse> => {
        const searchParams = new URLSearchParams();
        if (params?.status) searchParams.append('status', params.status);
        if (params?.template) searchParams.append('template', params.template);
        if (params?.search) searchParams.append('search', params.search);
        if (params?.limit) searchParams.append('limit', params.limit.toString());
        if (params?.skip) searchParams.append('skip', params.skip.toString());

        const queryString = searchParams.toString();
        const endpoint = queryString ? `/reports?${queryString}` : '/reports';

        return api.get<ReportsResponse>(endpoint);
    },

    /**
     * Lấy chi tiết một báo cáo
     */
    getById: async (id: string): Promise<Report> => {
        return api.get<Report>(`/reports/${id}`);
    },

    /**
     * Tạo báo cáo mới
     */
    create: async (data: CreateReportData): Promise<Report> => {
        return api.post<Report>('/reports', data);
    },

    /**
     * Cập nhật báo cáo
     */
    update: async (id: string, data: UpdateReportData): Promise<Report> => {
        return api.put<Report>(`/reports/${id}`, data);
    },

    /**
     * Xóa báo cáo
     */
    delete: async (id: string): Promise<{ success: boolean; message: string }> => {
        return api.delete<{ success: boolean; message: string }>(`/reports/${id}`);
    },

    /**
     * Nhân bản báo cáo
     */
    duplicate: async (id: string): Promise<Report> => {
        return api.post<Report>(`/reports/${id}/duplicate`);
    },

    /**
     * Cập nhật trạng thái báo cáo
     */
    updateStatus: async (id: string, status: 'Draft' | 'Ready' | 'Sent'): Promise<{ success: boolean; status: string }> => {
        return api.patch<{ success: boolean; status: string }>(`/reports/${id}/status`, { status });
    },

    /**
     * Submit report for mentor/admin review
     */
    submitForReview: async (id: string): Promise<Report> => {
        return api.post<Report>(`/reports/${id}/submit`, {});
    },

    /**
     * Get feedback thread for a report (owner only)
     */
    getFeedback: async (id: string): Promise<{ feedback: ReportFeedbackItem[] }> => {
        return api.get<{ feedback: ReportFeedbackItem[] }>(`/reports/${id}/feedback`);
    },

    /**
     * Reply/add feedback message (owner only)
     */
    addFeedback: async (id: string, message: string): Promise<{ feedback: ReportFeedbackItem }> => {
        return api.post<{ feedback: ReportFeedbackItem }>(`/reports/${id}/feedback`, { message });
    },

    /**
     * Lấy danh sách templates
     */
    getTemplates: async (): Promise<ReportTemplate[]> => {
        return api.get<ReportTemplate[]>('/reports/templates/list');
    },

    /**
     * Auto-save báo cáo (debounced call từ editor)
     */
    autoSave: async (id: string, content: string): Promise<Report> => {
        return api.put<Report>(`/reports/${id}`, { content });
    }
};

export default reportService;
