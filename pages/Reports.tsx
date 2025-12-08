import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, FileText, Clock, MoreHorizontal, ArrowRight, BarChart, Briefcase, GraduationCap, Users, Trophy, BookOpen, Sparkles, Edit3, Trash2, Send, Copy, Download, ChevronLeft, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ReportTemplate, Report } from '../types';
import ReportEditor from '../components/ReportEditor';
import ReportTemplatesGallery from '../components/ReportTemplatesGallery';
import ReportEmailComposer from '../components/ReportEmailComposer';
import reportService from '../services/reportService';

// Templates phù hợp với ContestHub
const templates: ReportTemplate[] = [
    { id: '1', title: 'Báo cáo tiến độ tuần', description: 'Theo dõi tiến độ học tập và thi đấu hàng tuần.', category: 'Học tập', icon: 'BarChart' },
    { id: '2', title: 'Tổng kết cuộc thi', description: 'Ghi nhận kết quả và bài học từ cuộc thi.', category: 'Cuộc thi', icon: 'Trophy' },
    { id: '3', title: 'Báo cáo nhóm', description: 'Tổng hợp hoạt động và đóng góp của team.', category: 'Nhóm', icon: 'Users' },
    { id: '4', title: 'Đánh giá khóa học', description: 'Nhận xét và phản hồi về khóa học đã tham gia.', category: 'Khóa học', icon: 'GraduationCap' },
];

// Helper function to get current date in Vietnamese format
const getCurrentDate = () => new Date().toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' });

// Helper function to generate starter content based on template title
const getStarterContent = (templateTitle: string): string => {
    const currentDate = getCurrentDate();
    const commonHeader = `
        <h1 style="font-size: 2rem; font-weight: bold; color: #1e293b; margin-bottom: 0.5rem;">${templateTitle}</h1>
        <p style="color: #64748b; margin-bottom: 2rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 1rem;">Tạo ngày ${currentDate} | Người thực hiện: [Tên của bạn]</p>
    `;

    // Báo cáo tiến độ tuần
    if (templateTitle.includes('tiến độ tuần')) {
        return `
            ${commonHeader}
            
            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 1rem; margin-bottom: 2rem; border-radius: 0 0.5rem 0.5rem 0;">
                <h3 style="color: #1e40af; font-weight: bold; margin-bottom: 0.25rem;">📋 Tóm tắt</h3>
                <p style="color: #1e3a8a; font-style: italic;">[Tóm tắt ngắn gọn tiến độ học tập trong tuần. Có gì đáng chú ý?]</p>
            </div>

            <h2 style="font-size: 1.5rem; font-weight: bold; color: #1e293b; margin-top: 2rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                <span style="width: 0.5rem; height: 2rem; background: #14b8a6; border-radius: 9999px; display: inline-block;"></span> Thành tựu trong tuần
            </h2>
            <ul style="list-style: disc; padding-left: 1.5rem; color: #334155;">
                <li><strong>Học tập:</strong> Hoàn thành 3 bài học về React Hooks</li>
                <li><strong>Cuộc thi:</strong> Đăng ký tham gia Hackathon AI 2024</li>
                <li><strong>Dự án:</strong> Hoàn thành 60% giao diện dashboard</li>
                <li>[Thêm thành tựu khác]</li>
            </ul>

            <h2 style="font-size: 1.5rem; font-weight: bold; color: #1e293b; margin-top: 2rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                <span style="width: 0.5rem; height: 2rem; background: #a855f7; border-radius: 9999px; display: inline-block;"></span> Tiến độ chi tiết
            </h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-size: 0.875rem;">
                <thead>
                    <tr style="background: #f1f5f9; color: #475569;">
                        <th style="border: 1px solid #e2e8f0; padding: 0.75rem; text-align: left;">Nhiệm vụ</th>
                        <th style="border: 1px solid #e2e8f0; padding: 0.75rem; text-align: left;">Trạng thái</th>
                        <th style="border: 1px solid #e2e8f0; padding: 0.75rem; text-align: left;">Hoàn thành</th>
                        <th style="border: 1px solid #e2e8f0; padding: 0.75rem; text-align: left;">Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="border: 1px solid #e2e8f0; padding: 0.75rem; font-weight: 500;">Học React cơ bản</td>
                        <td style="border: 1px solid #e2e8f0; padding: 0.75rem;"><span style="background: #dcfce7; color: #166534; padding: 0.25rem 0.5rem; border-radius: 9999px; font-size: 0.75rem;">Hoàn thành</span></td>
                        <td style="border: 1px solid #e2e8f0; padding: 0.75rem;">100%</td>
                        <td style="border: 1px solid #e2e8f0; padding: 0.75rem; color: #64748b;">Đã lấy chứng chỉ</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #e2e8f0; padding: 0.75rem; font-weight: 500;">Dự án Portfolio</td>
                        <td style="border: 1px solid #e2e8f0; padding: 0.75rem;"><span style="background: #fef9c3; color: #854d0e; padding: 0.25rem 0.5rem; border-radius: 9999px; font-size: 0.75rem;">Đang làm</span></td>
                        <td style="border: 1px solid #e2e8f0; padding: 0.75rem;">60%</td>
                        <td style="border: 1px solid #e2e8f0; padding: 0.75rem; color: #64748b;">Cần thêm responsive</td>
                    </tr>
                </tbody>
            </table>

            <h2 style="font-size: 1.5rem; font-weight: bold; color: #1e293b; margin-top: 2rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                <span style="width: 0.5rem; height: 2rem; background: #f97316; border-radius: 9999px; display: inline-block;"></span> Kế hoạch tuần tới
            </h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; border: 1px solid #e2e8f0;">
                    <h4 style="font-weight: bold; color: #334155; margin-bottom: 0.5rem;">Ưu tiên 1</h4>
                    <p style="color: #475569; font-size: 0.875rem;">Hoàn thành dự án Portfolio và deploy lên Vercel</p>
                </div>
                <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; border: 1px solid #e2e8f0;">
                    <h4 style="font-weight: bold; color: #334155; margin-bottom: 0.5rem;">Ưu tiên 2</h4>
                    <p style="color: #475569; font-size: 0.875rem;">Bắt đầu học TypeScript nâng cao</p>
                </div>
            </div>
        `;
    }

    // Tổng kết cuộc thi
    if (templateTitle.includes('Tổng kết cuộc thi') || templateTitle.includes('cuộc thi')) {
        return `
            ${commonHeader}
            
            <div style="background: #f8fafc; padding: 1.5rem; border-radius: 0.75rem; border: 1px solid #e2e8f0; margin-bottom: 2rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.875rem;">
                    <div><span style="font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 0.75rem; display: block; margin-bottom: 0.25rem;">Tên cuộc thi</span> [Hackathon AI 2024]</div>
                    <div><span style="font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 0.75rem; display: block; margin-bottom: 0.25rem;">Thời gian</span> [15-17/11/2024]</div>
                    <div><span style="font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 0.75rem; display: block; margin-bottom: 0.25rem;">Địa điểm</span> [Online / ĐH Bách Khoa]</div>
                    <div><span style="font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 0.75rem; display: block; margin-bottom: 0.25rem;">Kết quả</span> <span style="color: #f59e0b; font-weight: bold;">🏆 Giải Nhì</span></div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
                <div style="background: #dcfce7; border: 1px solid #bbf7d0; border-radius: 0.75rem; padding: 1.25rem;">
                    <h3 style="display: flex; align-items: center; gap: 0.5rem; font-weight: bold; color: #166534; margin-bottom: 1rem;">
                        <span style="background: #bbf7d0; padding: 0.375rem; border-radius: 0.5rem;">👍</span> Điểm mạnh
                    </h3>
                    <ul style="list-style: disc; padding-left: 1rem; font-size: 0.875rem; color: #14532d;">
                        <li>Làm việc nhóm hiệu quả</li>
                        <li>Ý tưởng sáng tạo</li>
                        <li>Demo ấn tượng</li>
                    </ul>
                </div>

                <div style="background: #fee2e2; border: 1px solid #fecaca; border-radius: 0.75rem; padding: 1.25rem;">
                    <h3 style="display: flex; align-items: center; gap: 0.5rem; font-weight: bold; color: #991b1b; margin-bottom: 1rem;">
                        <span style="background: #fecaca; padding: 0.375rem; border-radius: 0.5rem;">👎</span> Cần cải thiện
                    </h3>
                    <ul style="list-style: disc; padding-left: 1rem; font-size: 0.875rem; color: #7f1d1d;">
                        <li>Quản lý thời gian chưa tốt</li>
                        <li>Technical debt cao</li>
                    </ul>
                </div>

                <div style="background: #dbeafe; border: 1px solid #bfdbfe; border-radius: 0.75rem; padding: 1.25rem;">
                    <h3 style="display: flex; align-items: center; gap: 0.5rem; font-weight: bold; color: #1e40af; margin-bottom: 1rem;">
                        <span style="background: #bfdbfe; padding: 0.375rem; border-radius: 0.5rem;">💡</span> Bài học rút ra
                    </h3>
                    <ul style="list-style: disc; padding-left: 1rem; font-size: 0.875rem; color: #1e3a8a;">
                        <li>Lập kế hoạch kỹ hơn</li>
                        <li>Chia nhỏ task từ đầu</li>
                        <li>Test sớm và thường xuyên</li>
                    </ul>
                </div>
            </div>

            <h2 style="font-size: 1.5rem; font-weight: bold; color: #1e293b; margin-bottom: 1rem;">📝 Chi tiết quá trình thi đấu</h2>
            <p style="color: #334155; line-height: 1.75;">
                [Mô tả chi tiết quá trình tham gia cuộc thi, các thử thách gặp phải, cách giải quyết, và kết quả cuối cùng. Đây là phần quan trọng để rút kinh nghiệm cho các cuộc thi sau.]
            </p>
        `;
    }

    // Báo cáo nhóm / Biên bản họp nhóm
    if (templateTitle.includes('nhóm') || templateTitle.includes('họp')) {
        return `
            ${commonHeader}

            <div style="background: #f8fafc; padding: 1.5rem; border-radius: 0.75rem; border: 1px solid #e2e8f0; margin-bottom: 2rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.875rem;">
                    <div><span style="font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 0.75rem; display: block; margin-bottom: 0.25rem;">Ngày họp</span> ${currentDate}</div>
                    <div><span style="font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 0.75rem; display: block; margin-bottom: 0.25rem;">Thời gian</span> 20:00 - 21:30</div>
                    <div style="grid-column: span 2;"><span style="font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 0.75rem; display: block; margin-bottom: 0.25rem;">Thành viên tham gia</span> Nguyễn Văn A, Trần Thị B, Lê Văn C, Phạm Thị D</div>
                    <div style="grid-column: span 2;"><span style="font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 0.75rem; display: block; margin-bottom: 0.25rem;">Hình thức</span> Online (Google Meet)</div>
                </div>
            </div>

            <h2 style="font-size: 1.25rem; font-weight: bold; color: #1e293b; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; margin-bottom: 1rem;">📋 Nội dung thảo luận</h2>
            <ol style="list-style: decimal; padding-left: 1.5rem; color: #334155; margin-bottom: 2rem;">
                <li style="margin-bottom: 0.5rem;"><strong>Đánh giá tiến độ:</strong> Review các task đã hoàn thành trong tuần</li>
                <li style="margin-bottom: 0.5rem;"><strong>Phân công công việc:</strong> Chia task cho sprint tiếp theo</li>
                <li style="margin-bottom: 0.5rem;"><strong>Vấn đề gặp phải:</strong> Thảo luận các blocker và cách giải quyết</li>
            </ol>

            <h2 style="font-size: 1.25rem; font-weight: bold; color: #1e293b; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem; margin-bottom: 1rem;">✅ Công việc được giao</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
                <tbody>
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 0.75rem;">☐</td>
                        <td style="padding: 0.75rem; font-weight: 500;">Hoàn thành giao diện trang chủ</td>
                        <td style="padding: 0.75rem; color: #64748b; text-align: right;">Người: Nguyễn Văn A</td>
                        <td style="padding: 0.75rem; color: #64748b; text-align: right;">Hạn: 20/12</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 0.75rem;">☐</td>
                        <td style="padding: 0.75rem; font-weight: 500;">Viết API authentication</td>
                        <td style="padding: 0.75rem; color: #64748b; text-align: right;">Người: Trần Thị B</td>
                        <td style="padding: 0.75rem; color: #64748b; text-align: right;">Hạn: 18/12</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 0.75rem;">☐</td>
                        <td style="padding: 0.75rem; font-weight: 500;">Thiết kế database schema</td>
                        <td style="padding: 0.75rem; color: #64748b; text-align: right;">Người: Lê Văn C</td>
                        <td style="padding: 0.75rem; color: #64748b; text-align: right;">Hạn: 15/12</td>
                    </tr>
                </tbody>
            </table>
        `;
    }

    // Đánh giá khóa học / Ghi chú bài học
    if (templateTitle.includes('khóa học') || templateTitle.includes('bài học')) {
        return `
            ${commonHeader}
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 1.5rem; border-radius: 0.75rem; margin-bottom: 2rem;">
                <h3 style="font-size: 1.25rem; font-weight: bold; margin-bottom: 0.5rem;">📚 [Tên khóa học]</h3>
                <p style="opacity: 0.9; font-size: 0.875rem;">Giảng viên: [Tên giảng viên] | Thời lượng: [X tuần]</p>
                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <span style="background: rgba(255,255,255,0.2); padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem;">⭐ 4.8/5</span>
                    <span style="background: rgba(255,255,255,0.2); padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem;">✅ Đã hoàn thành</span>
                </div>
            </div>

            <h2 style="font-size: 1.5rem; font-weight: bold; color: #1e293b; margin-bottom: 1rem;">📖 Nội dung đã học</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
                <div style="background: #f0fdf4; padding: 1rem; border-radius: 0.5rem; border: 1px solid #bbf7d0;">
                    <h4 style="font-weight: bold; color: #166534; margin-bottom: 0.5rem;">Module 1: Cơ bản</h4>
                    <ul style="font-size: 0.875rem; color: #15803d; list-style: none; padding: 0;">
                        <li>✓ Giới thiệu và cài đặt</li>
                        <li>✓ Cú pháp cơ bản</li>
                        <li>✓ Các khái niệm nền tảng</li>
                    </ul>
                </div>
                <div style="background: #f0fdf4; padding: 1rem; border-radius: 0.5rem; border: 1px solid #bbf7d0;">
                    <h4 style="font-weight: bold; color: #166534; margin-bottom: 0.5rem;">Module 2: Nâng cao</h4>
                    <ul style="font-size: 0.875rem; color: #15803d; list-style: none; padding: 0;">
                        <li>✓ Patterns và Best practices</li>
                        <li>✓ Performance optimization</li>
                        <li>✓ Real-world projects</li>
                    </ul>
                </div>
            </div>

            <h2 style="font-size: 1.5rem; font-weight: bold; color: #1e293b; margin-bottom: 1rem;">⭐ Đánh giá chi tiết</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-size: 0.875rem;">
                <tbody>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 0.75rem; font-weight: 500;">Chất lượng nội dung</td>
                        <td style="padding: 0.75rem; text-align: right;">⭐⭐⭐⭐⭐</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 0.75rem; font-weight: 500;">Cách trình bày</td>
                        <td style="padding: 0.75rem; text-align: right;">⭐⭐⭐⭐☆</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 0.75rem; font-weight: 500;">Bài tập thực hành</td>
                        <td style="padding: 0.75rem; text-align: right;">⭐⭐⭐⭐⭐</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 0.75rem; font-weight: 500;">Hỗ trợ học viên</td>
                        <td style="padding: 0.75rem; text-align: right;">⭐⭐⭐⭐☆</td>
                    </tr>
                </tbody>
            </table>

            <h2 style="font-size: 1.5rem; font-weight: bold; color: #1e293b; margin-bottom: 1rem;">💭 Nhận xét</h2>
            <p style="color: #334155; line-height: 1.75;">
                [Viết nhận xét chi tiết về khóa học. Điểm mạnh, điểm yếu, và có nên recommend cho người khác không?]
            </p>
        `;
    }

    // Tổng kết học kỳ / Kế hoạch học tập
    if (templateTitle.includes('học kỳ') || templateTitle.includes('Kế hoạch học tập')) {
        return `
            ${commonHeader}
            
            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 1rem; margin-bottom: 2rem; border-radius: 0 0.5rem 0.5rem 0;">
                <h3 style="color: #1e40af; font-weight: bold; margin-bottom: 0.25rem;">🎯 Mục tiêu học kỳ</h3>
                <p style="color: #1e3a8a;">[Mô tả mục tiêu tổng quan của học kỳ này]</p>
            </div>

            <h2 style="font-size: 1.5rem; font-weight: bold; color: #1e293b; margin-bottom: 1rem;">📊 Thống kê tổng quan</h2>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; text-align: center; border: 1px solid #e2e8f0;">
                    <p style="font-size: 2rem; font-weight: bold; color: #3b82f6;">5</p>
                    <p style="font-size: 0.875rem; color: #64748b;">Khóa học</p>
                </div>
                <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; text-align: center; border: 1px solid #e2e8f0;">
                    <p style="font-size: 2rem; font-weight: bold; color: #10b981;">3</p>
                    <p style="font-size: 0.875rem; color: #64748b;">Cuộc thi</p>
                </div>
                <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; text-align: center; border: 1px solid #e2e8f0;">
                    <p style="font-size: 2rem; font-weight: bold; color: #f59e0b;">2</p>
                    <p style="font-size: 0.875rem; color: #64748b;">Chứng chỉ</p>
                </div>
                <div style="background: #f8fafc; padding: 1rem; border-radius: 0.5rem; text-align: center; border: 1px solid #e2e8f0;">
                    <p style="font-size: 2rem; font-weight: bold; color: #8b5cf6;">120</p>
                    <p style="font-size: 0.875rem; color: #64748b;">Giờ học</p>
                </div>
            </div>

            <h2 style="font-size: 1.5rem; font-weight: bold; color: #1e293b; margin-bottom: 1rem;">📅 Kế hoạch chi tiết theo tháng</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-size: 0.875rem;">
                <thead>
                    <tr style="background: #f1f5f9; color: #475569;">
                        <th style="border: 1px solid #e2e8f0; padding: 0.75rem; text-align: left;">Tháng</th>
                        <th style="border: 1px solid #e2e8f0; padding: 0.75rem; text-align: left;">Mục tiêu</th>
                        <th style="border: 1px solid #e2e8f0; padding: 0.75rem; text-align: left;">Hoạt động</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="border: 1px solid #e2e8f0; padding: 0.75rem; font-weight: 500;">Tháng 9</td>
                        <td style="border: 1px solid #e2e8f0; padding: 0.75rem;">Học nền tảng</td>
                        <td style="border: 1px solid #e2e8f0; padding: 0.75rem; color: #64748b;">JavaScript, HTML/CSS cơ bản</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #e2e8f0; padding: 0.75rem; font-weight: 500;">Tháng 10</td>
                        <td style="border: 1px solid #e2e8f0; padding: 0.75rem;">React Framework</td>
                        <td style="border: 1px solid #e2e8f0; padding: 0.75rem; color: #64748b;">React basics, Hooks, State management</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #e2e8f0; padding: 0.75rem; font-weight: 500;">Tháng 11</td>
                        <td style="border: 1px solid #e2e8f0; padding: 0.75rem;">Dự án thực tế</td>
                        <td style="border: 1px solid #e2e8f0; padding: 0.75rem; color: #64748b;">Tham gia Hackathon, làm portfolio</td>
                    </tr>
                </tbody>
            </table>
        `;
    }

    // Đề xuất tham gia / Phân tích đối thủ
    if (templateTitle.includes('Đề xuất') || templateTitle.includes('Phân tích')) {
        return `
            ${commonHeader}
            
            <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 1rem; border-radius: 0.5rem; margin-bottom: 2rem;">
                <p style="color: #92400e; font-weight: 500;">⚠️ Đây là tài liệu phân tích/đề xuất. Vui lòng xem xét kỹ trước khi đưa ra quyết định.</p>
            </div>

            <h2 style="font-size: 1.5rem; font-weight: bold; color: #1e293b; margin-bottom: 1rem;">📋 Thông tin cuộc thi</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-size: 0.875rem;">
                <tbody>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 0.75rem; font-weight: 500; width: 30%;">Tên cuộc thi</td>
                        <td style="padding: 0.75rem;">[Tên cuộc thi]</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 0.75rem; font-weight: 500;">Thời gian</td>
                        <td style="padding: 0.75rem;">[Ngày bắt đầu - Ngày kết thúc]</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 0.75rem; font-weight: 500;">Giải thưởng</td>
                        <td style="padding: 0.75rem;">[Chi tiết giải thưởng]</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 0.75rem; font-weight: 500;">Yêu cầu</td>
                        <td style="padding: 0.75rem;">[Các yêu cầu tham gia]</td>
                    </tr>
                </tbody>
            </table>

            <h2 style="font-size: 1.5rem; font-weight: bold; color: #1e293b; margin-bottom: 1rem;">🔍 Phân tích SWOT</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
                <div style="background: #dcfce7; padding: 1rem; border-radius: 0.5rem;">
                    <h4 style="font-weight: bold; color: #166534; margin-bottom: 0.5rem;">💪 Điểm mạnh (S)</h4>
                    <ul style="font-size: 0.875rem; color: #15803d; padding-left: 1rem;">
                        <li>[Điểm mạnh 1]</li>
                        <li>[Điểm mạnh 2]</li>
                    </ul>
                </div>
                <div style="background: #fee2e2; padding: 1rem; border-radius: 0.5rem;">
                    <h4 style="font-weight: bold; color: #991b1b; margin-bottom: 0.5rem;">⚠️ Điểm yếu (W)</h4>
                    <ul style="font-size: 0.875rem; color: #b91c1c; padding-left: 1rem;">
                        <li>[Điểm yếu 1]</li>
                        <li>[Điểm yếu 2]</li>
                    </ul>
                </div>
                <div style="background: #dbeafe; padding: 1rem; border-radius: 0.5rem;">
                    <h4 style="font-weight: bold; color: #1e40af; margin-bottom: 0.5rem;">🌟 Cơ hội (O)</h4>
                    <ul style="font-size: 0.875rem; color: #1d4ed8; padding-left: 1rem;">
                        <li>[Cơ hội 1]</li>
                        <li>[Cơ hội 2]</li>
                    </ul>
                </div>
                <div style="background: #fef3c7; padding: 1rem; border-radius: 0.5rem;">
                    <h4 style="font-weight: bold; color: #92400e; margin-bottom: 0.5rem;">⚡ Thách thức (T)</h4>
                    <ul style="font-size: 0.875rem; color: #b45309; padding-left: 1rem;">
                        <li>[Thách thức 1]</li>
                        <li>[Thách thức 2]</li>
                    </ul>
                </div>
            </div>

            <h2 style="font-size: 1.5rem; font-weight: bold; color: #1e293b; margin-bottom: 1rem;">📊 Kết luận & Đề xuất</h2>
            <p style="color: #334155; line-height: 1.75;">
                [Tóm tắt phân tích và đưa ra đề xuất cụ thể: Nên hay không nên tham gia? Cần chuẩn bị gì?]
            </p>
        `;
    }

    // Đánh giá thành viên
    if (templateTitle.includes('thành viên')) {
        return `
            ${commonHeader}
            
            <h2 style="font-size: 1.5rem; font-weight: bold; color: #1e293b; margin-bottom: 1rem;">👤 Thông tin thành viên</h2>
            <div style="display: flex; gap: 1.5rem; align-items: center; background: #f8fafc; padding: 1.5rem; border-radius: 0.75rem; margin-bottom: 2rem;">
                <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 2rem; font-weight: bold;">A</div>
                <div>
                    <h3 style="font-size: 1.25rem; font-weight: bold; color: #1e293b;">[Tên thành viên]</h3>
                    <p style="color: #64748b;">Vai trò: [Frontend Developer]</p>
                    <p style="color: #64748b; font-size: 0.875rem;">Tham gia từ: [01/09/2024]</p>
                </div>
            </div>

            <h2 style="font-size: 1.5rem; font-weight: bold; color: #1e293b; margin-bottom: 1rem;">📊 Đánh giá hiệu suất</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-size: 0.875rem;">
                <tbody>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 0.75rem; font-weight: 500;">Chất lượng công việc</td>
                        <td style="padding: 0.75rem; text-align: right;">⭐⭐⭐⭐⭐ Xuất sắc</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 0.75rem; font-weight: 500;">Đúng deadline</td>
                        <td style="padding: 0.75rem; text-align: right;">⭐⭐⭐⭐☆ Tốt</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 0.75rem; font-weight: 500;">Teamwork</td>
                        <td style="padding: 0.75rem; text-align: right;">⭐⭐⭐⭐⭐ Xuất sắc</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 0.75rem; font-weight: 500;">Sáng tạo</td>
                        <td style="padding: 0.75rem; text-align: right;">⭐⭐⭐⭐☆ Tốt</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 0.75rem; font-weight: 500;">Giao tiếp</td>
                        <td style="padding: 0.75rem; text-align: right;">⭐⭐⭐⭐⭐ Xuất sắc</td>
                    </tr>
                </tbody>
            </table>

            <h2 style="font-size: 1.5rem; font-weight: bold; color: #1e293b; margin-bottom: 1rem;">💬 Nhận xét chi tiết</h2>
            <p style="color: #334155; line-height: 1.75; margin-bottom: 1rem;">
                [Viết nhận xét chi tiết về hiệu suất làm việc, đóng góp cho team, và các điểm cần cải thiện của thành viên.]
            </p>

            <h2 style="font-size: 1.5rem; font-weight: bold; color: #1e293b; margin-bottom: 1rem;">🎯 Đề xuất phát triển</h2>
            <ul style="list-style: disc; padding-left: 1.5rem; color: #334155;">
                <li>[Kỹ năng cần phát triển]</li>
                <li>[Khóa học nên tham gia]</li>
                <li>[Mục tiêu cho giai đoạn tiếp theo]</li>
            </ul>
        `;
    }

    // Dự án cuối khóa
    if (templateTitle.includes('Dự án')) {
        return `
            ${commonHeader}
            
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; border-radius: 0.75rem; margin-bottom: 2rem; text-align: center;">
                <h2 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem;">🚀 [Tên dự án]</h2>
                <p style="opacity: 0.9;">Dự án cuối khóa | [Tên khóa học]</p>
            </div>

            <h2 style="font-size: 1.5rem; font-weight: bold; color: #1e293b; margin-bottom: 1rem;">📋 Tổng quan dự án</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; font-size: 0.875rem;">
                <tbody>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 0.75rem; font-weight: 500; width: 30%;">Mô tả</td>
                        <td style="padding: 0.75rem;">[Mô tả ngắn về dự án]</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 0.75rem; font-weight: 500;">Công nghệ</td>
                        <td style="padding: 0.75rem;">React, TypeScript, TailwindCSS, Node.js</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 0.75rem; font-weight: 500;">Thời gian</td>
                        <td style="padding: 0.75rem;">[X tuần]</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 0.75rem; font-weight: 500;">Thành viên</td>
                        <td style="padding: 0.75rem;">[Danh sách thành viên]</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 0.75rem; font-weight: 500;">Link Demo</td>
                        <td style="padding: 0.75rem;"><a href="#" style="color: #3b82f6;">[Link demo]</a></td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 0.75rem; font-weight: 500;">GitHub</td>
                        <td style="padding: 0.75rem;"><a href="#" style="color: #3b82f6;">[Link GitHub]</a></td>
                    </tr>
                </tbody>
            </table>

            <h2 style="font-size: 1.5rem; font-weight: bold; color: #1e293b; margin-bottom: 1rem;">✨ Tính năng chính</h2>
            <ul style="list-style: disc; padding-left: 1.5rem; color: #334155; margin-bottom: 2rem;">
                <li style="margin-bottom: 0.5rem;"><strong>Tính năng 1:</strong> [Mô tả]</li>
                <li style="margin-bottom: 0.5rem;"><strong>Tính năng 2:</strong> [Mô tả]</li>
                <li style="margin-bottom: 0.5rem;"><strong>Tính năng 3:</strong> [Mô tả]</li>
            </ul>

            <h2 style="font-size: 1.5rem; font-weight: bold; color: #1e293b; margin-bottom: 1rem;">📸 Screenshots</h2>
            <p style="color: #64748b; font-style: italic; margin-bottom: 2rem;">[Thêm hình ảnh demo của dự án tại đây]</p>

            <h2 style="font-size: 1.5rem; font-weight: bold; color: #1e293b; margin-bottom: 1rem;">📝 Bài học rút ra</h2>
            <p style="color: #334155; line-height: 1.75;">
                [Những điều đã học được trong quá trình thực hiện dự án, khó khăn gặp phải và cách giải quyết.]
            </p>
        `;
    }

    // Default template
    return `
        ${commonHeader}
        <div style="color: #334155;">
            <h2 style="font-size: 1.25rem; font-weight: bold; color: #1e293b; margin-bottom: 1rem;">Giới thiệu</h2>
            <p style="margin-bottom: 1.5rem;">[Bắt đầu viết phần giới thiệu tại đây. Mô tả ngữ cảnh và mục đích của báo cáo.]</p>

            <h2 style="font-size: 1.25rem; font-weight: bold; color: #1e293b; margin-bottom: 1rem;">Nội dung chính</h2>
            <p style="margin-bottom: 1.5rem;">[Đây là phần chính của báo cáo. Sử dụng các đoạn văn, danh sách và bảng để trình bày dữ liệu.]</p>

            <h2 style="font-size: 1.25rem; font-weight: bold; color: #1e293b; margin-bottom: 1rem;">Kết luận</h2>
            <p>[Tóm tắt các điểm chính và đề xuất các bước tiếp theo.]</p>
        </div>
    `;
};

const Reports: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [view, setView] = useState<'list' | 'editor' | 'templates'>('list');
    const [currentReport, setCurrentReport] = useState<Report | null>(null);
    const [isEmailOpen, setIsEmailOpen] = useState(false);
    const [emailContent, setEmailContent] = useState('');
    const [isFullScreen, setIsFullScreen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // API states
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch reports from API
    const fetchReports = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await reportService.getAll({ limit: 20 });
            setReports(response.reports);
        } catch (err) {
            console.error('Error fetching reports:', err);
            setError('Không thể tải danh sách báo cáo');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Load reports on mount
    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    // Reset view to list when navigating to /reports from navbar
    useEffect(() => {
        if (location.pathname === '/reports' && location.key) {
            setView('list');
            setCurrentReport(null);
            setIsFullScreen(false);
        }
    }, [location.key]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Draft': return 'bg-gray-100 text-gray-600';
            case 'Sent': return 'bg-green-50 text-green-700 border border-green-200';
            case 'Ready': return 'bg-blue-50 text-blue-700 border border-blue-200';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'Draft': return 'Nháp';
            case 'Sent': return 'Đã gửi';
            case 'Ready': return 'Sẵn sàng';
            default: return status;
        }
    };

    const handleSelectTemplate = async (template: ReportTemplate) => {
        setSelectedTemplate(template);
        setIsSaving(true);

        try {
            // Tạo report mới trên server
            const newReport = await reportService.create({
                title: `${template.title} mới`,
                template: template.title,
                content: getStarterContent(template.title),
                status: 'Draft'
            });

            setCurrentReport(newReport);
            setView('editor');
            toast.success('Đã tạo báo cáo mới');
            // Refresh list để có report mới
            fetchReports();
        } catch (err) {
            console.error('Error creating report:', err);
            toast.error('Không thể tạo báo cáo. Đang dùng chế độ offline.');
            // Fallback: tạo local report nếu API fail
            const localReport: Report = {
                id: `new-${Date.now()}`,
                title: `${template.title} mới`,
                template: template.title,
                status: 'Draft',
                lastEdited: 'Vừa xong',
                content: getStarterContent(template.title)
            };
            setCurrentReport(localReport);
            setView('editor');
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenReport = async (report: Report) => {
        try {
            // Fetch full report data
            const fullReport = await reportService.getById(report.id);
            setSelectedReport(fullReport);
            setCurrentReport(fullReport);
            setView('editor');
        } catch (err) {
            console.error('Error fetching report:', err);
            // Fallback to local data
            setSelectedReport(report);
            setCurrentReport(report);
            setView('editor');
        }
    };

    const handleBackFromEditor = () => {
        setView('list');
        setCurrentReport(null);
        setIsFullScreen(false);
        // Refresh reports list
        fetchReports();
    };

    const handleOpenEmail = (content: string) => {
        setEmailContent(content);
        setIsEmailOpen(true);
    };

    const handleViewTemplates = () => {
        setView('templates');
    };

    const handleBackFromTemplates = () => {
        setView('list');
    };

    const handleMenuAction = async (action: string, report: Report) => {
        setOpenMenuId(null);

        switch (action) {
            case 'edit':
                handleOpenReport(report);
                break;

            case 'duplicate':
                try {
                    setIsSaving(true);
                    await reportService.duplicate(report.id);
                    toast.success('Đã nhân bản báo cáo');
                    fetchReports();
                } catch (err) {
                    console.error('Error duplicating report:', err);
                    toast.error('Không thể nhân bản báo cáo');
                    setError('Không thể nhân bản báo cáo');
                } finally {
                    setIsSaving(false);
                }
                break;

            case 'download':
                // TODO: Implement PDF/Word export
                console.log('Download report:', report);
                break;

            case 'send':
                handleOpenEmail(report.content);
                break;

            case 'delete':
                if (window.confirm('Bạn có chắc muốn xóa báo cáo này?')) {
                    try {
                        setIsSaving(true);
                        await reportService.delete(report.id);
                        toast.success('Đã xóa báo cáo');
                        fetchReports();
                    } catch (err) {
                        console.error('Error deleting report:', err);
                        toast.error('Không thể xóa báo cáo');
                        setError('Không thể xóa báo cáo');
                    } finally {
                        setIsSaving(false);
                    }
                }
                break;
        }
    };

    return (
        <div className={`min-h-screen bg-slate-50 ${isFullScreen ? 'fixed inset-0 z-50' : ''}`}>
            {/* Email Composer Modal */}
            <ReportEmailComposer
                isOpen={isEmailOpen}
                onClose={() => setIsEmailOpen(false)}
                reportContent={emailContent}
            />

            {/* View: Editor */}
            {view === 'editor' && currentReport && (
                <div className="h-screen">
                    <ReportEditor
                        report={currentReport}
                        onBack={handleBackFromEditor}
                        onOpenEmail={handleOpenEmail}
                        isFullScreen={isFullScreen}
                        onToggleFullScreen={() => setIsFullScreen(!isFullScreen)}
                    />
                </div>
            )}

            {/* View: Templates Gallery */}
            {view === 'templates' && (
                <div className="min-h-screen">
                    <div className="p-4 border-b border-slate-200 bg-white">
                        <button
                            onClick={handleBackFromTemplates}
                            className="flex items-center gap-2 text-slate-600 hover:text-slate-800"
                        >
                            <ChevronLeft className="w-5 h-5" />
                            Quay lại
                        </button>
                    </div>
                    <ReportTemplatesGallery onSelectTemplate={handleSelectTemplate} />
                </div>
            )}

            {/* View: List (Default) */}
            {view === 'list' && (
                <div className="p-6 max-w-7xl mx-auto space-y-8">

                    {/* Welcome Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                                <Sparkles className="w-8 h-8 text-primary-600" />
                                Báo cáo AI
                            </h1>
                            <p className="text-slate-500 mt-1">Tạo báo cáo thông minh với sự hỗ trợ của AI</p>
                        </div>
                        <button
                            onClick={handleViewTemplates}
                            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-3 rounded-xl shadow-md transition-all font-medium"
                        >
                            <Plus className="w-5 h-5" />
                            <span>Báo cáo mới</span>
                        </button>
                    </div>

                    {/* Coming Soon Banner */}
                    <div className="bg-linear-to-r from-primary-500 to-primary-600 rounded-2xl p-6 text-white shadow-lg">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/20 rounded-xl">
                                <Sparkles className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Tính năng đang phát triển</h2>
                                <p className="text-primary-100 mt-1">
                                    Chức năng tạo báo cáo với AI sẽ sớm ra mắt. Bạn sẽ có thể tự động tạo báo cáo cuộc thi, tiến độ học tập và nhiều hơn nữa!
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Templates Section */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-800">Chọn mẫu báo cáo</h2>
                            <button
                                onClick={handleViewTemplates}
                                className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                            >
                                Xem tất cả
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {templates.map((template) => (
                                <div
                                    key={template.id}
                                    className="group bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-primary-200 transition-all cursor-pointer flex flex-col h-full"
                                    onClick={() => handleSelectTemplate(template)}
                                >
                                    <div className="mb-4 p-3 bg-slate-50 rounded-xl w-fit group-hover:bg-primary-50 transition-colors">
                                        {getIcon(template.icon)}
                                    </div>
                                    <h3 className="font-semibold text-slate-900 mb-1">{template.title}</h3>
                                    <p className="text-sm text-slate-500 line-clamp-2 mb-4 grow">{template.description}</p>
                                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full w-fit mb-3">
                                        {template.category}
                                    </span>
                                    <div className="flex items-center text-sm text-primary-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300">
                                        Sử dụng mẫu <ArrowRight className="w-4 h-4 ml-1" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Recent Activity Section */}
                    <section className="pb-64">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-800">Hoạt động gần đây</h2>
                            {reports.length > 0 && (
                                <button className="text-sm text-primary-600 hover:text-primary-800 font-medium">
                                    Xem tất cả
                                </button>
                            )}
                        </div>
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-visible">
                            {isLoading ? (
                                <div className="p-12 text-center">
                                    <Loader2 className="w-8 h-8 text-primary-600 mx-auto mb-4 animate-spin" />
                                    <p className="text-slate-500">Đang tải báo cáo...</p>
                                </div>
                            ) : error ? (
                                <div className="p-12 text-center">
                                    <p className="text-red-500 mb-4">{error}</p>
                                    <button
                                        onClick={fetchReports}
                                        className="text-primary-600 hover:text-primary-800 font-medium"
                                    >
                                        Thử lại
                                    </button>
                                </div>
                            ) : reports.length > 0 ? (
                                <div className="overflow-visible">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold rounded-t-2xl">
                                            <tr>
                                                <th className="px-6 py-4 rounded-tl-2xl">Tên báo cáo</th>
                                                <th className="px-6 py-4 hidden md:table-cell">Mẫu</th>
                                                <th className="px-6 py-4">Trạng thái</th>
                                                <th className="px-6 py-4 hidden sm:table-cell">Cập nhật</th>
                                                <th className="px-6 py-4 text-right rounded-tr-2xl">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {reports.map((report) => (
                                                <tr
                                                    key={report.id}
                                                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                                                    onClick={() => handleOpenReport(report)}
                                                >
                                                    <td className="px-6 py-4 font-medium text-slate-900">
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                                                                <FileText className="w-4 h-4" />
                                                            </div>
                                                            <span className="line-clamp-1">{report.title}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500 hidden md:table-cell">{report.template}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                                                            {getStatusText(report.status)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500 text-sm hidden sm:table-cell">
                                                        <div className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" /> {report.lastEdited}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="relative" ref={openMenuId === report.id ? menuRef : null}>
                                                            <button
                                                                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                                                                title="Thêm tùy chọn"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setOpenMenuId(openMenuId === report.id ? null : report.id);
                                                                }}
                                                            >
                                                                <MoreHorizontal className="w-4 h-4" />
                                                            </button>

                                                            {/* Dropdown Menu - opens downward */}
                                                            {openMenuId === report.id && (
                                                                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-100 animate-fade-in">
                                                                    <button
                                                                        className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleMenuAction('edit', report);
                                                                        }}
                                                                    >
                                                                        <Edit3 className="w-4 h-4 text-slate-400" />
                                                                        Chỉnh sửa
                                                                    </button>
                                                                    <button
                                                                        className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleMenuAction('duplicate', report);
                                                                        }}
                                                                    >
                                                                        <Copy className="w-4 h-4 text-slate-400" />
                                                                        Nhân bản
                                                                    </button>
                                                                    <button
                                                                        className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleMenuAction('download', report);
                                                                        }}
                                                                    >
                                                                        <Download className="w-4 h-4 text-slate-400" />
                                                                        Tải xuống
                                                                    </button>
                                                                    <button
                                                                        className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleMenuAction('send', report);
                                                                        }}
                                                                    >
                                                                        <Send className="w-4 h-4 text-slate-400" />
                                                                        Gửi báo cáo
                                                                    </button>
                                                                    <div className="border-t border-slate-100 my-1"></div>
                                                                    <button
                                                                        className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleMenuAction('delete', report);
                                                                        }}
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                        Xóa
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-12 text-center">
                                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-slate-700 mb-2">Chưa có báo cáo nào</h3>
                                    <p className="text-slate-500 text-sm">Bắt đầu tạo báo cáo đầu tiên của bạn bằng cách chọn một mẫu ở trên.</p>
                                </div>
                            )}
                        </div>
                    </section>

                </div>
            )}
        </div>
    );
};

export default Reports;
