# Kế hoạch phát triển “Báo cáo cá nhân” (Reports)

## Mục tiêu
- Người dùng ghi nhận **thành tích** + **minh chứng** (nhập tay, có thể mở rộng upload).
- Người dùng có thể **gửi mentor review** và theo dõi **feedback thread**.
- Mentor/admin có **hàng đợi review** để xem báo cáo của người dùng khác, feedback và đổi trạng thái.
- Hệ thống **nhắc nhở sau 2 tuần** kể từ ngày thi (dựa trên lịch/đăng ký).

## Phạm vi MVP (đã/đang triển khai)
### Luồng người dùng
1. Tạo báo cáo (cá nhân / tổng kết cuộc thi / tiến độ khóa học).
2. Cập nhật:
   - Thành tích (title, mô tả, thời gian).
   - Minh chứng (title + URL).
   - Ghi chú/tổng kết.
3. Gửi mentor review (reviewStatus: `submitted`).
4. Xem feedback và phản hồi (thread).
5. Nhắc nhở “thêm minh chứng” sau 14 ngày kể từ `dateStart` của contest (từ lịch/registrations).

### Luồng mentor/admin
1. Xem danh sách report gửi lên (default: `submitted`).
2. Xem chi tiết report + feedback thread.
3. Gửi feedback.
4. Cập nhật trạng thái: `needs_changes` / `approved` (có thể đưa lại `submitted`).

## Dữ liệu & API
### Reports (reports collection)
- `activities[]`: dùng làm “thành tích”.
- `evidence[]`: minh chứng (MVP dùng URL + title; mở rộng upload/drive).
- `relatedType`, `relatedId`: gắn report với `contest`/`course` để:
  - tự động gợi ý/nhắc nhở theo lịch
  - mentor hiểu ngữ cảnh

### Feedback thread (report_feedback collection)
- Dùng chung cho:
  - owner xem/rep (owner-only endpoints)
  - mentor/admin feedback (review endpoints)

## Tính năng nâng cấp (để “hoàn hảo” hơn)
### 1) Nhắc nhở & thói quen
- In-app notification (ghi vào `notification_logs`) thay vì chỉ hiển thị trong trang.
- Nhắc nhở theo “độ hoàn thiện”: chưa có minh chứng / ít minh chứng / chưa gửi mentor.
- Digest hàng tuần: tổng hợp report cần cập nhật.
- Cho phép user “Snooze 7 ngày” thay vì chỉ “Bỏ qua”.

### 2) Chất lượng minh chứng
- Hỗ trợ upload file + tự gắn `mimeType` (PDF/ảnh), preview ảnh.
- Hỗ trợ “minh chứng dạng text” (mô tả ngắn) cho trường hợp không có link.
- Hệ thống “Evidence checklist” theo template (contest/couse/personal).

### 3) Trải nghiệm mentor review
- Bộ lọc nâng cao: theo template, theo user, theo thời gian gửi, theo trạng thái.
- Mentions/quick replies cho feedback.
- Lịch sử trạng thái (audit trail: ai duyệt, lúc nào, lý do).
- SLA indicators: report nào quá hạn chưa review.

### 4) Xuất bản & chia sẻ
- Export PDF/HTML.
- “Share link” (chỉ đọc) cho mentor/người xem khác (phân quyền).
- Email gửi báo cáo cho mentor/đội nhóm.

### 5) Phân quyền & bảo mật
- Thống nhất policy:
  - owner chỉ xem/sửa report của mình
  - mentor/admin chỉ review qua `/api/review/reports/*`
- Kiểm soát đầu vào URL (allowlist/denylist tùy nhu cầu), chống spam.
- Rate limit cho feedback.

### 6) Thống kê & dashboard
- “Completion score” cho report: số thành tích + số minh chứng + phản hồi mentor.
- Timeline theo tháng/quý.
- So sánh tiến độ giữa các tuần (đặc biệt cho template weekly).

## Kiểm thử & theo dõi
- Unit test cho validation evidence (URL) và mapping/filters.
- Kiểm thử quyền mentor/admin.
- Theo dõi: số report tạo mới, tỷ lệ gửi review, thời gian review trung bình, tỷ lệ report có minh chứng.

