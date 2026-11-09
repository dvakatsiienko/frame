import { appendFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { Reporter, TestCase, TestModule } from 'vitest/node';

// a vitest reporter for the commit gate's cap: one line a start and an end, so what started and never ended is what hung.
// a test blocked in a sync spawn holds its worker's loop, so its own start may never arrive; its file's start always has
const log = process.env.TEST_COMMIT_RUNNING ?? '';
const write = (line: string) => {
    if (log) appendFileSync(log, `${line}\n`);
};
const fileOf = (testModule: TestModule) =>
    relative(process.cwd(), testModule.moduleId);

// biome-ignore lint/style/noDefaultExport: vitest loads a reporter given by path through its default export
export default class VitestRunning implements Reporter {
    onTestModuleStart(testModule: TestModule) {
        write(`start\t${fileOf(testModule)}`);
    }

    onTestModuleEnd(testModule: TestModule) {
        write(`end\t${fileOf(testModule)}`);
    }

    onTestCaseReady(testCase: TestCase) {
        write(`start\t${fileOf(testCase.module)} > ${testCase.fullName}`);
    }

    onTestCaseResult(testCase: TestCase) {
        write(`end\t${fileOf(testCase.module)} > ${testCase.fullName}`);
    }
}
