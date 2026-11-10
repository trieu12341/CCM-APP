// Nội dung tab Hướng dẫn (phần 1: bắt đầu → hợp đồng). Mỗi mục: id, tiêu đề, menu để mở tab, các khối HTML ngắn.
// Viết theo đúng tên nút trên giao diện; đổi giao diện thì sửa ở đây (test tests/guide.test.js kiểm id menu còn tồn tại).
export const GUIDE_1 = [
    {
        id: 'gioi-thieu', title: 'App dùng để làm gì', icon: 'fa-compass',
        html: `<p>CCM-APP giúp phòng QS <b>quản lý và theo dõi</b> chi phí – hợp đồng của dự án ở một chỗ, thay cho nhiều file Excel rời.
            Chứng từ (chứng chỉ IPC, hồ sơ VO…) vẫn do tư vấn / nhà thầu lập; app ghi lại số đã xác nhận, tự tính 16 dòng CERT để đối chiếu,
            và tổng hợp lên Tổng quan, Dòng tiền, Quyết toán.</p>
            <div class="guide-flow"><span>Ngân sách</span><span>Đấu thầu</span><span>Hợp đồng</span><span>Thanh toán (IPC)</span><span>Phát sinh (VO)</span><span>Dòng tiền</span><span>Quyết toán</span></div>
            <p class="guide-tip">Nhập theo đúng thứ tự trên cho dự án mới: hợp đồng phải gắn mã ngân sách, IPC và VO phải gắn hợp đồng — thì các bảng tổng hợp mới đúng.</p>`,
    },
    {
        id: 'bat-dau', title: 'Bắt đầu: đăng nhập và chọn dự án', icon: 'fa-right-to-bracket',
        html: `<ol>
            <li><b>Đăng ký / đăng nhập</b> bằng email và mật khẩu. Tài khoản mới ở trạng thái <i>Chờ duyệt</i> — nhờ Admin cấp quyền
                (<i>User (QS – xem &amp; sửa)</i> hoặc <i>Manager (chỉ xem)</i>) rồi đăng nhập lại.</li>
            <li><b>Chọn dự án</b> ở ô chọn trên thanh trên cùng. Hai nút nhỏ bên cạnh: <i>Thêm dự án mới</i> và <i>Thông tin dự án</i> (xem / sửa tên, địa điểm…).</li>
            <li>Nút <i class="fa-solid fa-moon"></i> đổi giao diện sáng / tối.</li>
            <li>Huy hiệu bên phải thanh trên cùng cho biết dữ liệu đã lên máy chủ chưa:
                <span class="guide-badge">Đã lưu</span> <span class="guide-badge">Đang lưu…</span>
                <span class="guide-badge">Chờ đồng bộ</span> (mất mạng — vẫn làm tiếp được, có mạng lại sẽ tự gửi)
                <span class="guide-badge is-bad">Lỗi lưu</span> (thường do mất quyền hoặc trùng sửa — app hiện thông báo kèm lý do).</li>
        </ol>`,
    },
    {
        id: 'ngan-sach', title: 'Ngân sách', icon: 'fa-wallet', menu: 'menu-budget',
        html: `<p>Ngân sách là khung của cả dự án: mỗi <b>hạng mục / gói</b> có mã ngân sách, phân loại (Tư vấn, Xây dựng, Dự phòng) và giá trị duyệt.</p>
            <ol>
            <li>Bấm <b>Bảng Chi Tiết Phân Bổ Ngân Sách</b> để mở danh sách.</li>
            <li><b>+ Thêm Hạng Mục Ngân Sách</b> để nhập từng dòng, hoặc <b>Import Excel</b> để nạp cả bảng có sẵn.</li>
            <li>Dùng ô lọc để tìm theo mã / tên; <b>Bỏ lọc (Reset)</b> để xem lại tất cả.</li>
            </ol>
            <p class="guide-tip">Mã ngân sách nên thống nhất với cost plan (vd. <code>102-01</code>). Hợp đồng gắn đúng mã thì cột "đã cam kết / còn lại" của ngân sách mới đúng.</p>`,
    },
    {
        id: 'dau-thau', title: 'Đấu thầu và so sánh giá (CBA)', icon: 'fa-gavel', menu: 'menu-tender',
        html: `<ol>
            <li><b>+ Tạo Gói thầu mới</b>, chọn hạng mục ngân sách tương ứng.</li>
            <li>Mở gói thầu → <b>+ Khởi tạo Bảng CBA</b> → <b>+ Thêm Nhà thầu</b>, <b>+ Thêm Hạng mục</b>; hoặc <b>Import CBA từ Excel</b>.</li>
            <li>Nhiều vòng chào giá: <b>+ Thêm Đợt Nộp Thầu</b>. Sửa xong bấm <b>Lưu Cập Nhật</b>.</li>
            <li>Chọn được nhà thầu: <b>🏆 Chốt Chọn Nhà Thầu</b> → <b>Chuyển sang Hợp đồng</b> (tạo sẵn hợp đồng với giá trúng thầu).</li>
            </ol>
            <p>Bảng <b>Bảng Chi Tiết Tiến Độ Đấu Thầu</b> cho thấy gói nào đang chào giá, gói nào đã chốt.</p>`,
    },
    {
        id: 'hop-dong', title: 'Hợp đồng', icon: 'fa-file-signature', menu: 'menu-contract',
        html: `<ol>
            <li><b>+ Tạo Hợp đồng</b> (hoặc <b>Import Hợp đồng</b> từ Excel; hoặc từ gói thầu đã chốt).</li>
            <li>Điền <i>Mã Hợp đồng, Nhà thầu, Loại Hợp đồng, Mã ngân sách, Giá trị ban đầu, Ngày ký HĐ</i>.</li>
            <li>Với hợp đồng thi công, nhập <b>tham số thanh toán</b> theo điều kiện HĐ: % Tạm ứng, % Thu hồi tạm ứng (và tính trên gì),
                % Giữ lại bảo hành, trần giữ lại, % VAT. Các IPC sau sẽ tính theo đúng các tham số này.</li>
            <li>Lịch dòng tiền dự kiến của HĐ: <b>⚡ Tự động tạo</b> rồi chỉnh tay từng tháng nếu cần.</li>
            <li>Bấm <b>Lưu Hợp đồng</b>.</li>
            </ol>
            <p class="guide-tip"><b>Giá trị hợp đồng không tự cộng VO.</b> VO đã duyệt chỉ cộng vào giá trị quyết toán (Gốc + VO) và dòng (2)/(3) của CERT.</p>
            <p>Chọn nhiều HĐ trong danh sách rồi <b>Xóa HĐ đã chọn</b> để xóa hàng loạt — với dự án đã chuyển dữ liệu, HĐ xóa nằm trong <b>Thùng rác</b> 30 ngày và khôi phục được.</p>`,
    },
];
