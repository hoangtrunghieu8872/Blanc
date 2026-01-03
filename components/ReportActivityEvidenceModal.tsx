import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Loader2, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { Report, ReportActivity, ReportEvidence } from '../types';
import reportService from '../services/reportService';

const ALLOWED_EVIDENCE_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const MAX_EVIDENCE_BYTES = 20 * 1024 * 1024;

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('vi-VN');
}

function formatDateTimeInput(value?: string | null) {
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

function generateId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function evidenceLabel(item: ReportEvidence) {
  if (item.mimeType === 'application/pdf') return 'PDF';
  if (item.mimeType.startsWith('image/')) return 'Image';
  return item.mimeType || 'File';
}

export interface ReportActivityEvidenceModalProps {
  isOpen: boolean;
  report: Report | null;
  onClose: () => void;
}

export const ReportActivityEvidenceModal: React.FC<ReportActivityEvidenceModalProps> = ({
  isOpen,
  report,
  onClose,
}) => {
  const reportId = report?.id || null;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [activities, setActivities] = useState<ReportActivity[]>([]);
  const [evidence, setEvidence] = useState<ReportEvidence[]>([]);

  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [activityTitle, setActivityTitle] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [activityOccurredAt, setActivityOccurredAt] = useState(formatDateTimeInput());

  const sortedActivities = useMemo(() => {
    return [...activities].sort((a, b) => {
      const aTime = a.occurredAt ? new Date(a.occurredAt).getTime() : 0;
      const bTime = b.occurredAt ? new Date(b.occurredAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [activities]);

  const sortedEvidence = useMemo(() => {
    return [...evidence].sort((a, b) => {
      const aTime = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
      const bTime = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [evidence]);

  const resetActivityForm = () => {
    setEditingActivityId(null);
    setActivityTitle('');
    setActivityDescription('');
    setActivityOccurredAt(formatDateTimeInput());
  };

  const load = async () => {
    if (!reportId) return;
    setIsLoading(true);
    try {
      const full = await reportService.getById(reportId);
      setActivities(full.activities || []);
      setEvidence(full.evidence || []);
    } catch (err) {
      console.error('Error loading report meta:', err);
      toast.error('Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    resetActivityForm();
    void load();
  }, [isOpen, reportId]);

  if (!isOpen) return null;

  const saveActivities = async (next: ReportActivity[]) => {
    if (!reportId) return;
    setIsSaving(true);
    try {
      const updated = await reportService.update(reportId, { activities: next });
      setActivities(updated.activities || []);
      toast.success('Activities saved');
    } catch (err) {
      console.error('Error saving activities:', err);
      toast.error('Failed to save activities');
    } finally {
      setIsSaving(false);
    }
  };

  const saveEvidence = async (next: ReportEvidence[]) => {
    if (!reportId) return;
    setIsSaving(true);
    try {
      const updated = await reportService.update(reportId, { evidence: next });
      setEvidence(updated.evidence || []);
      toast.success('Evidence saved');
    } catch (err) {
      console.error('Error saving evidence:', err);
      toast.error('Failed to save evidence');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitActivity = async () => {
    const title = activityTitle.trim();
    if (!title) {
      toast.error('Activity title is required');
      return;
    }

    const occurredAtIso = activityOccurredAt ? new Date(activityOccurredAt).toISOString() : null;
    if (activityOccurredAt && Number.isNaN(new Date(activityOccurredAt).getTime())) {
      toast.error('Invalid activity date');
      return;
    }

    const nextActivity: ReportActivity = {
      id: editingActivityId || generateId(),
      title,
      description: activityDescription.trim() || null,
      occurredAt: occurredAtIso,
    };

    const next = editingActivityId
      ? activities.map((a) => (a.id === editingActivityId ? nextActivity : a))
      : [...activities, nextActivity];

    await saveActivities(next);
    resetActivityForm();
  };

  const handleEditActivity = (activity: ReportActivity) => {
    setEditingActivityId(activity.id);
    setActivityTitle(activity.title || '');
    setActivityDescription(activity.description || '');
    setActivityOccurredAt(formatDateTimeInput(activity.occurredAt || null));
  };

  const handleDeleteActivity = async (activityId: string) => {
    const next = activities.filter((a) => a.id !== activityId);
    await saveActivities(next);
  };

  const uploadEvidenceFiles = async (files: File[]) => {
    if (!reportId) return;
    if (files.length === 0) return;

    const invalidType = files.find((f) => !ALLOWED_EVIDENCE_MIME_TYPES.has(f.type));
    if (invalidType) {
      toast.error('Only images and PDF files are allowed');
      return;
    }

    const tooBig = files.find((f) => f.size > MAX_EVIDENCE_BYTES);
    if (tooBig) {
      toast.error('Each file must be 20MB or smaller');
      return;
    }

    setIsSaving(true);
    try {
      const uploaded: ReportEvidence[] = [];
      for (const file of files) {
        const presignData = await api.post<{
          uploadUrl: string;
          fileName: string;
          folder: string;
          mimeType: string;
          nonce: string;
          timestamp: number;
          signature: string;
        }>('/media/presign', { mimeType: file.type, folder: 'report-evidence' });

        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileName', presignData.fileName);
        formData.append('folder', presignData.folder);
        formData.append('mimeType', presignData.mimeType);
        formData.append('nonce', presignData.nonce);
        formData.append('timestamp', String(presignData.timestamp));
        formData.append('signature', presignData.signature);

        const uploadResponse = await fetch(presignData.uploadUrl, {
          method: 'POST',
          body: formData,
        });

        const uploadResult = await uploadResponse.json().catch(() => null);
        const driveFileId = uploadResult?.result?.id;
        if (uploadResult?.status !== 200 || !driveFileId) {
          throw new Error(uploadResult?.result?.error || 'Upload failed');
        }

        uploaded.push({
          id: generateId(),
          fileId: String(driveFileId),
          fileName: file.name,
          mimeType: file.type,
          url: '',
          uploadedAt: new Date().toISOString(),
        });
      }

      await saveEvidence([...evidence, ...uploaded]);
    } catch (err) {
      console.error('Evidence upload error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to upload evidence');
    } finally {
      setIsSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleEvidenceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await uploadEvidenceFiles(files);
  };

  const handleDeleteEvidence = async (evidenceId: string) => {
    const next = evidence.filter((ev) => ev.id !== evidenceId);
    await saveEvidence(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white w-full max-w-5xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900 truncate">Activities & Evidence</h2>
            <p className="text-xs text-slate-500 truncate">{report?.title || ''}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-10 flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            <div className="p-6 border-b lg:border-b-0 lg:border-r border-slate-100 overflow-y-auto max-h-[78vh]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">Activities</h3>
                <button
                  onClick={resetActivityForm}
                  className="text-sm text-slate-600 hover:text-slate-900"
                  disabled={isSaving}
                >
                  Clear
                </button>
              </div>

              <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className="grid grid-cols-1 gap-3">
                  <input
                    value={activityTitle}
                    onChange={(e) => setActivityTitle(e.target.value)}
                    placeholder="Activity title"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-400 outline-none"
                    disabled={isSaving}
                  />
                  <input
                    type="datetime-local"
                    value={activityOccurredAt}
                    onChange={(e) => setActivityOccurredAt(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-400 outline-none"
                    disabled={isSaving}
                  />
                  <textarea
                    value={activityDescription}
                    onChange={(e) => setActivityDescription(e.target.value)}
                    placeholder="Description (optional)"
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-400 outline-none resize-none"
                    disabled={isSaving}
                  />
                </div>

                <button
                  onClick={handleSubmitActivity}
                  disabled={isSaving || !activityTitle.trim()}
                  className="w-full px-4 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {editingActivityId ? 'Update activity' : 'Add activity'}
                </button>
              </div>

              <div className="mt-6">
                {sortedActivities.length === 0 ? (
                  <div className="text-sm text-slate-500 py-8 text-center border border-dashed border-slate-200 rounded-2xl">
                    No activities yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortedActivities.map((a) => (
                      <div key={a.id} className="border border-slate-200 rounded-2xl p-4 bg-white">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">{a.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{formatDateTime(a.occurredAt)}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEditActivity(a)}
                              className="p-2 rounded-lg hover:bg-slate-50 text-slate-500"
                              title="Edit"
                              disabled={isSaving}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteActivity(a.id)}
                              className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                              title="Delete"
                              disabled={isSaving}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {a.description ? (
                          <p className="text-sm text-slate-700 whitespace-pre-wrap mt-3">{a.description}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[78vh]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">Evidence</h3>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleEvidenceFileChange}
                    disabled={isSaving}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSaving}
                    className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:bg-slate-300 flex items-center gap-2"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Upload
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-4">
                Allowed: images and PDF. The platform does not validate user-submitted evidence content.
              </p>

              {sortedEvidence.length === 0 ? (
                <div className="text-sm text-slate-500 py-8 text-center border border-dashed border-slate-200 rounded-2xl">
                  No evidence yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {sortedEvidence.map((ev) => (
                    <div key={ev.id} className="border border-slate-200 rounded-2xl bg-white overflow-hidden">
                      <div className="p-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{ev.fileName}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {evidenceLabel(ev)} - {formatDateTime(ev.uploadedAt)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteEvidence(ev.id)}
                          className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                          title="Delete"
                          disabled={isSaving}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {ev.mimeType.startsWith('image/') && ev.url ? (
                        <a href={ev.url} target="_blank" rel="noreferrer" className="block">
                          <img
                            src={ev.url}
                            alt={ev.fileName}
                            className="w-full h-44 object-cover bg-slate-50 border-t border-slate-100"
                            loading="lazy"
                          />
                        </a>
                      ) : (
                        <div className="border-t border-slate-100 p-4 flex items-center justify-between gap-3 bg-slate-50">
                          <div className="flex items-center gap-2 text-slate-600">
                            <FileText className="w-4 h-4" />
                            <span className="text-sm">Open file</span>
                          </div>
                          {ev.url ? (
                            <a
                              href={ev.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-medium text-primary-600 hover:text-primary-800"
                            >
                              View
                            </a>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {isSaving ? 'Saving...' : ''}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
            disabled={isSaving}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportActivityEvidenceModal;
