import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Trophy, Users, BarChart, GraduationCap, FileText, Target, CheckCircle, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { ReportTemplate } from '../types';

// Templates phù hợp với ContestHub
const allTemplates: ReportTemplate[] = [
    // Cuộc thi
    { id: '1', title: 'Tổng kết cuộc thi', description: 'Ghi nhận kết quả, bài học kinh nghiệm và những điểm cần cải thiện từ cuộc thi.', category: 'Cuộc thi', icon: 'Trophy' },
    { id: '2', title: 'Đề xuất ý tưởng', description: 'Trình bày ý tưởng dự thi với cấu trúc rõ ràng và thuyết phục.', category: 'Cuộc thi', icon: 'Target' },
    { id: '3', title: 'Báo cáo tiến độ dự án', description: 'Cập nhật tiến độ thực hiện dự án thi đấu theo từng giai đoạn.', category: 'Cuộc thi', icon: 'CheckCircle' },

    // Nhóm
    { id: '4', title: 'Báo cáo nhóm tuần', description: 'Tổng hợp hoạt động và đóng góp của các thành viên trong tuần.', category: 'Nhóm', icon: 'Users' },
    { id: '5', title: 'Đánh giá thành viên', description: 'Nhận xét và phản hồi về hiệu suất làm việc của thành viên.', category: 'Nhóm', icon: 'Users' },
    { id: '6', title: 'Biên bản họp nhóm', description: 'Ghi lại nội dung cuộc họp, quyết định và công việc tiếp theo.', category: 'Nhóm', icon: 'FileText' },

    // Học tập
    { id: '7', title: 'Báo cáo tiến độ học tập', description: 'Theo dõi tiến độ hoàn thành khóa học và mục tiêu học tập.', category: 'Học tập', icon: 'GraduationCap' },
    { id: '8', title: 'Đánh giá khóa học', description: 'Nhận xét chi tiết về chất lượng và nội dung khóa học.', category: 'Học tập', icon: 'GraduationCap' },
    { id: '9', title: 'Kế hoạch học tập', description: 'Lập kế hoạch học tập theo tuần/tháng với mục tiêu cụ thể.', category: 'Học tập', icon: 'Target' },

    // Phân tích
    { id: '10', title: 'Phân tích kết quả', description: 'Phân tích số liệu và đánh giá hiệu suất tổng thể.', category: 'Phân tích', icon: 'BarChart' },
    { id: '11', title: 'So sánh & Đối chiếu', description: 'So sánh các phương án hoặc kết quả khác nhau.', category: 'Phân tích', icon: 'BarChart' },
    { id: '12', title: 'Báo cáo thống kê', description: 'Tổng hợp số liệu thống kê với biểu đồ trực quan.', category: 'Phân tích', icon: 'BarChart' },
];

const ReportTemplates: React.FC = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('Tất cả');

    const categories = ['Tất cả', 'Cuộc thi', 'Nhóm', 'Học tập', 'Phân tích'];

    const getIcon = (iconName: string) => {
        switch (iconName) {
            case 'Trophy': return <Trophy className="w-6 h-6 text-amber-600" />;
            case 'Users': return <Users className="w-6 h-6 text-teal-600" />;
            case 'BarChart': return <BarChart className="w-6 h-6 text-purple-600" />;
            case 'GraduationCap': return <GraduationCap className="w-6 h-6 text-blue-600" />;
            case 'Target': return <Target className="w-6 h-6 text-red-600" />;
            case 'CheckCircle': return <CheckCircle className="w-6 h-6 text-green-600" />;
            default: return <FileText className="w-6 h-6 text-gray-600" />;
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'Cuộc thi': return 'bg-amber-50 text-amber-700';
            case 'Nhóm': return 'bg-teal-50 text-teal-700';
            case 'Học tập': return 'bg-blue-50 text-blue-700';
            case 'Phân tích': return 'bg-purple-50 text-purple-700';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    const filteredTemplates = allTemplates.filter(template => {
        const matchesCategory = categoryFilter === 'Tất cả' || template.category === categoryFilter;
        const matchesSearch = template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            template.description.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const handleSelectTemplate = (template: ReportTemplate) => {
        // TODO: Navigate to editor with template
        console.log('Selected template:', template);
        // navigate(`/reports/new?template=${template.id}`);
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="p-6 max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <button
                            onClick={() => navigate('/reports')}
                            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-3 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="text-sm font-medium">Quay lại</span>
                        </button>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                            <Sparkles className="w-8 h-8 text-primary-600" />
                            Chọn mẫu báo cáo
                        </h1>
                        <p className="text-slate-500 mt-1">Chọn một mẫu để bắt đầu tạo báo cáo với sự hỗ trợ của AI</p>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                    {/* Category Tabs */}
                    <div className="flex bg-white p-1.5 rounded-xl border border-slate-200 overflow-x-auto max-w-full shadow-sm">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setCategoryFilter(cat)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${categoryFilter === cat
                                    ? 'bg-primary-600 text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm mẫu..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-400 text-sm transition-all shadow-sm"
                        />
                    </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {filteredTemplates.map((template) => (
                        <div
                            key={template.id}
                            onClick={() => handleSelectTemplate(template)}
                            className="group relative bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-lg hover:border-primary-300 transition-all duration-300 cursor-pointer flex flex-col h-full"
                        >
                            <div className="mb-4 p-3 bg-slate-50 rounded-xl w-fit group-hover:bg-primary-50 transition-colors">
                                {getIcon(template.icon)}
                            </div>

                            <div className="grow">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${getCategoryColor(template.category)}`}>
                                        {template.category}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-primary-700 transition-colors">
                                    {template.title}
                                </h3>
                                <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">
                                    {template.description}
                                </p>
                            </div>

                            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" /> AI hỗ trợ
                                </span>
                                <span className="flex items-center text-sm font-semibold text-primary-600 opacity-0 group-hover:opacity-100 transform translate-x-[-10px] group-hover:translate-x-0 transition-all duration-300">
                                    Sử dụng <ArrowRight className="w-4 h-4 ml-1" />
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {filteredTemplates.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Filter className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-lg font-medium">Không tìm thấy mẫu nào</p>
                        <p className="text-sm">Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportTemplates;
