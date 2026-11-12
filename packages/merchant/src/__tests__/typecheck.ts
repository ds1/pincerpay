import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Typecheck a snippet as if it lived in this directory, so `../index.js`
 * resolves to the package source. Returns the snippet's diagnostics as text.
 *
 * Package tsconfig excludes `__tests__`, so `pnpm typecheck` never sees a
 * `@ts-expect-error` in a test file. This runs the compiler for real.
 */
export function typecheckSnippet(code: string): string[] {
  const fileName = path.join(HERE, "__snippet__.ts").replace(/\\/g, "/");
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    isolatedModules: true,
    verbatimModuleSyntax: true,
    types: [],
  };

  const host = ts.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, onError, shouldCreate) =>
    name.replace(/\\/g, "/") === fileName
      ? ts.createSourceFile(name, code, languageVersion, true)
      : getSourceFile(name, languageVersion, onError, shouldCreate);
  const fileExists = host.fileExists.bind(host);
  host.fileExists = (name) => name.replace(/\\/g, "/") === fileName || fileExists(name);
  const readFile = host.readFile.bind(host);
  host.readFile = (name) => (name.replace(/\\/g, "/") === fileName ? code : readFile(name));

  const program = ts.createProgram({ rootNames: [fileName], options, host });
  const sourceFile = program.getSourceFile(fileName);
  return ts
    .getPreEmitDiagnostics(program, sourceFile)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
}
