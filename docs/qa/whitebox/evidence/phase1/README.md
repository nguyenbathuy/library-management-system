# Evidence Authentication Phase 1

Canonical run: [coverage/execution.log](coverage/execution.log), [runner JSON](coverage/vitest-results.json), [run metadata](coverage/run-metadata.json), [HTML coverage](coverage/coverage/index.html). **15 unique cases, 15 PASS, 0 FAIL, 0 SKIPPED**.

- [Summary đầy đủ từng testcase](test-results-summary.json): ID/function/input/mock/Expected/Actual/branch/condition/status lấy từ execution.
- [Coverage summary](coverage/coverage/coverage-summary.json), [raw maps](coverage/coverage/coverage-final.json), [gaps](coverage-gaps.json).
- [Condition T/F/NE](Condition_Coverage_Phase1.md), [ledger JSON](condition-ledger.json): guard subset 28/38, toàn Authentication chưa xác định.
- [Traces](coverage/case-traces.json), [Prisma isolation gate](coverage/isolation-gate.json), [network guards](coverage/network-guard-results.json).
- [Preservation check](preservation-validation.json): 154 protected files unchanged, runtime declarations/direct versions unchanged; SQLite file hash nguyên.
- [Pre-execution review](pre-execution-isolation-review.json), [strace file syscalls](coverage/filesystem-syscalls.log): 7503 lines, 0 DB path matches.
- [Unit log](unit/execution.log), [shuffle log](shuffle/execution.log), [execution validation](execution-validation.json): all root scripts thực chạy, shuffle order khác.

Đã chạy TypeScript noEmit cho test config, exit 0. Raw coverage/runner files không được biên tập; summary/ledger là tài liệu dẫn xuất có chỉ rõ nguồn/phạm vi. Git SHA và source/config/test hashes từng lượt ở run-metadata.json. Không có screenshot giả; HTML coverage thật đáp ứng evidence trực quan.
