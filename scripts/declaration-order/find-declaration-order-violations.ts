import ts from "typescript";

export interface DeclarationOrderViolation {
  /** The 1-based line of the reference. */
  line: number;
  /** The function referenced before its declaration. */
  name: string;
}

// One file, no lib and no imports: local symbols resolve, and anything
// imported resolves to its import binding, never to a declaration here.
function createChecker(sourceFile: ts.SourceFile): ts.TypeChecker {
  const options: ts.CompilerOptions = {
    noLib: true,
    noResolve: true,
    jsx: ts.JsxEmit.Preserve,
  };
  // In memory, since touching the disk costs more than the check.
  const host: ts.CompilerHost = {
    getSourceFile: (fileName) =>
      fileName === sourceFile.fileName ? sourceFile : undefined,
    getDefaultLibFileName: () => "lib.d.ts",
    writeFile: () => undefined,
    getCurrentDirectory: () => "",
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => "\n",
    fileExists: (fileName) => fileName === sourceFile.fileName,
    readFile: () => undefined,
  };
  return ts
    .createProgram([sourceFile.fileName], options, host)
    .getTypeChecker();
}

// A name merged with a function, such as an interface, is no use of it when
// it declares the merged type or names it as a type; `typeof` still counts.
function isTypeOnly(identifier: ts.Identifier): boolean {
  const { parent } = identifier;
  if (
    (ts.isInterfaceDeclaration(parent) ||
      ts.isModuleDeclaration(parent) ||
      ts.isTypeAliasDeclaration(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isEnumDeclaration(parent)) &&
    parent.name === identifier
  ) {
    return true;
  }
  let name: ts.Node = identifier;
  while (ts.isQualifiedName(name.parent)) {
    name = name.parent;
  }
  return ts.isTypeReferenceNode(name.parent);
}

function referencedSymbol(
  checker: ts.TypeChecker,
  identifier: ts.Identifier,
): ts.Symbol | undefined {
  if (isTypeOnly(identifier)) {
    return undefined;
  }
  if (ts.isShorthandPropertyAssignment(identifier.parent)) {
    return checker.getShorthandAssignmentValueSymbol(identifier.parent);
  }
  return checker.getSymbolAtLocation(identifier);
}

// Overloads count from the first signature.
function firstFunctionDeclaration(
  symbol: ts.Symbol,
  sourceFile: ts.SourceFile,
): ts.FunctionDeclaration | undefined {
  return symbol.declarations
    ?.filter(ts.isFunctionDeclaration)
    .filter((declaration) => declaration.getSourceFile() === sourceFile)
    .sort((left, right) => left.pos - right.pos)[0];
}

// A reasoned comment on the reference's line or the line above exempts it; a
// block comment serves JSX.
const ignoreComment = /(?:\/\/|\/\*)\s*declaration-order-ignore:\s*[^\s*]/;

/** Every reference to a `function` declaration that sits above it. */
export function findDeclarationOrderViolations(
  text: string,
  fileName: string,
): DeclarationOrderViolation[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    text,
    ts.ScriptTarget.Latest,
    true,
  );
  const checker = createChecker(sourceFile);
  const lines = text.split("\n");
  const violations: DeclarationOrderViolation[] = [];

  function visit(node: ts.Node): void {
    if (ts.isIdentifier(node)) {
      const symbol = referencedSymbol(checker, node);
      const declaration =
        symbol && firstFunctionDeclaration(symbol, sourceFile);
      const start = node.getStart(sourceFile);
      if (declaration && start < declaration.getStart(sourceFile)) {
        const line = sourceFile.getLineAndCharacterOfPosition(start).line;
        const ignored = [lines[line], lines[line - 1]].some(
          (candidate) =>
            candidate !== undefined && ignoreComment.test(candidate),
        );
        if (!ignored) {
          violations.push({ line: line + 1, name: node.text });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}
