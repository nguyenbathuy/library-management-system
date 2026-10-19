# GitHub Actions — lần chạy đầu tiên (run #1)

- Run: https://github.com/nguyenbathuy/library-management-system/actions/runs/39288604504 (ID 39288604504)
- Trigger: `push` lên `test/automation-ch5-ch6`, commit `36689f0f4c64d676de4134bea4222b94ecbc65f4`, tạo lúc 2026-10-19T16:48:27Z
- Kết luận: **success**, tổng thời gian 1 phút 39 giây (ảnh: [github-actions-run1.png](github-actions-run1.png))

| Job | Kết luận | Thời gian |
|---|---|---|
| Unit + integration (Vitest, coverage) | success | 1 phút 25 giây |
| End-to-end (Playwright, Chromium) | success | 1 phút 36 giây |

Mọi bước của cả hai job đều success, gồm `npm run typecheck`, "Lint test code (blocking)", "Static analysis of product code (report only)", hai lệnh coverage có ngưỡng, `Run Playwright tests` và hai bước tải artifact (`coverage`, `playwright-report`).

Số liệu lấy từ artifact của lần chạy (so với lượt chạy cục bộ ở `test-results/extension/`):

| Chỉ số | CI | Cục bộ |
|---|---|---|
| Unit: số ca / file | 513 / 18 | 513 / 18 |
| Tích hợp: số ca / file | 235 / 11 | 235 / 11 |
| E2E: ca đạt kỳ vọng / ngoài dự kiến / thời gian | 22 / 0 / 55,8 s | 22 / 0 / 47,8 s |
| Unit coverage (câu lệnh / nhánh) | 1274/1304 (97,69%) / 888/927 (95,79%) | 1273/1304 (97,62%) / 888/927 (95,79%) |
| Tích hợp coverage (câu lệnh / nhánh) | 1130/1367 (82,66%) / 683/927 (73,67%) | 1126/1367 (82,37%) / 681/927 (73,46%) |

Chênh lệch nhỏ về coverage giữa CI và máy cục bộ là biến thiên giữa môi trường chạy (CI: Ubuntu runner); báo cáo dùng số đo cục bộ và nêu số của CI ở mục 5.4.

Phần Annotations của run hiển thị các lỗi `tsc --strict` của frontend (bước báo cáo, `continue-on-error`), khớp với `test-results/extension/static-analysis/tsc-frontend.txt`. Lần chạy là `push`; chưa có pull request vào `main`.
