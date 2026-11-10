"""Trích "đáp án" cost report tháng từ file Excel THẬT (sheet Report) → tests/fixtures/private/cost-report-golden.json.
File Excel và JSON nằm trong tests/fixtures/private/ (bị .gitignore — repo public).
Chạy: python3 tests/fixtures/extract-cost-report.py [file cost report .xlsx]
Mỗi dòng lá (có tên + ngân sách) → { group, no, code, name, budget, award, apprVO, subVO, certified, expect: {I,J,K,M,N}, hasM }.
"""
import json, sys
from pathlib import Path
from openpyxl import load_workbook

HERE = Path(__file__).parent
src = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / 'private' / 'cost-report-oct26.xlsx'
wv = load_workbook(src, data_only=True)['Report']
wf = load_workbook(src)['Report']
num = lambda v: round(v) if isinstance(v, (int, float)) else 0
rows, group, totals = [], None, None
for r in range(8, wv.max_row + 1):
    b, d = wv.cell(r, 2).value, wv.cell(r, 4).value
    if d is None: continue
    if str(d).strip().upper().startswith('TOTAL'):
        totals = {col: num(wv[f'{col}{r}'].value) for col in 'EFGHIJKLMN'}
        continue
    is_header = isinstance(b, str) and len(b) == 1 and b.isalpha()
    leaf_formula = isinstance(wf.cell(r, 9).value, str) and wf.cell(r, 9).value.startswith('=F')
    if is_header and not leaf_formula:          # dòng nhóm có SUBTOTAL (A, D)
        group = str(d).strip(); continue
    if is_header:                                # nhóm 1 dòng (B, C, E): vừa là nhóm vừa là dòng lá
        group = str(d).strip()
    code = wv.cell(r, 3).value
    rows.append({
        'row': r, 'group': group, 'code': '' if code in (None, 0, '0') else str(code), 'name': str(d).strip(),
        'budget': num(wv[f'E{r}'].value), 'award': num(wv[f'F{r}'].value), 'apprVO': num(wv[f'G{r}'].value),
        'subVO': num(wv[f'H{r}'].value), 'certified': num(wv[f'L{r}'].value),
        'expect': {col: num(wv[f'{col}{r}'].value) for col in 'IJKMN'},
        'hasM': wf[f'M{r}'].value is not None,
    })
out = {'asOf': str(wv['E3'].value)[:10], 'rows': rows, 'totals': totals}
dst = HERE / 'private' / 'cost-report-golden.json'
dst.write_text(json.dumps(out, ensure_ascii=False, indent=1))
print(f'Đã ghi {dst} — {len(rows)} dòng; tổng K = {totals["K"]:,}')
