'use strict'

const ts = require('typescript')

module.exports = {
  process(source, sourcePath) {
    const output = ts.transpileModule(source, {
      // TypeScript preserves ESM syntax for an .mjs filename. Jest executes
      // transformed dependencies as CommonJS, so present this source as .js.
      fileName: sourcePath.replace(/\.mjs$/u, '.js'),
      compilerOptions: {
        allowJs: true,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    })

    return { code: output.outputText }
  },
}
