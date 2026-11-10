// Nội dung tab Hướng dẫn (phần 2: IPC → quản trị, câu hỏi thường gặp).
export const GUIDE_2 = [
    {
        id: 'ipc', title: 'Thanh toán (IPC)', icon: 'fa-money-check-dollar', menu: 'menu-payment',
        html: `<p>App ghi lại từng đợt thanh toán theo số tư vấn đã xác nhận và <b>tự tính 16 dòng CERT</b> (giữ lại, thu hồi tạm ứng, VAT…) theo tham số của hợp đồng — dùng để đối chiếu với chứng chỉ của tư vấn.</p>
            <ol>
            <li>Mở <b>Danh sách Tổng hợp Hồ sơ Thanh toán</b> → <b>Tạo Hồ sơ Thanh toán Mới (IPC)</b>, chọn hợp đồng.</li>
            <li>Đợt tạm ứng: nhập <i>Số tiền tạm ứng kỳ này</i>. Đợt thường: nhập <i>Giá trị Khối lượng</i> lũy kế theo chứng chỉ, phát sinh thực hiện (6), phạt (12), tạm giữ (13) nếu có; ngày đệ trình, ngày đánh giá, hạn thanh toán.</li>
            <li>Xem 16 dòng app tính; <b>so dòng (16) với chứng chỉ của tư vấn</b>. Lệch thì kiểm lại số nhập hoặc tham số HĐ.</li>
            <li>Khi chủ đầu tư duyệt: <b>Phê duyệt IPC</b>. Khi đã chuyển tiền: <b>Xác nhận Đã Chuyển Tiền</b> — số này vào Dòng tiền và Tổng quan.</li>
            </ol>
            <h4>Khóa số</h4>
            <p>IPC <i>Đã Phê duyệt</i> hoặc <i>Đã Thanh toán</i> bị <b>khóa</b>: không sửa, không xóa, các đợt sau tính lại cũng không làm đổi số của nó.
            Cần sửa thì bấm <b>Mở khóa</b> và ghi lý do (lưu vào nhật ký) — IPC về Nháp. Nếu đợt trước bị sửa làm lệch số "đã xác nhận các kỳ trước" (11),
            các IPC đã khóa phía sau hiện dải <b>⚠ Cần xem lại</b>.</p>`,
    },
    {
        id: 'vo', title: 'Phát sinh (VO)', icon: 'fa-code-branch', menu: 'menu-vo',
        html: `<ol>
            <li><b>Tạo Phát sinh VO Mới</b>: chọn hợp đồng, <i>Tên Phát sinh</i>, lý do, ngày nộp hồ sơ.</li>
            <li>Ghi <b>số nhà thầu đề xuất</b> và <b>số QS đánh giá</b> (giá trị duyệt) riêng — app dùng số QS để tổng hợp.</li>
            <li>Trạng thái <i>Pending</i> khi đang xét; chuyển <i>Approved</i> khi chủ đầu tư duyệt (có ngày đánh giá).</li>
            </ol>
            <p class="guide-tip">VO <i>Approved</i> vào giá trị quyết toán và dòng (2) "VO đã duyệt" của các IPC sau; <b>không</b> làm đổi giá trị hợp đồng.</p>
            <p>Danh sách: <b>Bảng Chi Tiết Phát Sinh VO</b>.</p>`,
    },
    {
        id: 'dong-tien', title: 'Dòng tiền', icon: 'fa-chart-line', menu: 'menu-cashflow',
        html: `<p>So <b>kế hoạch chi theo tháng</b> (lịch dòng tiền của từng HĐ) với <b>tiền đã chuyển thực tế</b> (IPC đã thanh toán, trước thuế, gồm tạm ứng).</p>
            <ul><li><b>📋 Bảng Chi tiết</b>: số theo tháng từng hợp đồng. <b>📈 Tiến độ Timeline</b>: đường lũy kế kế hoạch – thực tế.</li>
            <li>Chỉnh kế hoạch ở lịch dòng tiền trong form Hợp đồng; số thực tế tự cập nhật khi IPC được xác nhận đã chuyển tiền.</li></ul>`,
    },
    {
        id: 'quyet-toan', title: 'Quyết toán', icon: 'fa-flag-checkered', menu: 'menu-final',
        html: `<ol><li><b>Lập Hồ Sơ Quyết Toán Mới</b> → chọn hợp đồng chưa quyết toán → <b>Tiếp tục lập Quyết toán</b>.</li>
            <li>Bảng tổng hợp tự lấy số: [A] giá trị HĐ gốc, [B] VO đã duyệt, [C] = A + B giá trị quyết toán, [D] lũy kế đã thanh toán qua các IPC,
                [E] tạm ứng chưa thu hồi, [F] giữ lại bảo hành (% của C — chọn 0% nếu giải tỏa bằng thư bảo lãnh).
                <b>[G] = C − D − E − F</b> là số còn phải trả đợt cuối.</li>
            <li>Kiểm xong bấm <b>Chốt quyết toán &amp; đóng hợp đồng</b>: HĐ chuyển <i>Closed</i>, không thêm IPC / VO được nữa.</li>
            <li>Danh sách: <b>DS Bảng Quyết Toán Hợp Đồng</b>.</li></ol>`,
    },
    {
        id: 'tong-quan', title: 'Tổng quan và xuất Excel', icon: 'fa-gauge', menu: 'menu-overview',
        html: `<p>Tổng quan gom số của cả dự án: ngân sách, đã cam kết, <i>Đã thực hiện</i> (giá trị gộp đến nay của IPC đã duyệt), <i>Đã thanh toán</i> (trước thuế, gồm tạm ứng), VO.</p>
            <p>Mỗi bảng danh sách (Ngân sách, Đấu thầu, Hợp đồng, VO, Dòng tiền) có nút <b>Xuất Excel</b>: xuất đúng các cột đang thấy, số tiền là số thật, có dòng Tổng cộng.</p>`,
    },
    {
        id: 'an-toan', title: 'Dữ liệu an toàn: lưu, trùng sửa, thùng rác, sao lưu', icon: 'fa-shield-halved', menu: 'menu-trash',
        html: `<ul>
            <li><b>Lưu tự động</b> mỗi lần bấm Lưu; mất mạng vẫn làm tiếp được (huy hiệu <i>Chờ đồng bộ</i>).</li>
            <li><b>Hai người cùng sửa một hồ sơ</b>: người lưu sau thấy hộp thoại liệt kê chỗ khác nhau — <i>Chép thay đổi của tôi</i> (để dán lại) hoặc <i>Tải bản mới</i>. Không ai bị ghi đè âm thầm.</li>
            <li><b>Thùng rác</b>: hồ sơ xóa nằm đây 30 ngày, ghi rõ ai xóa, lúc nào; bấm <i>Khôi phục</i> để lấy lại.</li>
            <li><b>Nhật ký</b>: mọi lần tạo / sửa / xóa đều ghi người, giờ và giá trị trước – sau.</li>
            <li><b>Sao lưu tự động</b> toàn bộ dữ liệu mỗi ngày lúc 02:00, giữ 90 ngày (Admin tải ở GitHub → Actions).</li>
            </ul>
            <p class="guide-tip">Thùng rác, nhật ký và chống trùng sửa áp dụng cho dự án <b>đã chuyển dữ liệu</b> sang cấu trúc mới (xem mục Quản trị).</p>`,
    },
    {
        id: 'quan-tri', title: 'Quản trị (Admin)', icon: 'fa-user-shield', menu: 'menu-admin', admin: true,
        html: `<ul>
            <li><b>Quản lý Tài khoản</b>: duyệt tài khoản mới, đặt vai trò <i>Admin / User (QS) / Manager (chỉ xem) / Chờ duyệt</i>.</li>
            <li><b>Chuyển dữ liệu</b> (dự án kiểu cũ → cấu trúc mới): chọn dự án → <b>Chạy thử</b> (không ghi gì) → gõ đúng mã dự án → <b>Chạy thật</b>.
                App tự tải file sao lưu dự án về máy trước khi ghi; kết quả phải ra toàn bộ <i>KHỚP</i>. Dữ liệu cũ không bị xóa.</li>
            <li><b>Reset</b> (nút đỏ trên thanh trên cùng): phải gõ đúng tên dự án; app tự tải sao lưu trước, hồ sơ chuyển vào Thùng rác.</li>
            </ul>`,
    },
    {
        id: 'hoi-dap', title: 'Câu hỏi thường gặp', icon: 'fa-circle-question',
        html: `<dl>
            <dt>Số dòng (16) của app lệch chứng chỉ tư vấn?</dt><dd>Kiểm tham số HĐ (% giữ lại, thu hồi tạm ứng tính trên gì, trần giữ lại, VAT) và giá trị khối lượng lũy kế đã nhập. App làm tròn đến đồng ở từng dòng.</dd>
            <dt>Vì sao không sửa được IPC?</dt><dd>IPC đã duyệt / đã trả bị khóa — bấm <b>Mở khóa</b> và ghi lý do.</dd>
            <dt>Xóa nhầm?</dt><dd>Vào <b>Thùng rác</b> → Khôi phục (trong 30 ngày).</dd>
            <dt>Không thấy dự án / không sửa được gì?</dt><dd>Tài khoản đang <i>Chờ duyệt</i> hoặc <i>Manager (chỉ xem)</i> — nhờ Admin đổi vai trò.</dd>
            <dt>Huy hiệu "Chờ đồng bộ" mãi không hết?</dt><dd>Kiểm mạng rồi tải lại trang; đừng đóng trình duyệt khi còn "Chờ đồng bộ".</dd>
            </dl>`,
    },
];
