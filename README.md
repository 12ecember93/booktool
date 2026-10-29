# Get images to PDF tool

Công cụ trích URL ảnh từ danh sách/Console/HTML, tải ảnh, ghép PDF và đóng gói ZIP.

## Xuất bản frontend
- GitHub Actions xuất bản thư mục `frontend` lên GitHub Pages.
- Vào Settings → Pages và chọn GitHub Actions nếu GitHub chưa tự cấu hình.

## Backend
- Backend được cấu hình qua `render.yaml`, thư mục gốc `backend`.
- Khi tạo dịch vụ trên Render, đặt biến môi trường `BOOKTOOL_PASSWORD` bằng passcode riêng; không ghi passcode vào GitHub.
- Đặt `FRONTEND_ORIGIN` thành `https://12ecember93.github.io`.
- Dán URL dịch vụ Render vào trường Backend API URL trên website.
- Người dùng nhập passcode ngay trước khi tạo/tải ZIP. Backend kiểm tra passcode; passcode không được nhúng trong frontend và ô nhập được xóa sau mỗi lần thử.

## Lưu ý
GitHub Pages chỉ host frontend tĩnh. Backend cần được deploy riêng và cấu hình biến môi trường bí mật. Website nguồn có thể chặn tải hoặc yêu cầu cookie/đăng nhập; công cụ không sử dụng phiên đăng nhập của trình duyệt.