import React from 'react';
import { ArrowLeft, Shield, Eye, Lock, Database, Bell, UserCheck, Globe, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Privacy: React.FC = () => {
  const navigate = useNavigate();

  const sections = [
    {
      id: 'collection',
      icon: Database,
      title: '1. Thu thập thông tin',
      content: `Chúng tôi thu thập các loại thông tin sau:

**Thông tin bạn cung cấp trực tiếp:**
• Họ tên, email, số điện thoại khi đăng ký
• Thông tin hồ sơ: trường học, kỹ năng, kinh nghiệm
• Nội dung bài đăng, tin nhắn và tương tác

**Thông tin tự động thu thập:**
• Địa chỉ IP, loại trình duyệt và thiết bị
• Thời gian truy cập và hoạt động trên nền tảng
• Cookies và công nghệ theo dõi tương tự`
    },
    {
      id: 'usage',
      icon: Eye,
      title: '2. Sử dụng thông tin',
      content: `Chúng tôi sử dụng thông tin của bạn để:
• Cung cấp và cải thiện dịch vụ
• Gợi ý cuộc thi và đồng đội phù hợp
• Gửi thông báo quan trọng về tài khoản
• Phân tích và cải thiện trải nghiệm người dùng
• Bảo vệ an ninh và ngăn chặn gian lận
• Tuân thủ các yêu cầu pháp lý`
    },
    {
      id: 'sharing',
      icon: Globe,
      title: '3. Chia sẻ thông tin',
      content: `Chúng tôi KHÔNG bán thông tin cá nhân của bạn. Thông tin chỉ được chia sẻ trong các trường hợp:

• **Với sự đồng ý của bạn:** Khi bạn cho phép chia sẻ hồ sơ công khai
• **Với thành viên nhóm:** Thông tin liên lạc khi bạn tham gia team
• **Với đối tác dịch vụ:** Các bên hỗ trợ vận hành (hosting, email) với cam kết bảo mật
• **Theo yêu cầu pháp luật:** Khi có yêu cầu hợp pháp từ cơ quan chức năng`
    },
    {
      id: 'security',
      icon: Lock,
      title: '4. Bảo mật thông tin',
      content: `Chúng tôi áp dụng các biện pháp bảo mật:
• Mã hóa SSL/TLS cho mọi kết nối
• Mã hóa mật khẩu bằng thuật toán bcrypt
• Xác thực hai yếu tố (tùy chọn)
• Giám sát và phát hiện xâm nhập
• Sao lưu dữ liệu định kỳ
• Hạn chế truy cập nội bộ theo nguyên tắc "need-to-know"`
    },
    {
      id: 'cookies',
      icon: Bell,
      title: '5. Cookies và theo dõi',
      content: `Chúng tôi sử dụng cookies để:
• Duy trì phiên đăng nhập
• Lưu tùy chọn người dùng
• Phân tích lưu lượng và hành vi
• Cải thiện hiệu suất trang web

Bạn có thể tắt cookies trong trình duyệt, nhưng một số tính năng có thể không hoạt động đúng.`
    },
    {
      id: 'rights',
      icon: UserCheck,
      title: '6. Quyền của bạn',
      content: `Bạn có các quyền sau đối với dữ liệu cá nhân:
• **Quyền truy cập:** Xem thông tin chúng tôi lưu trữ về bạn
• **Quyền sửa đổi:** Cập nhật thông tin không chính xác
• **Quyền xóa:** Yêu cầu xóa tài khoản và dữ liệu
• **Quyền hạn chế:** Giới hạn cách sử dụng dữ liệu
• **Quyền di chuyển:** Xuất dữ liệu của bạn
• **Quyền phản đối:** Từ chối marketing trực tiếp

Để thực hiện các quyền này, vui lòng liên hệ: clbflife2025thptfptcantho@gmail.com`
    },
    {
      id: 'retention',
      icon: Trash2,
      title: '7. Lưu trữ dữ liệu',
      content: `• Dữ liệu tài khoản được lưu trong suốt thời gian bạn sử dụng dịch vụ
• Sau khi xóa tài khoản, dữ liệu sẽ được xóa trong vòng 30 ngày
• Một số dữ liệu có thể được giữ lại để tuân thủ pháp luật hoặc giải quyết tranh chấp
• Dữ liệu phân tích ẩn danh có thể được lưu trữ vô thời hạn`
    },
    {
      id: 'children',
      icon: Shield,
      title: '8. Bảo vệ trẻ em',
      content: `• Dịch vụ dành cho người dùng từ 16 tuổi trở lên
• Chúng tôi không cố ý thu thập thông tin từ trẻ em dưới 16 tuổi
• Nếu phát hiện tài khoản của trẻ em, chúng tôi sẽ xóa ngay lập tức
• Phụ huynh có thể liên hệ để yêu cầu xóa thông tin của con em`
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
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
            <Shield className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Chính sách bảo mật</h1>
          <p className="text-slate-500">Cập nhật lần cuối: 01/12/2025</p>
        </div>

        {/* Summary Card */}
        <div className="bg-linear-to-r from-emerald-500 to-teal-500 rounded-xl p-6 text-white mb-8">
          <h2 className="font-semibold text-lg mb-3">Tóm tắt</h2>
          <ul className="space-y-2 text-emerald-50">
            <li className="flex items-start gap-2">
              <span className="text-white">✓</span>
              <span>Chúng tôi <strong className="text-white">KHÔNG</strong> bán thông tin cá nhân của bạn</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white">✓</span>
              <span>Dữ liệu được mã hóa và bảo vệ nghiêm ngặt</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white">✓</span>
              <span>Bạn có toàn quyền kiểm soát dữ liệu của mình</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white">✓</span>
              <span>Có thể xóa tài khoản và dữ liệu bất cứ lúc nào</span>
            </li>
          </ul>
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
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <section.icon className="w-5 h-5 text-emerald-600" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900">{section.title}</h2>
              </div>
              <div className="text-slate-600 leading-relaxed whitespace-pre-line prose prose-sm max-w-none">
                {section.content.split('**').map((part, index) => 
                  index % 2 === 1 ? <strong key={index} className="text-slate-800">{part}</strong> : part
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="mt-12 bg-white rounded-xl p-8 border border-slate-200 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
              <Lock className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Liên hệ về bảo mật</h3>
              <p className="text-slate-600 mb-4">
                Nếu bạn có câu hỏi về chính sách bảo mật hoặc muốn thực hiện quyền của mình, vui lòng liên hệ:
              </p>
              <div className="space-y-2 text-slate-600">
                <p>📧 Email: <a href="mailto:clbflife2025thptfptcantho@gmail.com" className="text-emerald-600 hover:underline">clbflife2025thptfptcantho@gmail.com</a></p>
                <p>📞 Điện thoại: <a href="tel:+84916007090" className="text-emerald-600 hover:underline">+84 916 007 090</a></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
