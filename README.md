# BÁCH PREMIUM — SECURE 3D V2

## Những gì đã sửa

- **3 lần đăng nhập sai từ cùng IP trong 30 phút -> khóa IP 30 phút.** Áp dụng cho tài khoản khách và ADMIN. Khóa mọi API (trừ `/api/health`) trong thời gian cấm; trang HTML vẫn có thể tải nhưng không thao tác. IP lưu vào JSONBin dưới dạng HMAC, **không lưu địa chỉ IP nguyên văn**. Khóa vẫn còn khi Render khởi động lại trong khoảng thời gian cấm.
- Kiểm tra IP thật qua `X-Forwarded-For` **chỉ khi** `TRUST_RENDER_PROXY=true` (dùng khi đặt sau Render; local để false). Không tùy tiện bật tùy chọn này tại hosting không đáng tin cậy.
- Xác thực ADMIN tại máy chủ; bí mật JSONBin chỉ ở Environment trên Render.
- Mật khẩu khách được scrypt + salt; so khớp bằng `timingSafeEqual`.
- Phiên đăng nhập HMAC (ADMIN 4 giờ, khách 24 giờ), cookie HttpOnly, Secure ở production, SameSite=Lax; logout thu hồi phiên qua dữ liệu JSONBin.
- CSP không chấp nhận mã JS/CSS inline; mã được tách vào `public/app.js` và `public/styles.css`. Thêm HSTS khi chạy production, chống iframe, hạn chế quyền trình duyệt và cache nhạy cảm.
- Yêu cầu POST cần JSON và `X-BP-Request: 1`, có kiểm tra Origin, chặn yêu cầu giả mạo từ website khác theo cơ chế bảo vệ nhiều lớp.
- Giữ nghiệp vụ sản phẩm, giá, link miễn phí, ví, mã giảm giá, chat, VIP, đơn chờ ADMIN 24 giờ, duyệt/từ chối/hoàn tiền.
- Tùy chọn **xác thực hai bước ADMIN (TOTP)** bằng `ADMIN_TOTP_SECRET` (Base32), chấp nhận chênh lệch thời gian 30 giây, không tái sử dụng mã đã dùng.
- Giao diện trắng 3D, ánh sáng chuyển động, bóng đổ, nút lớn, responsive, hỗ trợ `prefers-reduced-motion`.

## Cập nhật website đang dùng trên Render (KHÔNG xóa dữ liệu JSONBin)

**Trước khi thay, SAO LƯU Bin dữ liệu hiện tại.** Không bật cùng lúc máy chủ local và Render để ghi vào cùng một Bin.

1. Vào repository GitHub `bach-premium-3d` đã nối với Render.
2. Thay file tại gốc repo: `server.js`.
3. Thay file trong thư mục `public`: `index.html`.
4. **Thêm hai file mới** vào thư mục `public`: `app.js` và `styles.css`. **Nếu thiếu, website sẽ không tải được giao diện/chức năng.**
5. Cập nhật `render.yaml` để tự thêm `TRUST_RENDER_PROXY=true` khi sync Blueprint; nếu chưa sync, mở dịch vụ Render > Environment, thêm `TRUST_RENDER_PROXY=true` thủ công trước khi kiểm tra cơ chế khóa IP.
6. Commit các file. Render sẽ triển khai lại nếu Auto Deploy bật. Trên trang dịch vụ, kiểm tra trạng thái `Live` và Logs trước khi mở trang công khai. Dùng Ctrl+F5 nếu cache.
7. Thử tài khoản khách, ADMIN và link miễn phí với IP riêng, KHÔNG thử sai 3 lần trên mạng Wi-Fi dùng chung khi đang phục vụ khách.

**Không thay/mất:** `JSONBIN_BIN_ID`, `JSONBIN_API_KEY`, `ADMIN_USER`, `ADMIN_PASSWORD`, `SESSION_SECRET` trên Render nếu chúng đang cấu hình đúng. Bạn không cần tạo lại Render hay thay JSONBin Bin ID. Khi bí mật đã lộ, phải thu hồi/đổi rồi cập nhật **Environment** trên Render.

## Environment mẫu

```env
PORT=3000
NODE_ENV=development
JSONBIN_KEY_TYPE=access
JSONBIN_BIN_ID=BIN_ID_CUA_BAN
JSONBIN_API_KEY=ACCESS_KEY_MOI_CUA_BAN
ADMIN_USER=TEN_ADMIN_MOI
ADMIN_PASSWORD=MAT_KHAU_RIENG_DAI_TOI_THIEU_12_KY_TU
SESSION_SECRET=CHUOI_NGAU_NHIEN_64_KY_TU
TRUST_RENDER_PROXY=false
ADMIN_TOTP_SECRET=
```

`TRUST_RENDER_PROXY` phải là `true` khi chạy trên Render; file `render.yaml` đã thêm biến đó. Với máy cá nhân, giữ `false`. Nếu đổi `SESSION_SECRET`, tất cả người dùng cần đăng nhập lại; các bản ghi khóa IP cũ sử dụng key HMAC khác nên cơ chế khóa trước đó sẽ không còn được nhận diện.

### Bật 2FA ADMIN (tùy chọn, rất nên bật)

1. Sinh mã bí mật Base32 **trên máy riêng**, không gửi cho người khác; ví dụ lệnh Node.js trong CMD:

```
node -e "const b=require('crypto').randomBytes(20),a='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let n=0,k=0,s='';for(const x of b){n=(n<<8)|x;k+=8;while(k>=5){k-=5;s+=a[(n>>k)&31]}}console.log(s)"
```

2. Vào Render > Environment thêm biến `ADMIN_TOTP_SECRET` là chuỗi Base32 vừa sinh (KHÔNG lưu trong GitHub). Lưu và triển khai lại.
3. Thêm bí mật đó thủ công vào ứng dụng xác thực TOTP của bạn, tên tài khoản có thể là `BACH PREMIUM - Admin`. Đảm bảo đồng hồ điện thoại được đồng bộ.
4. Khi đăng nhập ADMIN, nhập thêm mã 6 chữ số trong ô "Mã xác thực 2 bước". Khi chưa đặt biến `ADMIN_TOTP_SECRET`, ô này không bắt buộc.
5. Cất mã khôi phục/secret trong nơi an toàn. Nếu mất thiết bị 2FA, phải dùng quyền Render Environment để thiết lập lại secret (không có nút bypass trên website).

## Cảnh báo khi triển khai bán hàng thật

- **Không có bảo mật 100%.** JSONBin là một bản ghi JSON dùng chung. Hệ thống chỉ đồng bộ ghi bên trong **một tiến trình Node**. Nếu mở nhiều instance hoặc đồng thời chạy local+Render, vẫn có nguy cơ tranh chấp dữ liệu ví/đơn. Hãy chuyển giao dịch, số dư, đơn hàng sang cơ sở dữ liệu giao dịch có ràng buộc và backup thường xuyên (PostgreSQL) trước khi xử lý tiền thật.
- Cơ chế khóa IP có thể ảnh hưởng nhiều người dùng chung IP (Wi-Fi, mạng di động/NAT). Có thể bị kẻ khác lạm dụng để làm gián đoạn đăng nhập; cân nhắc captcha/giới hạn theo tài khoản/Edge WAF khi số khách tăng.
- Đối với Render Free, tiến trình ngủ khi không có lượt truy cập. Trạng thái khóa IP đã nằm trong JSONBin nên có thể tiếp tục sau khi khởi động lại; nhưng nếu JSONBin gián đoạn, toàn trang có thể không sẵn sàng.
- Nếu mật khẩu khách từng lưu trực tiếp trong phiên bản cũ hay bản sửa trên JSONBin, các phiên bản dữ liệu trước đó có thể chứa mật khẩu thô. Người dùng nên đổi mật khẩu đã dùng lại ở nơi khác.
- Nên thực hiện kiểm thử bảo mật độc lập, thử khôi phục bản backup và thiết lập chính sách hỗ trợ hoàn tiền trước khi vận hành với khách thật.

## Kiểm thử đã thực hiện

- `node --check server.js` và `node --check public/app.js`: pass.
- 24 kiểm thử API bằng JSONBin mô phỏng: đăng ký/đăng nhập, 3 lần sai khóa IP, khác IP vẫn đăng nhập, khóa sau restart, phân quyền, cookie thu hồi, yêu cầu giả mạo, đặt/duyệt đơn, ví, link bàn giao: pass.
- 4 kiểm thử xác thực 2 bước: thiếu OTP, mã sai, mã đúng, dùng lại OTP: pass.
- Kiểm tra hiển thị trang chủ và màn hình ADMIN đăng nhập bằng trình duyệt không tải dữ liệu thật: pass. Ảnh preview chỉ dùng dữ liệu giả.
- Chưa thực hiện kiểm thử tải lớn hoặc kiểm thử xâm nhập độc lập; chưa kết nối thực tế với Bin của bạn trong các thử nghiệm này.


## Tệp đính kèm và nhạc
- ADMIN có thể đính kèm một tệp trong form đăng sản phẩm, link miễn phí hoặc thông báo; chọn tệp, thư viện ảnh hoặc camera trên thiết bị hỗ trợ.
- Tệp tối đa 32 KB. Ảnh gốc tối đa 12 MB, được thu nhỏ thành JPEG trước khi gửi. Kho JSONBin không phải dịch vụ lưu tệp: từ chối bài đính kèm nếu bản ghi vượt 90.000 byte; dùng link lưu trữ ngoài cho tệp lớn.
- Ảnh/tệp sản phẩm và thông báo công khai; không tải thông tin đăng nhập hoặc bí mật bàn giao vào đây. Tệp miễn phí yêu cầu đăng nhập.
- Acc có đơn approved/sold ẩn khỏi cửa hàng, vẫn giữ trong quản trị và lịch sử để bảo toàn thông tin đơn.
- YouTube được yêu cầu tự phát có tiếng và lặp video. Chính sách trình duyệt có thể yêu cầu tương tác: thử lại khi chạm/phím trước lần phát đầu tiên. Khi nhạc đã phát, nút tạm dừng của người dùng được tôn trọng.
