import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Users,
  Clock,
  ChevronDown,
  MoreVertical,
  Eye,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  RotateCcw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Button, Card, Badge } from '../components/ui/Common';
import CreateTeamPostModal from '../components/CreateTeamPostModal';
import TeamPostDetailModal from '../components/TeamPostDetailModal';
import TeamMembersManager from '../components/TeamMembersManager';
import { api } from '../lib/api';
import { TeamPost } from '../types';

// Types
interface MyTeamPostsStats {
  totalPosts: number;
  openPosts: number;
  closedPosts: number;
  fullPosts: number;
  totalMembers: number;
}

interface MyTeamPostsResponse {
  posts: (TeamPost & { pendingRequests: number; isDeleted: boolean })[];
  stats: MyTeamPostsStats;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type StatusFilter = 'all' | 'open' | 'closed' | 'full';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-gray-50 text-gray-600 border-gray-200',
  full: 'bg-blue-50 text-blue-700 border-blue-200',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Đang tuyển',
  closed: 'Đã đóng',
  full: 'Đã đủ',
};

const MyTeamPosts: React.FC = () => {
  const navigate = useNavigate();

  // Check authentication
  const isLoggedIn = !!localStorage.getItem('auth_token');

  // State
  const [posts, setPosts] = useState<(TeamPost & { pendingRequests: number; isDeleted: boolean })[]>([]);
  const [stats, setStats] = useState<MyTeamPostsStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<TeamPost | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isMembersManagerOpen, setIsMembersManagerOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<TeamPost | null>(null);

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login');
    }
  }, [isLoggedIn, navigate]);

  // Fetch posts
  const fetchMyPosts = useCallback(async (page = 1) => {
    if (!isLoggedIn) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        sortBy: 'createdAt',
        sortOrder: 'desc',
        includeDeleted: showDeleted.toString()
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await api.get<MyTeamPostsResponse>(`/teams/my/posts?${params}`);
      setPosts(response.posts);
      setStats(response.stats);
      setPagination({
        page: response.pagination.page,
        totalPages: response.pagination.totalPages,
        total: response.pagination.total
      });
    } catch (err) {
      console.error('Failed to fetch my posts:', err);
      setError(err instanceof Error ? err.message : 'Không thể tải bài đăng');
    } finally {
      setIsLoading(false);
    }
  }, [isLoggedIn, statusFilter, showDeleted]);

  useEffect(() => {
    fetchMyPosts(1);
  }, [fetchMyPosts]);

  // Show toast notification
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // Toggle post status
  const handleToggleStatus = async (post: TeamPost & { isDeleted: boolean }) => {
    if (post.isDeleted) {
      showToast('error', 'Không thể thay đổi trạng thái bài đăng đã xóa');
      return;
    }

    const newStatus = post.status === 'open' ? 'closed' : 'open';
    setActionLoadingId(post.id);

    try {
      await api.patch(`/teams/${post.id}/status`, { status: newStatus });
      showToast('success', `Đã ${newStatus === 'open' ? 'mở' : 'đóng'} bài đăng`);
      fetchMyPosts(pagination.page);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Không thể thay đổi trạng thái');
    } finally {
      setActionLoadingId(null);
      setActionMenuOpenId(null);
    }
  };

  // Soft delete post
  const handleSoftDelete = async (post: TeamPost & { isDeleted: boolean }) => {
    if (post.isDeleted) return;

    if (!window.confirm('Bạn có chắc chắn muốn xóa bài đăng này? Bạn có thể khôi phục sau.')) {
      return;
    }

    setActionLoadingId(post.id);

    try {
      await api.delete(`/teams/${post.id}/soft`);
      showToast('success', 'Đã xóa bài đăng');
      fetchMyPosts(pagination.page);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Không thể xóa bài đăng');
    } finally {
      setActionLoadingId(null);
      setActionMenuOpenId(null);
    }
  };

  // Restore post
  const handleRestore = async (post: TeamPost & { isDeleted: boolean }) => {
    if (!post.isDeleted) return;

    setActionLoadingId(post.id);

    try {
      await api.patch(`/teams/${post.id}/restore`, {});
      showToast('success', 'Đã khôi phục bài đăng');
      fetchMyPosts(pagination.page);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Không thể khôi phục bài đăng');
    } finally {
      setActionLoadingId(null);
      setActionMenuOpenId(null);
    }
  };

  // Filter posts by search query
  const filteredPosts = posts.filter(post =>
    !searchQuery ||
    post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    post.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle post created/updated
  const handlePostCreated = () => {
    setIsCreateModalOpen(false);
    setEditingPost(null);
    fetchMyPosts(1);
    showToast('success', 'Bài đăng đã được tạo thành công');
  };

  // Render loading state
  if (isLoading && posts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className="text-gray-600">Đang tải bài đăng...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quản lý bài đăng tìm đội</h1>
            <p className="text-gray-600 mt-1">Quản lý các bài đăng tuyển thành viên của bạn</p>
          </div>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Tạo bài đăng mới
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <Card className="p-4 bg-white border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tổng bài đăng</p>
                  <p className="text-xl font-bold text-gray-900">{stats.totalPosts}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Đang mở</p>
                  <p className="text-xl font-bold text-green-600">{stats.openPosts}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Đã đóng</p>
                  <p className="text-xl font-bold text-gray-600">{stats.closedPosts}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Đã đủ</p>
                  <p className="text-xl font-bold text-blue-600">{stats.fullPosts}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Thành viên</p>
                  <p className="text-xl font-bold text-emerald-600">{stats.totalMembers}</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm bài đăng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Filter className="w-5 h-5 text-gray-500" />
                <span className="text-gray-700">
                  {statusFilter === 'all' ? 'Tất cả trạng thái' : STATUS_LABELS[statusFilter]}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>

              {isFilterOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                  {(['all', 'open', 'closed', 'full'] as StatusFilter[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        setStatusFilter(status);
                        setIsFilterOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${statusFilter === status ? 'bg-emerald-50 text-emerald-700' : 'text-gray-700'
                        }`}
                    >
                      {status === 'all' ? 'Tất cả trạng thái' : STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Show Deleted Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
              />
              <span className="text-gray-700 text-sm">Hiển thị đã xóa</span>
            </label>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => fetchMyPosts(1)}
              className="ml-auto text-red-700 hover:text-red-800 font-medium"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredPosts.length === 0 && (
          <Card className="p-12 text-center bg-white border border-gray-200">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery || statusFilter !== 'all'
                ? 'Không tìm thấy bài đăng phù hợp'
                : 'Bạn chưa có bài đăng nào'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery || statusFilter !== 'all'
                ? 'Thử thay đổi bộ lọc để xem thêm kết quả'
                : 'Tạo bài đăng đầu tiên để tìm kiếm đồng đội!'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="w-5 h-5 mr-2" />
                Tạo bài đăng
              </Button>
            )}
          </Card>
        )}

        {/* Posts List */}
        {filteredPosts.length > 0 && (
          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <Card
                key={post.id}
                className={`p-6 bg-white border ${post.isDeleted ? 'border-red-200 bg-red-50/50' : 'border-gray-200'
                  } hover:shadow-md transition-all`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Post Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className={`text-lg font-semibold ${post.isDeleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                        {post.title}
                      </h3>
                      <Badge className={`${STATUS_COLORS[post.status]} border`}>
                        {STATUS_LABELS[post.status]}
                      </Badge>
                      {post.isDeleted && (
                        <Badge className="bg-red-100 text-red-700 border-red-200">
                          Đã xóa
                        </Badge>
                      )}
                      {post.pendingRequests > 0 && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                          {post.pendingRequests} yêu cầu
                        </Badge>
                      )}
                    </div>

                    <p className={`text-sm ${post.isDeleted ? 'text-gray-400' : 'text-gray-600'} line-clamp-2 mb-3`}>
                      {post.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-4 h-4" />
                        {post.currentMembers || 1}/{post.maxMembers} thành viên
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        {new Date(post.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                      {post.contestTitle && (
                        <span className="text-emerald-600 font-medium">
                          📌 {post.contestTitle}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {/* Quick Actions */}
                    <button
                      onClick={() => {
                        setSelectedPost(post);
                        setIsDetailModalOpen(true);
                      }}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Xem chi tiết"
                    >
                      <Eye className="w-5 h-5" />
                    </button>

                    {!post.isDeleted && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedPost(post);
                            setIsMembersManagerOpen(true);
                          }}
                          className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Quản lý thành viên"
                        >
                          <Users className="w-5 h-5" />
                        </button>

                        <button
                          onClick={() => {
                            setEditingPost(post);
                            setIsCreateModalOpen(true);
                          }}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Chỉnh sửa"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                      </>
                    )}

                    {/* More Actions Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setActionMenuOpenId(actionMenuOpenId === post.id ? null : post.id)}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={actionLoadingId === post.id}
                      >
                        {actionLoadingId === post.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <MoreVertical className="w-5 h-5" />
                        )}
                      </button>

                      {actionMenuOpenId === post.id && (
                        <div className="absolute right-0 mt-2 w-52 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                          {!post.isDeleted && (
                            <>
                              <button
                                onClick={() => handleToggleStatus(post)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 first:rounded-t-lg"
                              >
                                {post.status === 'open' ? (
                                  <>
                                    <ToggleLeft className="w-5 h-5 text-gray-500" />
                                    <span>Đóng bài đăng</span>
                                  </>
                                ) : (
                                  <>
                                    <ToggleRight className="w-5 h-5 text-green-500" />
                                    <span>Mở lại bài đăng</span>
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleSoftDelete(post)}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-red-50 text-red-600 last:rounded-b-lg"
                              >
                                <Trash2 className="w-5 h-5" />
                                <span>Xóa bài đăng</span>
                              </button>
                            </>
                          )}

                          {post.isDeleted && (
                            <button
                              onClick={() => handleRestore(post)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-green-50 text-green-600 rounded-lg"
                            >
                              <RotateCcw className="w-5 h-5" />
                              <span>Khôi phục bài đăng</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => fetchMyPosts(pagination.page - 1)}
              disabled={pagination.page === 1 || isLoading}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Trước
            </button>
            <span className="text-gray-600">
              Trang {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => fetchMyPosts(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages || isLoading}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Tiếp
            </button>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          } text-white`}>
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Modals */}
      {isCreateModalOpen && (
        <CreateTeamPostModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingPost(null);
          }}
          onSuccess={handlePostCreated}
          editingPost={editingPost}
        />
      )}

      {selectedPost && isDetailModalOpen && (
        <TeamPostDetailModal
          post={selectedPost}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedPost(null);
          }}
        />
      )}

      {selectedPost && isMembersManagerOpen && (
        <TeamMembersManager
          post={selectedPost}
          isOpen={isMembersManagerOpen}
          onClose={() => {
            setIsMembersManagerOpen(false);
            setSelectedPost(null);
            fetchMyPosts(pagination.page);
          }}
        />
      )}

      {/* Click outside to close action menu */}
      {actionMenuOpenId && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setActionMenuOpenId(null)}
        />
      )}
    </div>
  );
};

export default MyTeamPosts;
