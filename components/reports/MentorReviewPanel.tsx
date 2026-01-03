import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, ChevronRight, Loader2, Pencil, RefreshCcw, Search, Send, ShieldCheck } from 'lucide-react';

import { Button, Card, Dropdown } from '../ui/Common';
import reviewReportService, { ReviewReportDetailResponse, ReviewReportSummary, ReviewStatus } from '../../services/reviewReportService';
import { ReportFeedbackItem } from '../../services/reportService';
import { formatDateTime, reviewStatusBadgeClass, reviewStatusLabel } from './reportUtils';

const MentorReviewPanel: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'all'>('submitted');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ReviewReportSummary[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<ReviewReportDetailResponse | null>(null);

  const [message, setMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await reviewReportService.list({ status: statusFilter, search: search || undefined, limit: 50, skip: 0 });
      setItems(data.items || []);
    } catch (err) {
      console.error('Failed to load review queue:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể tải danh sách review');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const data = await reviewReportService.getById(id);
      setSelectedId(id);
      setDetail(data);
      setMessage('');
    } catch (err) {
      console.error('Failed to load review detail:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể tải chi tiết report');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [statusFilter]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => `${i.title} ${i.user?.name || ''} ${i.user?.email || ''}`.toLowerCase().includes(q));
  }, [items, search]);

  const sendFeedback = async () => {
    if (!selectedId) return;
    const text = message.trim();
    if (!text) return;

    setActionLoading(true);
    try {
      await reviewReportService.addFeedback(selectedId, text);
      const refreshed = await reviewReportService.getById(selectedId);
      setDetail(refreshed);
      setMessage('');
      toast.success('Đã gửi feedback');
    } catch (err) {
      console.error('Failed to send feedback:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể gửi feedback');
    } finally {
      setActionLoading(false);
    }
  };

  const setReviewStatus = async (next: Extract<ReviewStatus, 'needs_changes' | 'approved' | 'submitted'>) => {
    if (!selectedId) return;
    setActionLoading(true);
    try {
      await reviewReportService.updateStatus(selectedId, next);
      const refreshed = await reviewReportService.getById(selectedId);
      setDetail(refreshed);
      await refresh();
      toast.success('Đã cập nhật trạng thái');
    } catch (err) {
      console.error('Failed to update review status:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <Card className="lg:col-span-4 p-4">
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tiêu đề / user..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </div>

          <Dropdown
            label="Lọc trạng thái"
            headerText="Trạng thái"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as ReviewStatus | 'all')}
            options={[
              { value: 'submitted', label: 'Submitted' },
              { value: 'needs_changes', label: 'Needs changes' },
              { value: 'approved', label: 'Approved' },
              { value: 'draft', label: 'Draft' },
              { value: 'all', label: 'All' },
            ]}
          />

          <Button variant="secondary" onClick={() => void refresh()} disabled={loading} className="gap-2 w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            Làm mới
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="py-10 flex items-center justify-center text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Đang tải...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-sm">Không có report nào phù hợp.</div>
          ) : (
            filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => void openDetail(item.id)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  selectedId === item.id ? 'bg-primary-50 border-primary-200' : 'bg-white border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {item.user?.name || 'Unknown'} • {formatDateTime(item.submittedAt)}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full border ${reviewStatusBadgeClass(item.reviewStatus)}`}>
                    {reviewStatusLabel(item.reviewStatus)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </Card>

      <Card className="lg:col-span-8 p-4">
        {!selectedId ? (
          <div className="py-16 text-center text-slate-500">
            <ShieldCheck className="w-10 h-10 mx-auto opacity-20" />
            <p className="mt-3 font-medium">Chọn một report để review</p>
          </div>
        ) : detailLoading ? (
          <div className="py-16 flex items-center justify-center text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Đang tải chi tiết...
          </div>
        ) : !detail?.report ? (
          <div className="py-16 text-center text-slate-500">Không thể tải report.</div>
        ) : (
          <MentorReviewDetail
            report={detail.report}
            feedback={detail.feedback || []}
            actionLoading={actionLoading}
            message={message}
            onMessageChange={setMessage}
            onSend={sendFeedback}
            onApprove={() => void setReviewStatus('approved')}
            onNeedsChanges={() => void setReviewStatus('needs_changes')}
          />
        )}
      </Card>
    </div>
  );
};

const MentorReviewDetail: React.FC<{
  report: ReviewReportDetailResponse['report'];
  feedback: ReportFeedbackItem[];
  actionLoading: boolean;
  message: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  onNeedsChanges: () => void;
  onApprove: () => void;
}> = ({ report, feedback, actionLoading, message, onMessageChange, onSend, onNeedsChanges, onApprove }) => {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">Người gửi</p>
          <p className="font-semibold text-slate-900 truncate">{report.user?.name || 'Unknown'}</p>
          <p className="text-xs text-slate-500 truncate">{report.user?.email || ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onNeedsChanges} disabled={actionLoading} className="gap-2">
            <Pencil className="w-4 h-4" />
            Needs changes
          </Button>
          <Button size="sm" onClick={onApprove} disabled={actionLoading} className="gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Approve
          </Button>
        </div>
      </div>

      <Card className="p-4 border-slate-100">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">{report.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Template: {report.template} • Status: {report.status} • Review: {reviewStatusLabel(report.reviewStatus)}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-300" />
        </div>
        <div className="mt-4">
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{report.content || '-'}</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 border-slate-100">
          <p className="font-semibold text-slate-900">Thành tích</p>
          <div className="mt-3 space-y-2">
            {(report.activities || []).length === 0 ? (
              <p className="text-sm text-slate-500">-</p>
            ) : (
              report.activities.map((a) => (
                <div key={a.id} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                  <p className="font-medium text-slate-900">{a.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{formatDateTime(a.occurredAt)}</p>
                  {a.description && <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{a.description}</p>}
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4 border-slate-100">
          <p className="font-semibold text-slate-900">Minh chứng</p>
          <div className="mt-3 space-y-2">
            {(report.evidence || []).length === 0 ? (
              <p className="text-sm text-slate-500">-</p>
            ) : (
              report.evidence.map((ev) => (
                <div key={ev.id} className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{ev.fileName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatDateTime(ev.uploadedAt)}</p>
                  </div>
                  <a
                    href={ev.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className={`text-sm font-medium ${ev.url ? 'text-primary-700 hover:text-primary-900' : 'text-slate-400 pointer-events-none'}`}
                  >
                    Mở
                  </a>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card className="p-4 border-slate-100">
        <p className="font-semibold text-slate-900">Feedback</p>
        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
          {feedback.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có feedback.</p>
          ) : (
            feedback.map((item) => (
              <div key={item.id} className="border border-slate-100 rounded-xl p-3 bg-slate-50">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-700 truncate">{item.authorName ? item.authorName : item.authorRole}</p>
                  <p className="text-xs text-slate-400">{formatDateTime(item.createdAt || null)}</p>
                </div>
                <p className="text-sm text-slate-800 mt-2 whitespace-pre-wrap">{item.message}</p>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex items-end gap-2">
          <div className="w-full">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Gửi feedback</label>
            <textarea
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
              placeholder="Nhận xét, góp ý, yêu cầu chỉnh sửa..."
              disabled={actionLoading}
            />
          </div>
          <Button onClick={onSend} disabled={actionLoading || !message.trim()} className="gap-2">
            {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Gửi
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default MentorReviewPanel;
