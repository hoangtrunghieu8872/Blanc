import React from 'react';
import { ArrowLeft, FileText, CheckCircle, AlertTriangle, Shield, Users, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Terms: React.FC = () => {
  const navigate = useNavigate();

  const sections = [
    {
      id: 'intro',
      icon: FileText,
      title: '1. Giới thiệu',
      content: `Chào mừng bạn đến với Blanc - nền tảng hỗ trợ sinh viên tìm kiếm cuộc thi, quản lý khóa học và kết nối đội nhóm. Bằng việc sử dụng dịch vụ của chúng tôi, bạn đồng ý tuân thủ các điều khoản và điều kiện sau đây.

Vui lòng đọc kỹ các điều khoản này trước khi sử dụng nền tảng. Nếu bạn không đồng ý với bất kỳ phần nào của điều khoản, vui lòng không sử dụng dịch vụ của chúng tôi.`
    },
    {
      id: 'account',
      icon: Users,
      title: '2. Tài khoản người dùng',
      content: `• Bạn phải cung cấp thông tin chính xác và đầy đủ khi đăng ký tài khoản.
• Bạn chịu trách nhiệm bảo mật thông tin đăng nhập của mình.
• Mỗi người chỉ được sở hữu một tài khoản.
• Bạn phải từ 16 tuổi trở lên để sử dụng dịch vụ.
• Chúng tôi có quyền tạm ngưng hoặc chấm dứt tài khoản nếu phát hiện vi phạm.`
    },
    {
      id: 'usage',
      icon: CheckCircle,
      title: '3. Quy định sử dụng',
      content: `Khi sử dụng Blanc, bạn cam kết:
• Không đăng tải nội dung vi phạm pháp luật, bản quyền hoặc đạo đức.
• Không spam, quấy rối hoặc gây phiền toái cho người dùng khác.
• Không cố gắng truy cập trái phép vào hệ thống.
• Không sử dụng bot hoặc công cụ tự động trái phép.
• Tôn trọng quyền riêng tư và thông tin cá nhân của người khác.
• Không mạo danh cá nhân hoặc tổ chức khác.`
    },
    {
      id: 'content',
      icon: BookOpen,
      title: '4. Nội dung người dùng',
      content: `• Bạn giữ quyền sở hữu đối với nội dung bạn đăng tải.
• Bằng việc đăng nội dung, bạn cấp cho chúng tôi quyền sử dụng, hiển thị và phân phối nội dung đó trên nền tảng.
• Chúng tôi có quyền xóa bất kỳ nội dung nào vi phạm điều khoản mà không cần thông báo trước.
• Bạn chịu hoàn toàn trách nhiệm về nội dung mình đăng tải.`
    },
    {
      id: 'liability',
      icon: AlertTriangle,
      title: '5. Giới hạn trách nhiệm',
      content: `• Dịch vụ được cung cấp "nguyên trạng" mà không có bảo đảm nào.
• Chúng tôi không chịu trách nhiệm về tính chính xác của thông tin cuộc thi từ bên thứ ba.
• Chúng tôi không chịu trách nhiệm về các giao dịch hoặc thỏa thuận giữa người dùng.
• Trong mọi trường hợp, trách nhiệm của chúng tôi không vượt quá số tiền bạn đã thanh toán (nếu có).`
    },
    {
      id: 'changes',
      icon: Shield,
      title: '6. Thay đổi điều khoản',
      content: `• Chúng tôi có quyền cập nhật điều khoản này bất cứ lúc nào.
• Các thay đổi sẽ có hiệu lực ngay khi được đăng tải trên nền tảng.
• Việc tiếp tục sử dụng dịch vụ sau khi điều khoản thay đổi đồng nghĩa với việc bạn chấp nhận điều khoản mới.
• Chúng tôi sẽ thông báo cho bạn về các thay đổi quan trọng qua email hoặc thông báo trên nền tảng.`
    }
  ];

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 hover:text-primary-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Quay lại</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
            <FileText className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Điều khoản sử dụng</h1>
          <p className="text-slate-500">Cập nhật lần cuối: 01/12/2025</p>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {sections.map((section) => (
            <div 
              key={section.id}
              id={section.id}
              className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 scroll-mt-20"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                  <section.icon className="w-5 h-5 text-primary-600" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
              </div>
              <div className="text-slate-600 leading-relaxed whitespace-pre-line">
                {section.content}
              </div>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="mt-12 bg-linear-to-r from-primary-500 to-teal-500 rounded-xl p-8 text-white text-center">
          <h3 className="text-xl font-semibold mb-2">Có câu hỏi?</h3>
          <p className="opacity-90 mb-4">Liên hệ với chúng tôi nếu bạn cần hỗ trợ về điều khoản sử dụng</p>
          <a 
            href="mailto:clbflife2025thptfptcantho@gmail.com"
            className="inline-flex items-center gap-2 bg-white text-primary-600 px-6 py-2 rounded-full font-medium hover:bg-opacity-90 transition-colors"
          >
            Liên hệ hỗ trợ
          </a>
        </div>
      </div>
    </div>
  );
};

export default Terms;
