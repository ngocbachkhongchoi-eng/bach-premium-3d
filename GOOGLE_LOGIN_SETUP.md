# Bật đăng nhập Google trên Render

Mã đã hỗ trợ đăng nhập Google. Không cần cài thư viện npm mới. Khi chưa có đủ cấu hình, nút Google bị vô hiệu hóa; đăng nhập bằng tài khoản/mật khẩu vẫn hoạt động.

1. Trong Google Cloud Console, chọn dự án do bạn sở hữu, cấu hình Google Auth Platform (Branding / Audience / Data Access) với các quyền cơ bản OpenID, email, profile. Nếu ứng dụng đang ở chế độ Testing, thêm email thử nghiệm; chuyển sang Production khi sẵn sàng cho khách dùng.
2. Tạo OAuth client loại **Web application**.
3. Thêm **Authorized redirect URI** chính xác:
   `https://bach-premium-3d.onrender.com/api/auth/google/callback`
4. Trong Render → dịch vụ bach-premium-3d → Environment, thêm:
   - `GOOGLE_CLIENT_ID`: Client ID của OAuth client.
   - `GOOGLE_CLIENT_SECRET`: Client Secret, nhập riêng trong Render; không gửi qua chat, không commit Git.
   - `GOOGLE_REDIRECT_URI`: `https://bach-premium-3d.onrender.com/api/auth/google/callback`
5. Lưu và triển khai lại. Mở Đăng nhập → Tiếp tục với Google. Đăng nhập lần đầu tạo tài khoản khách riêng, số dư 0. Các lần sau cùng tài khoản Google dùng lại cùng tài khoản và số dư.

Nếu dùng tên miền riêng, cập nhật redirect URI ở cả Google Console và Render. Không thay bằng URL nhận từ người dùng hay HTTP Host header.

## Phân quyền và kiểm thử

- Google không cấp quyền ADMIN và không tự ghép với tài khoản dùng mật khẩu trùng email.
- Liên kết danh tính bằng Google subject ID, không bằng tên hiển thị.
- Authorization code được đổi tại máy chủ với Client Secret và PKCE; callback kiểm tra state gắn cookie HttpOnly có chữ ký và hạn 10 phút.
- Quyền khách chỉ được tạo sau khi Google userinfo trả danh tính hợp lệ với email đã xác minh.
- `node --test tests/*.test.js` kiểm tra state sai, cookie sửa, state hết hạn, PKCE và email chưa xác minh qua dịch vụ Google mô phỏng.
- Chưa có OAuth client thật trong môi trường kiểm thử, nên chưa xác minh đăng nhập Google trực tiếp.
