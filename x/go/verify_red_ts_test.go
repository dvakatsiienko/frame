package main

import (
	"path/filepath"
	"testing"
)

// the mods' engine tsconfig leaves out `.ts` import paths, which every mod writes: a swap that plants one reads red, never broken by TS5097
func TestVerifyRedPlantsAnImportOfATsPath(t *testing.T) {
	t.Parallel()
	f := typedRedFixture(t)
	write(t, filepath.Join(f.dir, "tsconfig.json"), `{"compilerOptions": {"strict": true, "noEmit": true, "module": "esnext", "moduleResolution": "bundler", "target": "es2022", "types": []}, "include": ["*.ts"]}`+"\n")
	write(t, filepath.Join(f.dir, "extra.ts"), "export const extra = 4;\n")
	commitAll(t, f.dir)

	got, _ := verifyRedIn(t, f, nil, f.file, "limit: number = 3;", "limit: number = extra;\nimport { extra } from \"./extra.ts\";", f.test)

	if got.code != 0 || got.data["verdict"] != verdictRed {
		t.Fatalf("exit %d, data %v, want red, not broken by TS5097:\n%s", got.code, got.data, got.stdout)
	}
}
