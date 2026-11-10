"""Tạo templates/ipc-cert.xlsx (file mẫu SẠCH, được đưa lên repo public) từ file IPC Excel thật (private).
Giữ định dạng 3 sheet CERT / Att#0 / FS; xóa mọi số, công thức, tên dự án/công ty/người ký; bỏ các sheet khác.
Chạy: python3 tests/fixtures/make-ipc-template.py [file IPC .xlsx]
Ô cần điền nằm trong js/modules/payment/ipc-xlsx-map.js (giữ đồng bộ với file này).
"""
import sys, copy
from pathlib import Path
from openpyxl import load_workbook

HERE = Path(__file__).parent
src = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / 'private' / 'ipc-main-works.xlsx'
dst = HERE.parent.parent / 'templates' / 'ipc-cert.xlsx'
wb = load_workbook(src)
KEEP = {'CERT': 'CERT', 'Att#0_IPC Record (Internal)': 'Att#0', 'FS': 'FS'}
for ws in list(wb.worksheets):
    if ws.title not in KEEP: wb.remove(ws)
for name in list(wb.defined_names): del wb.defined_names[name]

def trim(ws, last_row, last_col):
    if ws.max_row > last_row: ws.delete_rows(last_row + 1, ws.max_row - last_row)
    if ws.max_column > last_col: ws.delete_cols(last_col + 1, ws.max_column - last_col)

def clear(ws, *refs):
    for ref in refs:
        cells = ws[ref]
        if not isinstance(cells, tuple): cells = ((cells,),)
        elif not isinstance(cells[0], tuple): cells = (cells,)
        for row in cells:
            for c in row:
                if type(c).__name__ != 'MergedCell': c.value = None

def no_formulas(ws):
    for row in ws.iter_rows():
        for c in row:
            if isinstance(c.value, str) and c.value.startswith('='): c.value = None
            elif isinstance(c.value, (int, float)) and not isinstance(c.value, bool): c.value = None

# ── CERT: vùng in A1:M65 ──
ws = wb['CERT']; ws.title = 'CERT'
trim(ws, 65, 13); no_formulas(ws)
clear(ws, 'D2', 'H5', 'H6', 'H8', 'H9', 'H10', 'H12', 'H13', 'H24', 'H25', 'M15:M48', 'J34', 'C45', 'B52', 'B53', 'C63:C65', 'K63:K65')
ws.print_area = 'A1:M65'

# ── Att#0: vùng in B1:R40 ──
ws = wb['Att#0_IPC Record (Internal)']; ws.title = 'Att#0'
trim(ws, 40, 18); no_formulas(ws)
clear(ws, 'B1:B2', 'B4:B5', 'B13:R25', 'G12', 'I33')
for ref in ('B34', 'I34', 'I40'): ws[ref].value = 'Date/ Ngày: … / … / ……'
ws['I33'].value = 'Quantity Surveyor/ Tư vấn khối lượng:'
ws.print_area = 'B1:R40'

# ── FS: vùng in A1:K59; dòng chi tiết 11..39 dùng chung kiểu của dòng 11 ──
ws = wb['FS']
trim(ws, 59, 11); no_formulas(ws)
for rng in list(ws.merged_cells.ranges):
    if 10 <= rng.min_row <= 39: ws.unmerge_cells(str(rng))
clear(ws, 'B1:B2', 'I4', 'B10:K39', 'D41', 'C55:C57', 'I55:I57')
for r in range(12, 40):
    ws.row_dimensions[r].height = ws.row_dimensions[11].height
    for col in range(2, 12):
        s, d = ws.cell(11, col), ws.cell(r, col)
        d.font, d.border, d.fill = copy.copy(s.font), copy.copy(s.border), copy.copy(s.fill)
        d.number_format, d.alignment = s.number_format, copy.copy(s.alignment)
ws.print_area = 'A1:K59'
ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 1   # FS vừa 1 trang (≤ 29 dòng Bill)

# bỏ ghi chú ô, liên kết ra file ngoài, thông tin tác giả / thuộc tính riêng (repo public)
for ws in wb.worksheets:
    for row in ws.iter_rows():
        for c in row:
            if c.comment: c.comment = None
wb._external_links = []
from openpyxl.worksheet.pagebreak import RowBreak, ColBreak
for ws in wb.worksheets:
    for hf in (ws.oddHeader, ws.oddFooter, ws.evenHeader, ws.evenFooter, ws.firstHeader, ws.firstFooter):
        hf.left.text = hf.center.text = hf.right.text = None
    ws.oddFooter.right.text = 'Trang &P / &N'
    ws.row_breaks = RowBreak(); ws.col_breaks = ColBreak()
wb.properties.creator = wb.properties.lastModifiedBy = 'CCM-APP'
wb.properties.title = wb.properties.subject = wb.properties.description = wb.properties.keywords = None
wb.properties.company = None if hasattr(wb.properties, 'company') else None
try:
    from openpyxl.packaging.custom import CustomPropertyList
    wb.custom_doc_props = CustomPropertyList()
except ImportError:
    pass

wb.active = 0
dst.parent.mkdir(exist_ok=True)
wb.save(dst)
# kiểm: không còn tên riêng nào trong file mẫu
bad = ['WESTIQUE', 'ICONIC', 'TURNER', 'WEALTHCONS', 'Bích', 'Tuấn Anh']
for ws in load_workbook(dst).worksheets:
    for row in ws.iter_rows():
        for c in row:
            if isinstance(c.value, str) and any(b.lower() in c.value.lower() for b in bad):
                raise SystemExit(f'Còn tên riêng ở {ws.title}!{c.coordinate}: {c.value!r}')
print(f'Đã ghi {dst} ({dst.stat().st_size // 1024} KB)')
