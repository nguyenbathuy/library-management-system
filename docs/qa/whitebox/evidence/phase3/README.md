# Evidence index — White-box Phase 3 Member Management

Evidence này thuộc phạm vi Tester hiện tại, chạy ngày 12/10/2026 (Asia/Ho_Chi_Minh) trên HEAD quan sát `3623171535cde61d8fb8dd7f02d248da3864e2e5` trong workspace dirty. HEAD không phải commit chứa các test mới; hash source/config/test tại thời điểm chạy nằm trong `run-metadata.json` của từng lượt.

## Kết quả thực thi

| Run | Scope | PASS | FAIL | SKIPPED/TODO | Exit | Evidence |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `member-unit` | 25 ca Phase 3 | 23 | 2 | 0/0 | 1 | [log](member-unit/execution.log), [JSON](member-unit/vitest-results.json), [trace](member-unit/phase3-member-traces.json) |
| `authentication-regression` | 40 ca Phase 1+2 | 40 | 0 | 0/0 | 0 | [log](authentication-regression/execution.log), [JSON](authentication-regression/vitest-results.json) |
| `combined-unit` | 65 ca | 63 | 2 | 0/0 | 1 | [log](combined-unit/execution.log), [JSON](combined-unit/vitest-results.json) |
| `combined-shuffle` | 65 ca, seed 20261012 | 63 | 2 | 0/0 | 1 | [log](combined-shuffle/execution.log), [JSON](combined-shuffle/vitest-results.json) |
| `member-coverage` | Member + V8 | 23 | 2 | 0/0 | 1 | [log](member-coverage/execution.log), [HTML](member-coverage/coverage/index.html), [raw map](member-coverage/coverage/coverage-final.json) |
| `authentication-coverage` | Authentication + V8 | 40 | 0 | 0/0 | 0 | [log](authentication-coverage/execution.log), [HTML](authentication-coverage/coverage/index.html), [raw map](authentication-coverage/coverage/coverage-final.json) |
| `combined-coverage` | 65 ca + V8 | 63 | 2 | 0/0 | 1 | [log](combined-coverage/execution.log), [HTML](combined-coverage/coverage/index.html), [raw map](combined-coverage/coverage/coverage-final.json) |

Exit 1 ở các run có Member là kết quả đúng của hai assertion fail `WB-RG-04` và `WB-RG-05`, không phải lỗi harness. Không có failure ngoài hai ID này. [Tổng hợp kết quả](test-results-summary.json), [đối soát execution](execution-validation.json) và [phân loại defect](defect-findings.json) lưu căn cứ máy đọc được.

## Coverage và phân tích

- [Coverage summary](coverage-summary.json) giữ covered/total cho ba run và xác nhận Authentication counters không đổi so với Phase 2.
- [Selected Member function-body coverage](member-function-coverage.json) suy dẫn nghiêm ngặt từ raw map cho `register`, `getMe`, `getAllUsers`, `toggleBlacklist`; đây không phải report V8 toàn file độc lập.
- [Condition ledger JSON](condition-ledger.json) và [bảng diễn giải](Condition_Coverage_Phase3.md) tách condition thủ công khỏi V8 Branch Coverage.
- [Uncovered slots](uncovered-branches.json) và [coverage gaps](Coverage_Gaps_Phase3.md) ghi vị trí còn thiếu, kể cả code ngoài bốn hàm Member.
- [Source analysis](Member_Source_Analysis.md) ghi control flow, boundary, route wiring và selection rationale trước kết luận execution.
- [DEF-002 verification](Defect_Verification_Phase3.md) giới hạn kết luận ở request-to-Prisma-call; không tuyên bố SQLite/UI đã được retest.

## Isolation và bảo toàn

Mỗi run có metadata, Git-status snapshot, network guard và isolation gate theo module. Các gate ghi nhận Prisma là mock trước import, các delegate chưa arrange fail-closed, không gọi `$connect`, `$disconnect`, `$transaction`; tám network API được guard và có 0 attempt. `combined-coverage/filesystem-syscalls.log` có 14.614 dòng `strace trace=%file`, không khớp `server/prisma/dev.db` hay `server/src/index.ts`. Đây là bằng chứng trong phạm vi command được trace, không phải chứng minh mọi cơ chế access đều bị quan sát.

Không chạy app bootstrap, seed, migration, SMTP hoặc database thật. Type-check có [log](typecheck/execution.log) và exit 0. Kiểm tra bảo toàn cuối nhiệm vụ nằm tại [preservation-validation.json](preservation-validation.json).

