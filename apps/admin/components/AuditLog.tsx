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
import { analyzeAuditLogs } from '../services/geminiService';
import { auditLogService, AUDIT_ACTIONS } from '../services/auditLogService';
import { AuditLogEntry } from '../types';
import { Dropdown } from './ui/Dropdown';

const AuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await auditLogService.getAll({
        page,
        limit,
        search: searchTerm || undefined,
        status: statusFilter as any || undefined,
        action: actionFilter || undefined,
      });
      setLogs(result.items);
      setTotalPages(result.totalPages);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchTerm, statusFilter, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleAnalyze = async () => {
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
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl p-6 shadow-md border-l-4 border-emerald-500 animate-fade-in-up">
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
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex-1 min-w-[300px] max-w-md">
          <Search size={20} className="text-gray-400 ml-2" />
          <input
            type="text"
            placeholder="Search by action, user, or details..."
            className="flex-1 outline-none text-sm text-gray-700 p-1"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            title="Toggle filters"
            className={`p-1.5 rounded-lg ${showFilters ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-gray-50 text-gray-500'}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} />
          </button>
        </div>
        <button
          onClick={fetchLogs}
          className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600"
          title="Refresh"
        >
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="min-w-[150px]">
            <Dropdown
              options={[
                { value: '', label: 'All Status' },
                { value: 'Success', label: 'Success', color: 'bg-green-500' },
                { value: 'Failed', label: 'Failed', color: 'bg-red-500' },
                { value: 'Warning', label: 'Warning', color: 'bg-orange-500' }
              ]}
              value={statusFilter}
              onChange={(val) => { setStatusFilter(val); setPage(1); }}
              placeholder="All Status"
              size="sm"
            />
          </div>
          <div className="min-w-[180px]">
            <Dropdown
              options={[
                { value: '', label: 'All Actions' },
                ...Object.values(AUDIT_ACTIONS).map(action => ({ value: action, label: action }))
              ]}
              value={actionFilter}
              onChange={(val) => { setActionFilter(val); setPage(1); }}
              placeholder="All Actions"
              size="sm"
            />
          </div>
          <button
            onClick={() => { setStatusFilter(''); setActionFilter(''); setSearchTerm(''); setPage(1); }}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Clear filters
          </button>
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
                    <Loader2 className="animate-spin inline-block text-emerald-600 mb-2" size={24} />
                    <p className="text-gray-400">Loading audit logs...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    No logs found matching your criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  // Helper to safely render any value as string
                  const safeStr = (val: unknown): string => {
                    if (val === null || val === undefined) return '';
                    if (typeof val === 'object') return JSON.stringify(val);
                    return String(val);
                  };

                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusStyle(log.status)}`}>
                          {getStatusIcon(log.status)}
                          {log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{safeStr(log.action)}</div>
                        <div className="text-xs text-gray-500">{safeStr(log.target)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                          {safeStr(log.user)}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">
                        {safeStr(log.ip)}
                      </td>
                      <td className="px-6 py-4 text-gray-500 text-xs">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 max-w-xs truncate text-gray-600" title={safeStr(log.details)}>
                        {safeStr(log.details)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {isLoading ? 'Loading...' : `Showing ${logs.length} of ${total} entries`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="p-2 border border-gray-300 rounded bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-gray-600 px-2">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="p-2 border border-gray-300 rounded bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next page"
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