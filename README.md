# BÁCH PREMIUM 3D — triển khai Render (Node.js + JSONBin)

## Đã chuẩn bị
- `public/index.html`: website 3D, trang mua hàng/miễn phí và ADMIN.
- `server.js`: Node HTTP server và API. JSONBin Access Key chỉ đọc tại backend.
- `render.yaml`: Render Blueprint cấu hình website + backend cùng dịch vụ.
- `package.json`: lệnh `npm start`; không có thư viện ngoài.
- `.env.example`: mẫu điền thông tin để chạy LOCAL. **Không tải file `.env` lên GitHub.**

## Lên internet bằng Render + GitHub
1. Đăng ký/đăng nhập **GitHub** tại https://github.com. Tạo repository **Private** mới (nếu chưa biết cách, dùng nút **New repository**).
2. Giải nén ZIP. Trong repository chọn **Add file → Upload files**, tải tất cả file và cả thư mục `public` trong `BACH_PREMIUM_DEPLOY_RENDER` (bảo đảm `render.yaml`, `server.js`, `package.json` nằm tại **gốc** repo). Không tải `.env`.
3. Đăng nhập **Render** tại https://dashboard.render.com. Kết nối GitHub nếu được yêu cầu. Vào **New → Blueprint**, chọn repo vừa tạo. Render sẽ đọc `render.yaml`.
4. Khi Render yêu cầu biến môi trường, điền **JSONBIN_BIN_ID**, **JSONBIN_API_KEY**, **ADMIN_USER**, **ADMIN_PASSWORD**. Không điền các khóa vào GitHub. `SESSION_SECRET` được Render tự tạo.
5. Duyệt lại gói dịch vụ trước khi xác nhận. File blueprint đặt gói **Free** để thử nghiệm, không phải máy chủ 24/7. Với nhu cầu bán hàng liên tục, đổi sang instance có phí `0.5c-512mb` theo mức giá Render tại thời điểm đăng ký.
6. Bấm **Deploy** / **Apply**, kiểm tra nhật ký. Khi trạng thái **Live**, mở URL dạng `https://<ten-dich-vu>.onrender.com` mà Render cung cấp (không dùng `localhost`).
7. Kiểm tra `https://<ten-dich-vu>.onrender.com/api/health` hiển thị JSON `{"ok":true,...}`; đăng nhập ADMIN, kiểm tra thêm/sửa đơn, chat, ví, link miễn phí bằng tài khoản thử.

> Chú ý: Render Free ngủ sau 15 phút không truy cập và có thể cần gần 1 phút để thức dậy; không phù hợp môi trường bán hàng thực tế. Không có gói miễn phí nào ở đây được cam kết chạy 24/7. Giá gói trả phí tham khảo tại https://render.com/pricing.

## Bảo mật & dữ liệu
- **Đổi mật khẩu ADMIN và SESSION_SECRET đã lộ trên ảnh trước đó.** Đổi/thu hồi mọi JSONBin Key từng nhúng trong HTML hoặc chia sẻ. Dùng Access Key mới chỉ có quyền **Bins > Read + Update**; gán quyền truy cập phù hợp với Bin của bạn.
- Không đăng `.env`, JSONBin Key, mật khẩu ADMIN, file sao lưu có dữ liệu khách lên repo hay chia sẻ với người khác.
- **Đừng để máy chủ cục bộ và Render cùng cập nhật một Bin:** JSONBin được dùng như một record JSON chung, các cập nhật đồng thời từ 2 server có nguy cơ ghi đè. Sau khi deploy xong, đóng `START_WINDOWS.bat` trên máy tính và chỉ dùng website Render.
- Sao lưu dữ liệu JSONBin trước khi đưa khách dùng thật. Mã cũ có chuyển mật khẩu plaintext sang hash, nhưng mật khẩu đã lộ trong lịch sử cần được thay mới.
- Hệ thống này là **website thử nghiệm**, chưa có cổng thanh toán, chưa có hệ thống khôi phục mật khẩu, tự động sao lưu hoặc kiểm thử bảo mật độc lập. Không nhận tiền khách thật trước khi các khâu đó được hoàn thiện.

## Nếu không dùng Blueprint
Trong Render, chọn **New → Web Service** → kết nối GitHub repo → Language: `Node` → Build: `npm install --omit=dev` → Start: `npm start` → Environment: `NODE_ENV=production`, `JSONBIN_KEY_TYPE=access`, `JSONBIN_BIN_ID`, `JSONBIN_API_KEY`, `ADMIN_USER`, `ADMIN_PASSWORD`, `SESSION_SECRET`. Chọn region Singapore nếu có. Nhớ lưu secret trong **Environment**, không đưa vào code.

## Chạy local và test
```bash
npm start
```
Chạy local cần `.env`, xem `.env.example`.

## Liên kết tài liệu chính thức
- https://render.com/docs/your-first-deploy
- https://render.com/docs/infrastructure-as-code
- https://render.com/docs/free
