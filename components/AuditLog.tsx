import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { AuditLogEntry } from '../types';
import { analyzeAuditLogs } from '../services/geminiService';
import { api } from '../lib/api';

interface AuditLogsResponse {
  success: boolean;
  logs: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const AuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to first page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch audit logs
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (debouncedSearch) {
        params.append('search', debouncedSearch);
      }

      const response = await api.get<AuditLogsResponse>(`/admin/audit-logs?${params}`);

      if (response.success) {
        setLogs(response.logs);
        setTotalPages(response.pagination.totalPages);
        setTotal(response.pagination.total);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setError(err instanceof Error ? err.message : 'Không thể tải audit logs');
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleAnalyze = async () => {
    if (logs.length === 0) {
      setAiAnalysis('Không có log nào để phân tích.');
      return;
    }
    setIsAnalyzing(true);
    const analysis = await analyzeAuditLogs(logs);
    setAiAnalysis(analysis);
    setIsAnalyzing(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Success': return <CheckCircle size={16} className="text-green-500" />;
      case 'Failed': return <XCircle size={16} className="text-red-500" />;
      case 'Warning': return <AlertTriangle size={16} className="text-orange-500" />;
      default: return <FileText size={16} className="text-gray-400" />;
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Success': return 'bg-green-50 text-green-700 border-green-100';
      case 'Failed': return 'bg-red-50 text-red-700 border-red-100';
      case 'Warning': return 'bg-orange-50 text-orange-700 border-orange-100';
      default: return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Audit Logs</h2>
          <p className="text-gray-500 mt-1">Track system activities and security events</p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-sm"
        >
          {isAnalyzing ? <RefreshCw size={18} className="animate-spin" /> : <Sparkles size={18} />}
          AI Security Insight
        </button>
      </div>

      {/* AI Analysis Panel */}
      {aiAnalysis && (
        <div className="bg-linear-to-r from-slate-800 to-slate-900 text-white rounded-xl p-6 shadow-md border-l-4 border-emerald-500 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="text-emerald-400" />
            <h3 className="font-bold text-lg">Gemini Security Analysis</h3>
          </div>
          <div className="text-slate-200 text-sm leading-relaxed whitespace-pre-line">
            {aiAnalysis}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-gray-200 w-full max-w-md">
        <Search size={20} className="text-gray-400 ml-2" />
        <input
          type="text"
          placeholder="Search by action, user, or details..."
          className="flex-1 outline-none text-sm text-gray-700 p-1"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button title="Lọc" className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-500">
          <Filter size={18} />
        </button>
        <button
          title="Làm mới"
          onClick={fetchLogs}
          disabled={isLoading}
          className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-500"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-900 uppercase font-semibold text-xs">
              <tr>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Action / Target</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">IP Address</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto" />
                    <p className="text-gray-500 mt-2">Đang tải audit logs...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    {debouncedSearch ? 'Không tìm thấy log phù hợp.' : 'Chưa có audit log nào.'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusStyle(log.status)}`}>
                        {getStatusIcon(log.status)}
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{log.action}</div>
                      <div className="text-xs text-gray-500">{log.target}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                        {log.user}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">
                      {log.ip}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">
                      {new Date(log.timestamp).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 max-w-xs truncate text-gray-600" title={log.details}>
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {total > 0 ? `Hiển thị ${(page - 1) * limit + 1}-${Math.min(page * limit, total)} trong ${total} logs` : 'Không có log'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="p-2 border border-gray-300 rounded bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Trang trước"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-gray-600 px-2">
              {page} / {totalPages || 1}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="p-2 border border-gray-300 rounded bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Trang sau"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLog;