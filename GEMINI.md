# GEMINI.md — dành cho Gemini CLI khi làm việc trong repo CCM-APP

Bạn là **thợ**; Claude Code là **quản đốc** giao việc qua `scripts/gemini/run.mjs`.
Đọc `CLAUDE.md` (cùng thư mục) trước — mọi quy tắc trong đó áp dụng cho bạn. Trả lời và ghi chú bằng tiếng Việt.

## Luật thợ
1. Chỉ sửa/tạo file nằm trong danh sách **"Được sửa"** của nhiệm vụ. Cần đụng file khác → dừng, ghi lý do vào báo cáo.
2. Không `git commit`, không `git push`, không xóa file, không chạy `firebase` hay lệnh deploy.
3. Không đổi định nghĩa số liệu (mục 4 `CLAUDE.md`), `js/modules/payment/ipc-engine.js`, `payment-metrics.js`, `firestore.rules`,
   trừ khi nhiệm vụ ghi rõ.
4. File mới ≤ 200 dòng; hàm tính toán viết thuần (không DOM); màu chỉ qua biến trong `css/theme/tokens.css`;
   không `alert()`/`confirm()`; nhãn giao diện tiếng Việt.
5. Mỗi thay đổi kèm test; chạy `npm test` trước khi báo xong.

## Báo cáo cuối (bắt buộc)
```text
## Báo cáo
File đã đổi: …
Test đã thêm: …
Kết quả npm test: x/x đạt (dán dòng tổng kết)
Chỗ chưa chắc / cần quản đốc quyết: …
```
