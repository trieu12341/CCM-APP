"""Trích "đáp án" IPC mẫu vàng từ file IPC Excel THẬT → tests/fixtures/private/ipc-golden.json.
Cả file Excel lẫn JSON nằm trong tests/fixtures/private/ (bị .gitignore vì repo public).
Chạy: python3 tests/fixtures/extract-golden.py [đường dẫn file IPC .xlsx]
Đọc: sheet CERT (16 dòng của đợt cuối) và sheet Att#0 (giá trị từng đợt).
"""
import json, sys
from pathlib import Path
from openpyxl import load_workbook

HERE = Path(__file__).parent
src = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / 'private' / 'ipc-main-works.xlsx'
wb = load_workbook(src, data_only=True, read_only=True)

def find_sheet(prefix):
    return next(wb[n] for n in wb.sheetnames if n.strip().upper().startswith(prefix))

# CERT: nhãn "(n)" ở một cột, số là ô số cuối cùng trên dòng
cert = {}
for row in find_sheet('CERT').iter_rows(values_only=True):
    vals = [v for v in row if v is not None]
    if vals and isinstance(vals[0], str) and vals[0].startswith('(') and vals[0].endswith(')'):
        nums = [v for v in vals[1:] if isinstance(v, (int, float))]
        if nums:
            cert[vals[0]] = round(nums[0])

# Att#0: dòng tạm ứng + mỗi đợt: (b) giá trị KL kỳ này, (14) cột 14, (15) cột 15
advance, periods = 0, []
for row in find_sheet('ATT#0').iter_rows(values_only=True):
    if len(row) < 16 or row[2] is None:
        continue
    desc = str(row[2]).strip().lower()
    if desc.startswith('advance'):
        advance = round(row[4])
    elif desc.startswith('ipc') and isinstance(row[5], (int, float)):
        periods.append({'name': str(row[2]).strip(), 'grossThisPeriod': round(row[5]),
                        'thisPeriodExVat': round(row[14]), 'paymentThisPeriod': round(row[15])})

out = {
    'contract': {'original_value': cert['(1)'], 'advance': advance,
                 'retention_percent': 10, 'ap_recovery_percent': 17.5, 'vat_percent': 8},
    'periods': periods,
    'lastCert': cert,
}
dst = HERE / 'private' / 'ipc-golden.json'
dst.write_text(json.dumps(out, ensure_ascii=False, indent=1))
print(f'Đã ghi {dst} — {len(periods)} đợt, CERT {len(cert)} dòng')
