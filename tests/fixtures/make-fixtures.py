"""Sinh lại các file Excel GIẢ LẬP dùng cho test E2E (tên và số đều bịa).
Chạy: python3 tests/fixtures/make-fixtures.py   (cần openpyxl)
Không đưa file dự án thật vào repo (repo public). File thật đặt ở tests/fixtures/private/ (bị .gitignore).
"""
from pathlib import Path
from openpyxl import Workbook

HERE = Path(__file__).parent

def budget():
    wb = Workbook(); ws = wb.active; ws.title = 'Budget'
    ws.append(['Budget Code', 'Contract type', 'Package name', 'Budget'])
    rows = [
        ('104-04', 'Tư Vấn', 'Ý tưởng kiến trúc', 1_200_000_000),
        ('104-09', 'Tư Vấn', 'Kết cấu', 600_000_000),
        ('104-32', 'Tư Vấn', 'Cơ điện', 900_000_000),
        ('105-01', 'Tư Vấn', 'Giám sát thi công', 1_500_000_000),
        ('102-02', 'Xây Dựng', 'Cọc và tường vây', 12_000_000_000),
        ('102-03', 'Xây Dựng', 'Kết cấu thân', 25_000_000_000),
        ('102-08', 'Xây Dựng', 'Chi phí chung', 3_000_000_000),
        ('103-01', 'Xây Dựng', 'Cơ điện tổng hợp', 9_000_000_000),
        ('109-01', 'Dự phòng', 'Dự phòng', 2_000_000_000),
    ]
    for r in rows: ws.append(r)
    wb.save(HERE / 'budget-demo.xlsx')

def fs():
    """Sheet FS theo cấu trúc mẫu IPC: IPC số 2, đến nay tổng 6.000.000.000."""
    wb = Workbook(); ws = wb.active; ws.title = 'FS'
    ws.append([None, 'DỰ ÁN DEMO'])
    ws.append([None, 'BẢNG TỔNG HỢP', None, None, None, None, None, None, 2])
    ws.append([])
    ws.append([None, 'ITEM\nMỤC', 'Mã khoản mục / Code', 'DESCRIPTION \nMÔ TẢ', 'Giá trị Hợp đồng\nContract Amount',
               'Kỳ trước\nPrevious', None, 'Kỳ này\nThis Period', None, 'Đến nay\nTo Date'])
    ws.append([None, None, None, None, None, '%', 'Amount [VND]', '%', 'Amount [VND]', '%', 'Amount [VND]'])
    ws.append([None, 'BILL 1', '102-08', 'CHI PHÍ CHUNG', 3_000_000_000, None, 2_000_000_000, None, 0, None, 2_000_000_000])
    ws.append([None, 'BILL 2', '102-02', 'CỌC VÀ TƯỜNG VÂY', 12_000_000_000, None, 0, None, 2_500_000_000, None, 2_500_000_000])
    ws.append([None, 'BILL 3', '102-03', 'KẾT CẤU THÂN', 35_000_000_000, None, 0, None, 1_500_000_000, None, 1_500_000_000])
    ws.append([None, None, None, 'TỔNG TRƯỚC THUẾ / TOTAL EXCLUDING VAT', 50_000_000_000, None, 2_000_000_000, None, 4_000_000_000, None, 6_000_000_000])
    wb.save(HERE / 'fs-demo.xlsx')

if __name__ == '__main__':
    budget(); fs(); print('Đã tạo budget-demo.xlsx, fs-demo.xlsx')
