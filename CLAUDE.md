# CLAUDE.md — CCM-APP (Cost & Contract Management)

Đọc file này trước khi sửa code. Viết, trả lời và ghi chú bằng tiếng Việt.

## 1. App làm gì
Web app nội bộ cho QS quản lý chi phí & hợp đồng dự án xây dựng. Luồng chính:
**Ngân sách → Đấu thầu → Hợp đồng → Dòng tiền → Thanh toán (IPC) → Phát sinh (VO) → Quyết toán.**
Kế hoạch phát triển 4 giai đoạn (dữ liệu đáng tin → duyệt & chứng từ → báo cáo chi phí → nhanh hơn Excel)
nằm ở tài liệu kế hoạch của chủ repo; mỗi bước có mã (1.1, 1.2…) và kịch bản test (T1.01…).

## 2. Công nghệ
- JavaScript thuần, ES module, không bundler. `index.html` nạp `js/app.js`; HTML từng vùng nằm trong `components/*.html`.
- Firebase compat v10 (Auth email/mật khẩu + Firestore), nạp từ CDN gstatic. Cấu hình ở `js/firebase-config.js`.
- ApexCharts (biểu đồ), SheetJS 0.20.3 (đọc Excel).
- Deploy: Firebase Hosting qua GitHub Actions (`.github/workflows/`). Rules: `firestore.rules`, deploy bằng workflow riêng.
- Hai môi trường: **bản thật** `cost-contract-management` (mặc định) và **staging** `ccm-staging-15ddd`. Cấu hình ở `js/firebase-env.js`;
  app chỉ dùng staging khi chạy trên tên miền staging hoặc mở với `?env=staging` (có dải cảnh báo STAGING). Đưa nhánh lên staging:
  Actions → "Deploy STAGING" (chạy tay, cần secret `FIREBASE_SERVICE_ACCOUNT_STAGING`). Thử chuyển đổi dữ liệu/rules trên staging trước, không thử trên bản thật.

## 3. Bản đồ thư mục
| Thư mục | Vai trò |
| --- | --- |
| `js/core/` | khởi động app, đăng nhập (`app-init.js`, `login-ui.js`), nạp dữ liệu + đồng bộ realtime (`app-data.js`, `realtime-sync.js`, `project-merge.js`), lưu (`data-store.js`) |
| `js/db-service.js` | đọc/ghi Firestore (hiện: mỗi dự án 1 bản ghi `projects/{id}` chứa các mảng) |
| `js/data/` | lớp dữ liệu mới của Giai đoạn 1 (`repo.js`, `audit-diff.js`) — **chưa nối vào app** |
| `js/budget/`, `js/tender/`, `js/contract/`, `js/cashflow/`, `js/project/` | từng tab |
| `js/modules/payment/` | IPC: `ipc-engine.js` (16 dòng CERT), `ipc-chain.js` (chuỗi đợt), `ipc-fs-parser.js` (import sheet FS), `payment-metrics.js` (mọi con số tổng hợp) |
| `js/modules/vo/`, `js/modules/final/`, `js/modules/overview/` | VO, Quyết toán, Tổng quan |
| `js/utils/` | định dạng số, làm sạch dữ liệu trước khi ghi Firestore, thông báo lỗi |
| `css/theme/` | biến màu (`tokens.css`), bố cục, thành phần — lớp theme nạp sau cùng |
| `tests/` | unit test (`*.test.js`), E2E (`tests/e2e/`), test lớp dữ liệu (`tests/data/`) |

## 4. Định nghĩa số liệu — KHÔNG được đổi khi chưa có yêu cầu
- IPC xây dựng = 16 dòng CERT trong `ipc-engine.js`. Mặc định: giữ lại 10% trên giá trị gộp đến nay, thu hồi tạm ứng theo khối lượng thực hiện (có trần = số tạm ứng), VAT 8% trên giá trị gộp kỳ này; cấu hình được theo từng HĐ.
- Test "IPC mẫu vàng": IPC#1–4 gói Main Works phải khớp file Excel gốc tới từng đồng (dòng 16 IPC4 = 2.391.377.432).
- `payment-metrics.js`: Đã thực hiện = giá trị gộp đến nay của IPC đã duyệt; `paymentExVat` = tạm ứng + Σ dòng (14). Dashboard & dòng tiền dùng số trước thuế, gồm tạm ứng.
- **VO đã duyệt KHÔNG cộng vào giá trị hợp đồng**; chỉ vào giá trị quyết toán (Gốc + VO) và dòng (2)/(3) của CERT.
- Tiền làm tròn đến đồng; phần trăm hiển thị 2 số lẻ.

## 5. Quy ước code & giao diện
- File mới ≤ 200 dòng; tách theo trách nhiệm. Hàm tính toán viết thuần (không DOM) để test bằng Node.
- Nhãn giao diện tiếng Việt; thuật ngữ quen dùng (IPC, VO, TƯ, Retention) giữ nguyên.
- Màu chỉ qua biến trong `css/theme/tokens.css`; không viết mã màu cứng. Biểu đồ dùng tên màu ngữ nghĩa
  (`'plan' | 'submitted' | 'approved' | 'paid' | 'negative' | 'track' | 'soft' | 'hard' | 'contingency'`), xem `js/theme-toggle.js`.
- Không dùng `alert()` / `confirm()` cho code mới.
- Mọi dữ liệu ghi Firestore đi qua `cleanForFirestore` (không `undefined`, không `NaN`, không mảng lồng).
- Thư viện qua CDN phải ghi phiên bản cố định.

## 6. Chạy test
```bash
npm test              # unit test (node --test), nhanh, chạy mọi lúc
npm run test:data     # lớp dữ liệu js/data/ trên Firestore giả trong bộ nhớ
npm run test:data:emulator  # cùng bộ đó trên Firestore Emulator thật (cần Java; CI chạy)
npm run test:e2e      # E2E Playwright toàn luồng + đăng nhập + dữ liệu bản cũ (cần Chromium)
npm run test:all      # cả ba
```
CI (`.github/workflows/ci.yml`): đẩy lên nhánh bất kỳ → unit + lớp dữ liệu; PR/merge vào `develop` hoặc `master`
→ toàn bộ, kể cả lớp dữ liệu trên Firestore Emulator thật. `master` chỉ deploy khi toàn bộ test đạt.

## 7. Quy tắc làm việc
- Làm trên nhánh `gdX/bYY-ten-ngan` tách từ `develop`; mở PR vào `develop`. Không đẩy thẳng `master`.
- Mỗi thay đổi kèm test cho chính nó; chạy toàn bộ bộ hồi quy trước khi báo xong.
- Không xóa dữ liệu người dùng; thay đổi cấu trúc dữ liệu phải có đường chuyển đổi chạy thử trước.
- Commit message tiếng Việt, mô tả theo hành vi người dùng thấy.

## 8. Mẫu báo cáo sau mỗi bước
```text
Bước: <số + tên>         Nhánh/PR: <link>
Đã đổi: <3–5 gạch đầu dòng, theo hành vi người dùng thấy>
Test mới: <tên test ↔ mã kịch bản T…>
Bộ hồi quy: unit x/x · IPC mẫu 4/4 · E2E x/x · đăng nhập x/x · lớp dữ liệu x/x
Cần bạn kiểm tay trên staging: <kịch bản + các bước bấm>
Rủi ro / chưa làm: <nếu có>
```
