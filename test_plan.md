# Kế Hoạch Kiểm Thử Toàn Diện Hệ Thống CCM (Comprehensive Test Plan)

Tài liệu này cung cấp kịch bản kiểm thử (Test Scenarios) và các Test Case chi tiết để Sếp thực hiện kiểm tra độ ổn định, tính toàn vẹn dữ liệu (SSOT) và trải nghiệm UI/UX của toàn bộ ứng dụng CCM.

---

## 🎯 1. Mục Tiêu & Tiền Đề Kiểm Thử
- **Mục tiêu:** Đảm bảo toàn bộ 7 Module (Budget, Tender, Contract, Cashflow, Payment, VO, Final) liên thông dữ liệu hoàn hảo, không có bug crash, và đáp ứng chuẩn UI/UX Compact Header.
- **Tiền đề (Prerequisites):** 
  - Mở hệ thống trên trình duyệt (Chrome/Edge/Safari).
  - Khuyến nghị xóa sạch dữ liệu cũ để test một luồng hoàn toàn mới: Nhấn `F12` -> Mở tab `Application` -> `Local Storage` -> Xóa toàn bộ dữ liệu có tiền tố `ccm_` -> Nhấn `F5` tải lại trang.

---

## 🛤️ 2. Kịch Bản Kiểm Thử End-to-End (E2E Scenarios)

Sếp hãy thực hiện tuần tự các kịch bản sau để mô phỏng một vòng đời dự án thực tế.

### Kịch Bản 1: Khởi tạo Dự án & Lập Ngân sách
**Mục đích:** Kiểm tra khả năng tạo dự án mới và thiết lập Master Budget.
- **Bước 1:** Tại thanh Topbar, nhấn nút `[+]` để tạo Dự án mới (Ví dụ: "Dự án Alpha").
- **Bước 2:** Chọn "Dự án Alpha" từ Dropdown Topbar. Nhấn vào nút `(i)` để kiểm tra Modal Tóm tắt Dự án có hiển thị đúng thông tin không.
- **Bước 3:** Vào Tab 1 (Budget), nhấn **Tạo Ngân sách** (hoặc Import Excel). Tạo 1 mục "Xây dựng phần thô" (10 tỷ) và 1 mục "Dự phòng" (Contingency - 2 tỷ).
- **Kỳ vọng:** Tổng Ngân sách hiển thị trên Topbar Badge phải cập nhật ngay lập tức thành 12 tỷ. Các thẻ KPI ở Tab Budget hiển thị chính xác.

### Kịch Bản 2: Đấu thầu & Ký Hợp đồng (Tender to Contract)
**Mục đích:** Kiểm tra luồng chuyển đổi từ Ngân sách -> Gói thầu -> Hợp đồng.
- **Bước 1:** Ở Tab 1, tại dòng "Xây dựng phần thô", nhấn icon **Búa đấu thầu** để chuyển sang Tab 2 (Tender).
- **Bước 2:** Tại Tab 2, hoàn thiện thông tin Gói thầu, thiết lập trạng thái thành "Awarded" (Đã trao thầu).
- **Bước 3:** Nhấn icon **Chuyển thành Hợp đồng** để sang Tab 3 (Contract). Tạo Hợp đồng mới với giá trị 9.5 tỷ.
- **Kỳ vọng:** Tại Tab 3, Hợp đồng mới xuất hiện với trạng thái "Active". Tại Tab 1, "Committed Cost" của dòng "Xây dựng phần thô" phải tự động cập nhật thành 9.5 tỷ.

### Kịch Bản 3: Quản lý Thanh toán & Phát sinh (VO & Payment)
**Mục đích:** Kiểm tra sự liên thông của SSOT đối với Chi phí Phát sinh và Hồ sơ Thanh toán.
- **Bước 1 (Tạo VO):** Vào Tab 6 (VO). Nhấn **Tạo VO**. Chọn Hợp đồng vừa tạo. Điền số tiền phát sinh là 500 triệu. Đặt trạng thái là `Approved`.
- **Kỳ vọng 1:** Quay lại Tab 3, "Revised Contract Value" của Hợp đồng phải là 10 tỷ (9.5 + 0.5). Quay lại Tab 1, "Committed Cost" phải là 10 tỷ.
- **Bước 2 (Tạo IPC):** Vào Tab 1 (Budget) -> Nhấn nút **Initiate Payment** -> Chọn Hợp đồng -> Nhập số tiền thanh toán là 2 tỷ.
- **Kỳ vọng 2:** Mở Tab 5 (Payment) -> Hồ sơ 2 tỷ xuất hiện. Mở Layer 2 (Bảng chi tiết IPC) -> Sidebar tự động thu gọn. Phê duyệt (Approve) và Xác nhận đã chuyển tiền (Paid). Quay lại Tab 1 -> Cột "Expended" cập nhật thành 2 tỷ.

### Kịch Bản 4: Quyết toán & Đóng Hợp đồng (Final Statement)
**Mục đích:** Kiểm tra quy trình kết thúc hợp đồng và hoàn trả ngân sách dư thừa.
- **Bước 1:** Vào Tab 7 (Final Statement). Nhấn **Tạo Quyết toán**.
- **Bước 2:** Chọn Hợp đồng (hiện đang có giá trị Revised là 10 tỷ). Điền số tiền chốt Quyết toán cuối cùng là 9.8 tỷ. (Dư 200 triệu).
- **Bước 3:** Phê duyệt (Approve) Quyết toán.
- **Kỳ vọng:** 
  1. Hợp đồng ở Tab 3 bị đổi trạng thái thành `Closed`.
  2. Ở Tab 6 (VO), mở popup Tạo VO -> Hợp đồng này **KHÔNG CÒN** xuất hiện trong danh sách chọn.
  3. Ở Tab 1 (Budget), hạng mục "Dự phòng" (Contingency) tự động được cộng thêm 200 triệu (từ phần dôi dư hoàn trả lại).

---

## 🧪 3. Danh Sách Test Case Chi Tiết (Matrix)

| ID | Khu Vực | Hành Động (Action) | Kết Quả Kỳ Vọng (Expected Result) | Trạng Thái |
|:---|:---|:---|:---|:---|
| **TC-01** | **Global UI** | Bấm Dropdown chọn dự án ở Topbar | Toàn bộ dữ liệu của tất cả các Tab đổi sang dự án mới. Giao diện mượt mà, không giật lag. | ⬜ |
| **TC-02** | **Global UI** | Cuộn trang xuống dưới cùng | Thanh Topbar (56px) luôn bám sát đỉnh màn hình (Sticky top). | ⬜ |
| **TC-03** | **Global UI** | Tải lại trang (F5) | Toàn bộ dữ liệu (Budget, Hợp đồng, Thanh toán...) giữ nguyên, không bị mất (Test Persistence). | ⬜ |
| **TC-04** | **Tab Payment** | Bấm "Xem danh sách IPC" (Mở Layer 2) | Bảng Layer 2 mở ra, Sidebar tự động thu gọn (`collapseSidebar`). Lề trái bảng cách Sidebar chuẩn `px-6`. | ⬜ |
| **TC-05** | **Tab Payment** | Bấm "Quay lại Dashboard" (Đóng Layer 2)| Dashboard Layer 1 hiện ra, Sidebar tự động mở lại (`expandSidebar`). | ⬜ |
| **TC-06** | **Tab Budget** | Mở form Initiate Payment, điền 100tr, Save | Ở Tab 5 (Payment) xuất hiện một IPC trị giá 100tr với trạng thái "Approved". | ⬜ |
| **TC-07** | **Tab VO** | Tạo một VO "Pending" trị giá 1 tỷ | Tab 3 (Contract Value) và Tab 1 (Committed Cost) **KHÔNG TĂNG** (Vì chưa Approved). Biểu đồ Doughnut ở Tab 6 hiển thị màu Vàng. | ⬜ |
| **TC-08** | **Tab VO** | Đổi VO "Pending" thành "Approved" | Tab 3 và Tab 1 lập tức được cộng dồn 1 tỷ. Biểu đồ Doughnut Tab 6 chuyển màu Xanh. | ⬜ |
| **TC-09** | **Tab Final** | Tạo và Approve Final Statement cho Hợp đồng A | Trạng thái Hợp đồng A chuyển thành "Closed". Nút tạo IPC và Tạo VO ẩn Hợp đồng A khỏi Dropdown. | ⬜ |
| **TC-10** | **Tab Final** | Final Statement có giá trị < Revised Contract | Số dư (Delta) tự động được cộng dồn ngược lại vào dòng Ngân sách "Contingency" (Dự phòng) ở Tab 1. | ⬜ |

> [!TIP]
> **Hướng dẫn thực hiện Test:** Sếp có thể in hoặc chia đôi màn hình. Thực hiện từng bước E2E Scenarios trước, sau đó tick kiểm tra các Test Case chi tiết để đảm bảo không bỏ sót bất kỳ luồng dữ liệu nào. Nếu phát hiện lỗi (Fail) ở bất kỳ Test Case nào, sếp cứ báo lại mã ID (VD: Lỗi TC-04) để em fix ngay lập tức.
