/**
 * 明细表行数上限的契约常量。**本文件不得引入任何运行时依赖。**
 *
 * 与 `form-model.ts` 分开，唯一原因是后者顶层 `import { requestClient }` 会拉进
 * axios 与 preferences，那条链在 vitest 的 node 环境里访问 `window` 即崩。
 * `detail-rows.spec.ts` 的 194 行断言因此从未执行过 —— 报告是
 * `Tests no tests`（文件在 import 期就崩，不是断言失败），很容易被读成通过。
 *
 * 所以这里只放纯常量与纯函数：被测模块沿着它取值，就不必为了一个 `?? 1000`
 * 的兜底去搭 jsdom 环境（那会掩盖依赖问题，也让单测变慢）。
 *
 * 类型走 `import type`，编译期擦除，不构成运行时依赖。
 */
import type { FormDetailTableSchema } from './form-model';

/**
 * `maxRows` 缺省时生效的行数上限，镜像后端 `CapabilityGate.MAX_DETAIL_ROWS`。
 *
 * 放在契约层而不是某个视图目录里，是因为设计器与运行时都要用它，而这两个目录
 * 之间刻意没有依赖 —— 它们唯一的共同上游就是本文件（原先是 `form-model.ts`，
 * 拆分后由它重新导出，调用方无需改动）。
 *
 * 此前它在前端散落四处写成 `?? 100`，而后端 `MainDetailWriteService` 对同一个
 * null 兜底成 1000：同一份快照，前端按 100 挡、后端按 1000 放。前端更严不会
 * 导致写入失败，但会在合法范围内把用户挡住，且「最多 100 行」这句文案本身是错的。
 *
 * 跨语言常量没有编译期对齐保障。改这个值必须同步改 `CapabilityGate.MAX_DETAIL_ROWS`。
 */
export const DEFAULT_MAX_DETAIL_ROWS = 1000;

/** 一张明细表的行数上限：快照声明优先，未声明时取与后端一致的兜底值。 */
export function maxRowsOf(table: FormDetailTableSchema): number {
  return table.maxRows ?? DEFAULT_MAX_DETAIL_ROWS;
}
