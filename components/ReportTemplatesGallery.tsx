import React, { useState } from 'react';
import { Search, Filter, Briefcase, Users, BarChart, GraduationCap, FileText, Trophy, BookOpen, ArrowRight } from 'lucide-react';
import { ReportTemplate } from '../types';

interface ReportTemplatesGalleryProps {
    onSelectTemplate: (template: ReportTemplate) => void;
}

// Templates phù hợp với ContestHub
const allTemplates: ReportTemplate[] = [
    // Học tập
    { id: '1', title: 'Báo cáo tiến độ tuần', description: 'Theo dõi tiến độ học tập và thi đấu hàng tuần.', category: 'Học tập', icon: 'BarChart' },
    { id: '2', title: 'Tổng kết học kỳ', description: 'Đánh giá tổng quan kết quả học tập trong kỳ.', category: 'Học tập', icon: 'GraduationCap' },
    { id: '3', title: 'Kế hoạch học tập', description: 'Lập kế hoạch và mục tiêu học tập cá nhân.', category: 'Học tập', icon: 'BookOpen' },

    // Cuộc thi
    { id: '4', title: 'Tổng kết cuộc thi', description: 'Ghi nhận kết quả và bài học từ cuộc thi.', category: 'Cuộc thi', icon: 'Trophy' },
    { id: '5', title: 'Đề xuất tham gia', description: 'Đề xuất đăng ký tham gia cuộc thi mới.', category: 'Cuộc thi', icon: 'Trophy' },
    { id: '6', title: 'Phân tích đối thủ', description: 'Nghiên cứu và phân tích các đội thi khác.', category: 'Cuộc thi', icon: 'BarChart' },

    // Nhóm
    { id: '7', title: 'Báo cáo nhóm', description: 'Tổng hợp hoạt động và đóng góp của team.', category: 'Nhóm', icon: 'Users' },
    { id: '8', title: 'Biên bản họp nhóm', description: 'Ghi chép các quyết định và nhiệm vụ từ cuộc họp.', category: 'Nhóm', icon: 'Users' },
    { id: '9', title: 'Đánh giá thành viên', description: 'Nhận xét và phản hồi về đóng góp của từng thành viên.', category: 'Nhóm', icon: 'Users' },

    // Khóa học
    { id: '10', title: 'Đánh giá khóa học', description: 'Nhận xét và phản hồi về khóa học đã tham gia.', category: 'Khóa học', icon: 'GraduationCap' },
    { id: '11', title: 'Ghi chú bài học', description: 'Tổng hợp kiến thức từ các bài học.', category: 'Khóa học', icon: 'BookOpen' },
    { id: '12', title: 'Dự án cuối khóa', description: 'Trình bày dự án hoàn thành sau khóa học.', category: 'Khóa học', icon: 'Briefcase' },
];

export const ReportTemplatesGallery: React.FC<ReportTemplatesGalleryProps> = ({ onSelectTemplate }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('Tất cả');

    const categories = ['Tất cả', 'Học tập', 'Cuộc thi', 'Nhóm', 'Khóa học'];

    const getIcon = (iconName: string) => {
        switch (iconName) {
            case 'Briefcase': return <Briefcase className="w-6 h-6 text-blue-600" />;
            case 'Users': return <Users className="w-6 h-6 text-teal-600" />;
            case 'BarChart': return <BarChart className="w-6 h-6 text-purple-600" />;
            case 'GraduationCap': return <GraduationCap className="w-6 h-6 text-orange-600" />;
            case 'Trophy': return <Trophy className="w-6 h-6 text-amber-600" />;
            case 'BookOpen': return <BookOpen className="w-6 h-6 text-emerald-600" />;
            default: return <FileText className="w-6 h-6 text-gray-600" />;
        }
    };

    const filteredTemplates = allTemplates.filter(template => {
        const matchesCategory = categoryFilter === 'Tất cả' || template.category === categoryFilter;
        const matchesSearch = template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            template.description.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in h-full flex flex-col">

            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Thư viện mẫu báo cáo</h1>
                <p className="text-slate-500 mt-1">Chọn mẫu được thiết kế sẵn để bắt đầu báo cáo của bạn.</p>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                {/* Category Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${categoryFilter === cat
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Tìm kiếm mẫu..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 text-sm transition-all shadow-sm"
                    />
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredTemplates.map((template) => (
                    <div
                        key={template.id}
                        onClick={() => onSelectTemplate(template)}
                        className="group relative bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-blue-300 transition-all duration-300 cursor-pointer flex flex-col h-full"
                    >
                        <div className="mb-4 p-3 bg-slate-50 rounded-xl w-fit group-hover:bg-blue-50 transition-colors">
                            {getIcon(template.icon)}
                        </div>

                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                    {template.category}
                                </span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-blue-700 transition-colors">
                                {template.title}
                            </h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                {template.description}
                            </p>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-medium">Cập nhật hôm nay</span>
                            <button className="flex items-center text-sm font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transform -translate-x-2.5 group-hover:translate-x-0 transition-all duration-300">
                                Sử dụng mẫu <ArrowRight className="w-4 h-4 ml-1" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {filteredTemplates.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Filter className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-lg font-medium">Không tìm thấy mẫu</p>
                    <p className="text-sm">Thử điều chỉnh tìm kiếm hoặc bộ lọc danh mục.</p>
                </div>
            )}
        </div>
    );
};

export default ReportTemplatesGallery;
