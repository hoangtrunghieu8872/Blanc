import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Edit2, Trash2, Calendar, Users, Sparkles, MoreHorizontal, Eye, RefreshCw,
  AlertCircle, Search, Filter, MapPin, Trophy, Clock, Target, FileText, Building2,
  X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Image as ImageIcon, Star, MessageSquare,
  Globe, ExternalLink
} from 'lucide-react';
import { Contest, ContestPrize, ContestScheduleItem, OrganizerDetails } from '../types';
import { MOCK_CONTESTS } from '../constants';
import { generateContestDescription } from '../services/geminiService';
import { contestService, ContestFilters } from '../services/contestService';
import { useDebounce } from '../hooks/useApi';
import { Dropdown } from './ui/Dropdown';

// Category options for contests (grouped + expanded)
const CONTEST_CATEGORIES = [
  { value: '', label: 'Select category', color: 'bg-gray-400' },
  { value: 'it', label: 'IT & Tech (Hackathon, Coding, AI/ML)', color: 'bg-blue-600' },
  { value: 'data', label: 'Data & Analytics', color: 'bg-cyan-500' },
  { value: 'cyber', label: 'Cybersecurity', color: 'bg-slate-600' },
  { value: 'robotics', label: 'Robotics & IoT', color: 'bg-purple-500' },
  { value: 'design', label: 'Design / UI-UX', color: 'bg-pink-500' },
  { value: 'business', label: 'Business & Strategy', color: 'bg-amber-500' },
  { value: 'startup', label: 'Startup & Innovation', color: 'bg-emerald-600' },
  { value: 'marketing', label: 'Marketing & Growth', color: 'bg-rose-500' },
  { value: 'finance', label: 'Finance & Fintech', color: 'bg-indigo-500' },
  { value: 'health', label: 'Health & Biotech', color: 'bg-teal-600' },
  { value: 'education', label: 'Education & EdTech', color: 'bg-orange-400' },
  { value: 'sustainability', label: 'Sustainability & Environment', color: 'bg-lime-600' },
  { value: 'gaming', label: 'Gaming & Esports', color: 'bg-yellow-500' },
  { value: 'research', label: 'Research & Science', color: 'bg-sky-500' },
  { value: 'other', label: 'Other', color: 'bg-gray-500' },
];

// Location type options
const LOCATION_TYPES = [
  { value: 'online', label: 'Online', color: 'bg-blue-500' },
  { value: 'offline', label: 'Offline', color: 'bg-green-500' },
  { value: 'hybrid', label: 'Hybrid', color: 'bg-purple-500' },
];

// Collapsible Section Component
interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title, icon, children, defaultOpen = true, badge
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-lg">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2 font-medium text-gray-700">
          {icon}
          <span>{title}</span>
          {badge && (
            <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded-full">
              {badge}
            </span>
          )}
        </div>
        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {isOpen && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
};

const ContestManager: React.FC = () => {
  // State
  const [contests, setContests] = useState<Contest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [editingContest, setEditingContest] = useState<Contest | null>(null);
  const [viewingContest, setViewingContest] = useState<Contest | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'OPEN' | 'FULL' | 'CLOSED'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  // Basic Form State
  const [newTitle, setNewTitle] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newOrganizer, setNewOrganizer] = useState('');
  const [newFee, setNewFee] = useState(0);
  const [newDateStart, setNewDateStart] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [generatedDesc, setGeneratedDesc] = useState('');
  const [newImage, setNewImage] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newLocationType, setNewLocationType] = useState<'online' | 'offline' | 'hybrid'>('online');
  const [newMaxParticipants, setNewMaxParticipants] = useState<number>(0);

  // Content Form State
  const [newRules, setNewRules] = useState('');
  const [newObjectives, setNewObjectives] = useState('');
  const [newEligibility, setNewEligibility] = useState('');

  // Prizes Form State
  const [prizes, setPrizes] = useState<ContestPrize[]>([]);

  // Schedule Form State
  const [schedule, setSchedule] = useState<ContestScheduleItem[]>([]);

  // Organizer Details Form State
  const [organizerDetails, setOrganizerDetails] = useState<OrganizerDetails>({
    name: '',
    school: '',
    logo: '',
    description: '',
    contact: '',
    website: '',
  });

  // Debounce search
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Fetch contests
  const fetchContests = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const filters: ContestFilters = {
        search: debouncedSearch || undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined,
        page: pagination.page,
        limit: pagination.limit,
      };

      const response = await contestService.getAll(filters);
      setContests(response.items);
      setPagination(prev => ({
        ...prev,
        total: response.total,
        totalPages: response.totalPages,
      }));
    } catch (err) {
      console.error('Failed to fetch contests:', err);
      setError('Failed to load contests. Using cached data.');
      setContests(MOCK_CONTESTS);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, filterStatus, pagination.page, pagination.limit]);

  // Initial fetch
  useEffect(() => {
    fetchContests();
  }, [fetchContests]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest('.action-dropdown')) return;
      setOpenActionId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGenerateAI = async () => {
    if (!newTitle) return;
    setIsGenerating(true);
    const tagsArray = newTags.split(',').map(t => t.trim());
    const description = await generateContestDescription(newTitle, tagsArray);
    setGeneratedDesc(description);
    setIsGenerating(false);
  };

  const resetForm = () => {
    setNewTitle('');
    setNewTags('');
    setNewOrganizer('');
    setNewFee(0);
    setNewDateStart('');
    setNewEndDate('');
    setNewDeadline('');
    setGeneratedDesc('');
    setNewImage('');
    setNewCategory('');
    setNewLocation('');
    setNewLocationType('online');
    setNewMaxParticipants(0);
    setNewRules('');
    setNewObjectives('');
    setNewEligibility('');
    setPrizes([]);
    setSchedule([]);
    setOrganizerDetails({
      name: '',
      school: '',
      logo: '',
      description: '',
      contact: '',
      website: '',
    });
    setEditingContest(null);
  };

  const handleSaveContest = async () => {
    if (!newTitle || !newOrganizer) return;

    setIsSaving(true);
    try {
      // Sync organizerDetails.name with newOrganizer
      const syncedOrganizerDetails = {
        ...organizerDetails,
        name: organizerDetails.name || newOrganizer,
      };

      const contestData = {
        title: newTitle,
        organizer: newOrganizer,
        fee: newFee,
        // Backend field mapping
        dateStart: newDateStart,
        endDate: newEndDate || undefined,
        deadline: newDeadline,
        tags: newTags.split(',').map(t => t.trim()).filter(Boolean),
        description: generatedDesc,
        image: newImage || undefined,
        category: newCategory || undefined,
        location: newLocation || undefined,
        locationType: newLocationType,
        maxParticipants: newMaxParticipants || undefined,
        rules: newRules || undefined,
        objectives: newObjectives || undefined,
        eligibility: newEligibility || undefined,
        prizes: prizes.length > 0 ? prizes : undefined,
        schedule: schedule.length > 0 ? schedule : undefined,
        organizerDetails: syncedOrganizerDetails.name ? syncedOrganizerDetails : undefined,
      };

      if (editingContest) {
        const updated = await contestService.update(editingContest.id, contestData);
        setContests(contests.map(c => c.id === editingContest.id ? updated : c));
      } else {
        const created = await contestService.create(contestData);
        setContests([created, ...contests]);
      }
      setIsModalOpen(false);
      resetForm();
    } catch (err) {
      console.error('Failed to save contest:', err);
      alert('Failed to save contest. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusColor = (status: Contest['status']) => {
    switch (status) {
      case 'OPEN': return 'bg-emerald-100 text-emerald-800';
      case 'FULL': return 'bg-yellow-100 text-yellow-800';
      case 'CLOSED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAction = async (action: string, contest: Contest) => {
    setOpenActionId(null);

    try {
      switch (action) {
        case 'delete':
          if (window.confirm(`Are you sure you want to delete "${contest.title}"?`)) {
            await contestService.delete(contest.id);
            setContests(contests.filter(c => c.id !== contest.id));
          }
          break;
        case 'edit':
          setEditingContest(contest);
          setNewTitle(contest.title);
          setNewTags(contest.tags.join(', '));
          setNewOrganizer(contest.organizer);
          setNewFee(contest.fee);
          setNewDateStart(contest.dateStart?.split('T')[0] || '');
          // Handle endDate - fallback to deadline if not present
          setNewEndDate((contest as any).endDate?.split('T')[0] || '');
          setNewDeadline(contest.deadline?.split('T')[0] || '');
          setGeneratedDesc(contest.description || '');
          setNewImage(contest.image || '');
          setNewCategory(contest.category || '');
          setNewLocation(contest.location || '');
          setNewLocationType(contest.locationType || 'online');
          setNewMaxParticipants(contest.maxParticipants || 0);
          setNewRules(contest.rules || '');
          setNewObjectives(contest.objectives || '');
          setNewEligibility(contest.eligibility || '');
          setPrizes(contest.prizes || []);
          setSchedule(contest.schedule || []);
          // Sync organizerDetails.name with contest.organizer if empty
          setOrganizerDetails(contest.organizerDetails ? {
            ...contest.organizerDetails,
            name: contest.organizerDetails.name || contest.organizer,
          } : {
            name: contest.organizer,
            school: '',
            logo: '',
            description: '',
            contact: '',
            website: '',
          });
          setIsModalOpen(true);
          break;
        case 'view':
          setViewingContest(contest);
          setIsViewModalOpen(true);
          break;
      }
    } catch (err) {
      console.error(`Failed to ${action} contest:`, err);
      alert(`Failed to ${action} contest. Please try again.`);
    }
  };

  // Prize handlers
  const addPrize = () => {
    setPrizes([...prizes, { rank: prizes.length + 1, title: '', value: '', description: '' }]);
  };

  const updatePrize = (index: number, field: keyof ContestPrize, value: string | number) => {
    const updated = [...prizes];
    updated[index] = { ...updated[index], [field]: value };
    setPrizes(updated);
  };

  const removePrize = (index: number) => {
    setPrizes(prizes.filter((_, i) => i !== index));
  };

  // Schedule handlers
  const addScheduleItem = () => {
    setSchedule([...schedule, { date: '', title: '', description: '' }]);
  };

  const updateScheduleItem = (index: number, field: keyof ContestScheduleItem, value: string) => {
    const updated = [...schedule];
    updated[index] = { ...updated[index], [field]: value };
    setSchedule(updated);
  };

  const removeScheduleItem = (index: number) => {
    setSchedule(schedule.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Contests</h2>
          <p className="text-gray-500 mt-1">Manage competitions and events</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search contests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none w-48"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            title="Toggle filters"
            className={`p-2 border rounded-lg transition-colors ${showFilters ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-gray-300 hover:bg-gray-50 text-gray-600'}`}
          >
            <Filter size={18} />
          </button>
          <button
            onClick={() => fetchContests()}
            disabled={isLoading}
            title="Refresh"
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-50"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-sm"
          >
            <Plus size={18} />
            Create Contest
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap gap-4 animate-fade-in-up">
          <div className="min-w-40">
            <Dropdown
              label="Status"
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'OPEN', label: 'Open', color: 'bg-emerald-500' },
                { value: 'FULL', label: 'Full', color: 'bg-yellow-500' },
                { value: 'CLOSED', label: 'Closed', color: 'bg-gray-500' }
              ]}
              value={filterStatus}
              onChange={(val) => setFilterStatus(val as typeof filterStatus)}
              placeholder="Select status"
              size="sm"
            />
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="text-yellow-500" size={20} />
          <span className="text-yellow-700 text-sm">{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-900 uppercase font-semibold text-xs">
              <tr>
                <th className="px-6 py-4">Contest</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Participants</th>
                <th className="px-6 py-4">Deadline</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-gray-500">Loading contests...</p>
                  </td>
                </tr>
              ) : contests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No contests found matching your criteria.
                  </td>
                </tr>
              ) : contests.map((contest, index) => (
                <tr key={contest.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <img src={contest.image || 'https://via.placeholder.com/64x40'} alt="" className="h-10 w-16 object-cover rounded-md" />
                      <div>
                        <p className="font-semibold text-gray-900">{contest.title}</p>
                        <div className="flex gap-2 mt-1">
                          {contest.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{tag}</span>
                          ))}
                          {contest.tags.length > 3 && (
                            <span className="text-xs text-gray-400">+{contest.tags.length - 3}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(contest.status)}`}>
                      {contest.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-600 capitalize">{contest.category || '-'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <Users size={16} className="text-gray-400" />
                      <span>{contest.registrationCount ?? contest.participants ?? 0}</span>
                      {contest.maxParticipants && contest.maxParticipants > 0 && (
                        <span className="text-gray-400">/ {contest.maxParticipants}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={16} className="text-gray-400" />
                      <span>{new Date(contest.deadline).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="relative action-dropdown inline-block text-left">
                      <button
                        onClick={() => setOpenActionId(openActionId === contest.id ? null : contest.id)}
                        title="Contest actions"
                        className={`p-2 rounded-lg border transition-all duration-200 ${openActionId === contest.id
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-600 shadow-sm'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300'
                          }`}
                      >
                        <MoreHorizontal size={18} />
                      </button>

                      {openActionId === contest.id && (
                        <div className={`absolute right-0 w-52 bg-white rounded-xl shadow-2xl border border-gray-200 z-[100] animate-fade-in-up ${index < 2 ? 'top-full mt-2 origin-top-right' : 'bottom-full mb-2 origin-bottom-right'}`}>
                          <div className="py-1">
                            <button onClick={() => handleAction('view', contest)} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                              <Eye size={16} className="text-gray-400" />
                              <span>View Details</span>
                            </button>
                            <button onClick={() => handleAction('edit', contest)} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                              <Edit2 size={16} className="text-gray-400" />
                              <span>Edit Contest</span>
                            </button>
                            <div className="border-t border-gray-50 my-1"></div>
                            <button onClick={() => handleAction('delete', contest)} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                              <Trash2 size={16} />
                              <span>Delete Contest</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} contests
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                title="Previous page"
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                      className={`min-w-9 h-9 rounded-lg text-sm font-medium transition-colors ${pagination.page === pageNum
                        ? 'bg-emerald-500 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                title="Next page"
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-fade-in-up max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-semibold text-gray-900 text-lg">
                {editingContest ? 'Edit Contest' : 'Create New Contest'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} title="Close modal" className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Basic Information */}
              <CollapsibleSection title="Basic Information" icon={<FileText size={18} />} defaultOpen={true}>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="e.g., Summer Hackathon 2024"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <Dropdown
                      label="Category"
                      options={CONTEST_CATEGORIES}
                      value={newCategory}
                      onChange={setNewCategory}
                      placeholder="Select category"
                      headerText="Contest Category"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="e.g., AI, Web, Mobile"
                      value={newTags}
                      onChange={(e) => setNewTags(e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <ImageIcon size={14} className="inline mr-1" />
                      Image URL
                    </label>
                    <input
                      type="url"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="https://example.com/image.jpg"
                      value={newImage}
                      onChange={(e) => setNewImage(e.target.value)}
                    />
                    {newImage && (
                      <div className="mt-2">
                        <img src={newImage} alt="Preview" className="h-24 w-auto rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      </div>
                    )}
                  </div>
                </div>
              </CollapsibleSection>

              {/* Date & Location */}
              <CollapsibleSection title="Date & Location" icon={<MapPin size={18} />} defaultOpen={true}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      title="Contest start date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      value={newDateStart}
                      onChange={(e) => setNewDateStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      title="Contest end date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      value={newEndDate}
                      onChange={(e) => setNewEndDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Registration Deadline</label>
                    <input
                      type="date"
                      title="Registration deadline"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      value={newDeadline}
                      onChange={(e) => setNewDeadline(e.target.value)}
                    />
                  </div>
                  <div>
                    <Dropdown
                      label="Location Type"
                      options={LOCATION_TYPES}
                      value={newLocationType}
                      onChange={(val) => setNewLocationType(val as 'online' | 'offline' | 'hybrid')}
                      placeholder="Select location type"
                      headerText="Location Type"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location Details</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder={newLocationType === 'online' ? 'e.g., Zoom, Google Meet' : 'e.g., 268 Lý Thường Kiệt, Q.10'}
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Registration Fee (VND)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="0 = Free"
                      value={newFee}
                      onChange={(e) => setNewFee(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Participants</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="0 = Unlimited"
                      value={newMaxParticipants}
                      onChange={(e) => setNewMaxParticipants(Number(e.target.value))}
                    />
                  </div>
                </div>
              </CollapsibleSection>

              {/* Organizer */}
              <CollapsibleSection title="Organizer Details" icon={<Building2 size={18} />} defaultOpen={true}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Organizer Name *</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="e.g., TechGen Z Club"
                      value={newOrganizer}
                      onChange={(e) => setNewOrganizer(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">School/University</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="e.g., Học viện Bưu chính Viễn thông"
                      value={organizerDetails.school}
                      onChange={(e) => setOrganizerDetails({ ...organizerDetails, school: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                    <input
                      type="url"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="https://example.com/logo.png"
                      value={organizerDetails.logo}
                      onChange={(e) => setOrganizerDetails({ ...organizerDetails, logo: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <input
                      type="url"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="https://techgenz.com"
                      value={organizerDetails.website}
                      onChange={(e) => setOrganizerDetails({ ...organizerDetails, website: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="email@example.com or phone"
                      value={organizerDetails.contact}
                      onChange={(e) => setOrganizerDetails({ ...organizerDetails, contact: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Organizer Description</label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                      rows={2}
                      placeholder="Brief description about the organizer..."
                      value={organizerDetails.description}
                      onChange={(e) => setOrganizerDetails({ ...organizerDetails, description: e.target.value })}
                    />
                  </div>
                </div>
              </CollapsibleSection>

              {/* Content - Description, Objectives, Eligibility, Rules */}
              <CollapsibleSection title="Content" icon={<Target size={18} />} defaultOpen={false}>
                <div className="space-y-4">
                  {/* AI Description Generator */}
                  <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-semibold text-emerald-800">AI Description Generator</label>
                      <Sparkles size={16} className="text-emerald-600" />
                    </div>
                    <p className="text-xs text-emerald-700 mb-3">
                      Enter a title and tags above, then click generate to have Gemini AI write your contest description.
                    </p>
                    <button
                      onClick={handleGenerateAI}
                      disabled={isGenerating || !newTitle}
                      className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${isGenerating || !newTitle
                        ? 'bg-emerald-200 text-emerald-500 cursor-not-allowed'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                        }`}
                    >
                      {isGenerating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} />
                          Generate with Gemini
                        </>
                      )}
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                      rows={4}
                      placeholder="Contest description..."
                      value={generatedDesc}
                      onChange={(e) => setGeneratedDesc(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Objectives (Mục tiêu)</label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                      rows={3}
                      placeholder="Khơi dậy niềm đam mê sáng tạo và cung cấp sân chơi chuyên nghiệp cho các bạn trẻ..."
                      value={newObjectives}
                      onChange={(e) => setNewObjectives(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Eligibility (Đối tượng tham gia)</label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                      rows={3}
                      placeholder="• Sinh viên các trường đại học, cao đẳng.&#10;• Yêu thích thiết kế giao diện và trải nghiệm người dùng.&#10;• Có thể tham gia cá nhân hoặc đội nhóm (tối đa 3 người)."
                      value={newEligibility}
                      onChange={(e) => setNewEligibility(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rules (Thể lệ)</label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                      rows={5}
                      placeholder="1. Mỗi đội chỉ được nộp tối đa 1 bài dự thi.&#10;2. Bài thi phải là sản phẩm mới, chưa được công bố trước đây.&#10;3. Nghiêm cấm sao chép từ nguồn khác..."
                      value={newRules}
                      onChange={(e) => setNewRules(e.target.value)}
                    />
                  </div>
                </div>
              </CollapsibleSection>

              {/* Prizes */}
              <CollapsibleSection
                title="Prizes (Giải thưởng)"
                icon={<Trophy size={18} />}
                defaultOpen={false}
                badge={prizes.length > 0 ? `${prizes.length}` : undefined}
              >
                <div className="space-y-3">
                  {prizes.map((prize, index) => (
                    <div key={index} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                      <div className="w-16">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Rank</label>
                        <input
                          type="number"
                          min="1"
                          title="Prize rank"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          value={prize.rank}
                          onChange={(e) => updatePrize(index, 'rank', Number(e.target.value))}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                        <input
                          type="text"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          placeholder="e.g., Giải Nhất"
                          value={prize.title}
                          onChange={(e) => updatePrize(index, 'title', e.target.value)}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Value</label>
                        <input
                          type="text"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          placeholder="e.g., 10,000,000 VND"
                          value={prize.value}
                          onChange={(e) => updatePrize(index, 'value', e.target.value)}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                        <input
                          type="text"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          placeholder="Optional"
                          value={prize.description || ''}
                          onChange={(e) => updatePrize(index, 'description', e.target.value)}
                        />
                      </div>
                      <button
                        onClick={() => removePrize(index)}
                        className="mt-5 p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Remove prize"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addPrize}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    Add Prize
                  </button>
                </div>
              </CollapsibleSection>

              {/* Schedule */}
              <CollapsibleSection
                title="Schedule (Lịch trình)"
                icon={<Clock size={18} />}
                defaultOpen={false}
                badge={schedule.length > 0 ? `${schedule.length}` : undefined}
              >
                <div className="space-y-3">
                  {schedule.map((item, index) => (
                    <div key={index} className="flex gap-3 items-start p-3 bg-gray-50 rounded-lg">
                      <div className="w-36">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                        <input
                          type="date"
                          title="Schedule item date"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          value={item.date?.split('T')[0] || ''}
                          onChange={(e) => updateScheduleItem(index, 'date', e.target.value)}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                        <input
                          type="text"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          placeholder="e.g., Mở đăng ký"
                          value={item.title}
                          onChange={(e) => updateScheduleItem(index, 'title', e.target.value)}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                        <input
                          type="text"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          placeholder="Optional"
                          value={item.description || ''}
                          onChange={(e) => updateScheduleItem(index, 'description', e.target.value)}
                        />
                      </div>
                      <button
                        onClick={() => removeScheduleItem(index)}
                        className="mt-5 p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Remove item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addScheduleItem}
                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={16} />
                    Add Schedule Item
                  </button>
                </div>
              </CollapsibleSection>
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveContest}
                disabled={isSaving || !newTitle || !newOrganizer}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  editingContest ? 'Update Contest' : 'Create Contest'
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* View Contest Details Modal */}
      {isViewModalOpen && viewingContest && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsViewModalOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden animate-fade-in-up max-h-[90vh] flex flex-col">
            {/* Header with Image */}
            <div className="relative h-48 bg-gradient-to-r from-emerald-600 to-teal-600">
              {viewingContest.image && (
                <img
                  src={viewingContest.image}
                  alt={viewingContest.title}
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <button
                onClick={() => setIsViewModalOpen(false)}
                title="Close modal"
                className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors backdrop-blur-sm"
              >
                <X size={20} />
              </button>
              <div className="absolute bottom-4 left-6 right-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(viewingContest.status)}`}>
                    {viewingContest.status}
                  </span>
                  {viewingContest.category && (
                    <span className="bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize">
                      {viewingContest.category}
                    </span>
                  )}
                  {viewingContest.fee === 0 ? (
                    <span className="bg-green-500 text-white px-2.5 py-0.5 rounded-full text-xs font-medium">
                      Free
                    </span>
                  ) : (
                    <span className="bg-amber-500 text-white px-2.5 py-0.5 rounded-full text-xs font-medium">
                      ₫{viewingContest.fee.toLocaleString()}
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-white">{viewingContest.title}</h2>
                <p className="text-white/80 mt-1">by {viewingContest.organizer}</p>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <Users size={24} className="mx-auto text-emerald-600 mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{viewingContest.registrationCount ?? viewingContest.participants ?? 0}</p>
                  <p className="text-xs text-gray-500">
                    Participants{viewingContest.maxParticipants && viewingContest.maxParticipants > 0 ? ` / ${viewingContest.maxParticipants}` : ''}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <Calendar size={24} className="mx-auto text-blue-600 mb-2" />
                  <p className="text-lg font-bold text-gray-900">
                    {viewingContest.deadline ? new Date(viewingContest.deadline).toLocaleDateString('vi-VN') : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500">Deadline</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <MapPin size={24} className="mx-auto text-purple-600 mb-2" />
                  <p className="text-lg font-bold text-gray-900 capitalize">{viewingContest.locationType || 'Online'}</p>
                  <p className="text-xs text-gray-500">Location Type</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <Trophy size={24} className="mx-auto text-yellow-500 mb-2" />
                  <p className="text-lg font-bold text-gray-900">{viewingContest.prizes?.length || 0}</p>
                  <p className="text-xs text-gray-500">Prizes</p>
                </div>
              </div>

              {/* Tags */}
              {viewingContest.tags && viewingContest.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {viewingContest.tags.map((tag, index) => (
                    <span key={index} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Organizer Info */}
              {viewingContest.organizerDetails && (
                <div className="bg-emerald-50 rounded-lg p-4">
                  <h4 className="font-semibold text-emerald-900 mb-3 flex items-center gap-2">
                    <Building2 size={18} />
                    Organizer Details
                  </h4>
                  <div className="flex items-start gap-4">
                    {viewingContest.organizerDetails.logo && (
                      <img
                        src={viewingContest.organizerDetails.logo}
                        alt={viewingContest.organizerDetails.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1 space-y-2 text-sm">
                      <p><span className="font-medium text-emerald-800">Name:</span> {viewingContest.organizerDetails.name}</p>
                      {viewingContest.organizerDetails.school && (
                        <p><span className="font-medium text-emerald-800">School:</span> {viewingContest.organizerDetails.school}</p>
                      )}
                      {viewingContest.organizerDetails.contact && (
                        <p><span className="font-medium text-emerald-800">Contact:</span> {viewingContest.organizerDetails.contact}</p>
                      )}
                      {viewingContest.organizerDetails.website && (
                        <a
                          href={viewingContest.organizerDetails.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-700 hover:underline flex items-center gap-1"
                        >
                          <Globe size={14} />
                          {viewingContest.organizerDetails.website}
                          <ExternalLink size={12} />
                        </a>
                      )}
                      {viewingContest.organizerDetails.description && (
                        <p className="text-gray-600">{viewingContest.organizerDetails.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Schedule */}
              {viewingContest.dateStart && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                    <Calendar size={18} />
                    Schedule
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    {viewingContest.dateStart && (
                      <div>
                        <span className="text-blue-700">Start Date:</span>
                        <span className="ml-2 font-medium text-blue-900">
                          {new Date(viewingContest.dateStart).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    )}
                    {(viewingContest as any).endDate && (
                      <div>
                        <span className="text-blue-700">End Date:</span>
                        <span className="ml-2 font-medium text-blue-900">
                          {new Date((viewingContest as any).endDate).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    )}
                    {viewingContest.deadline && (
                      <div>
                        <span className="text-blue-700">Deadline:</span>
                        <span className="ml-2 font-medium text-blue-900">
                          {new Date(viewingContest.deadline).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Location */}
              {viewingContest.location && (
                <div className="bg-purple-50 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                    <MapPin size={18} />
                    Location
                  </h4>
                  <p className="text-purple-800">{viewingContest.location}</p>
                </div>
              )}

              {/* Description */}
              {viewingContest.description && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <FileText size={18} className="text-gray-600" />
                    Description
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                    {viewingContest.description}
                  </div>
                </div>
              )}

              {/* Objectives */}
              {viewingContest.objectives && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Target size={18} className="text-emerald-600" />
                    Objectives
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                    {viewingContest.objectives}
                  </div>
                </div>
              )}

              {/* Eligibility */}
              {viewingContest.eligibility && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Users size={18} className="text-blue-600" />
                    Eligibility
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                    {viewingContest.eligibility}
                  </div>
                </div>
              )}

              {/* Rules */}
              {viewingContest.rules && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <FileText size={18} className="text-orange-600" />
                    Rules
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">
                    {viewingContest.rules}
                  </div>
                </div>
              )}

              {/* Prizes */}
              {viewingContest.prizes && viewingContest.prizes.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Trophy size={18} className="text-yellow-500" />
                    Prizes ({viewingContest.prizes.length})
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {viewingContest.prizes.map((prize, index) => (
                      <div key={index} className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-lg p-4 border border-yellow-200">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-8 h-8 bg-yellow-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {prize.rank}
                          </span>
                          <span className="font-semibold text-gray-900">{prize.title}</span>
                        </div>
                        <p className="text-lg font-bold text-amber-600">{prize.value}</p>
                        {prize.description && (
                          <p className="text-sm text-gray-600 mt-1">{prize.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Schedule Items */}
              {viewingContest.schedule && viewingContest.schedule.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Clock size={18} className="text-blue-600" />
                    Timeline ({viewingContest.schedule.length} events)
                  </h4>
                  <div className="space-y-2">
                    {viewingContest.schedule.map((item, index) => (
                      <div key={index} className="flex items-start gap-3 bg-gray-50 rounded-lg p-3">
                        <div className="w-24 flex-shrink-0">
                          <p className="text-sm font-medium text-blue-600">
                            {item.date ? new Date(item.date).toLocaleDateString('vi-VN') : 'TBD'}
                          </p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{item.title}</p>
                          {item.description && (
                            <p className="text-sm text-gray-500">{item.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments/Reviews */}
              {viewingContest.comments && viewingContest.comments.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <MessageSquare size={18} className="text-purple-600" />
                    Comments ({viewingContest.comments.length})
                  </h4>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {viewingContest.comments.map((comment) => (
                      <div key={comment.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          {comment.userAvatar ? (
                            <img
                              src={comment.userAvatar}
                              alt={comment.userName}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                              <span className="text-purple-600 font-medium text-sm">
                                {comment.userName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-gray-900">{comment.userName}</p>
                              <span className="text-xs text-gray-400">
                                {new Date(comment.createdAt).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                            {comment.rating && (
                              <div className="flex items-center gap-0.5 mt-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    size={12}
                                    className={star <= comment.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                                  />
                                ))}
                              </div>
                            )}
                            <p className="text-sm text-gray-600 mt-2">{comment.content}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Comments State */}
              {(!viewingContest.comments || viewingContest.comments.length === 0) && (
                <div className="bg-gray-50 rounded-lg p-6 text-center">
                  <MessageSquare size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">No comments yet</p>
                </div>
              )}

              {/* Metadata */}
              <div className="text-xs text-gray-400 pt-4 border-t border-gray-100 flex flex-wrap gap-4">
                {viewingContest.createdAt && (
                  <span>Created: {new Date(viewingContest.createdAt).toLocaleDateString('vi-VN')}</span>
                )}
                {viewingContest.updatedAt && (
                  <span>Updated: {new Date(viewingContest.updatedAt).toLocaleDateString('vi-VN')}</span>
                )}
                <span>ID: {viewingContest.id}</span>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 bg-gray-50 flex justify-between items-center border-t border-gray-100">
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
              >
                Close
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsViewModalOpen(false);
                    handleAction('edit', viewingContest);
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium shadow-sm transition-colors flex items-center gap-2"
                >
                  <Edit2 size={16} />
                  Edit Contest
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ContestManager;
