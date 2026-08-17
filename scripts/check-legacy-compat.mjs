/**
 * Guards the oldest supported Lagoon API surface.
 *
 * Lagoon rejects a query naming any field its schema does not have — so one
 * newer field breaks a whole screen rather than degrading. Every operation is
 * therefore validated against a vendored Lagoon 2.8 schema, except those whose
 * name ends in the marker suffix: those are the version-gated variants,
 * selected at runtime via src/api/versionGate.ts, and are checked against the
 * current schema instead.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { buildSchema, parse, print, validate } from 'graphql';

const DOCUMENTS_DIR = 'src/graphql/documents';
const LEGACY_SCHEMA = 'graphql/schema-2.8.graphql';
const CURRENT_SCHEMA = 'graphql/schema.graphql';
/** Operations with this suffix may use post-2.8 fields. */
const GATED_SUFFIX = 'Detailed';

const legacy = buildSchema(readFileSync(LEGACY_SCHEMA, 'utf8'));
const current = buildSchema(readFileSync(CURRENT_SCHEMA, 'utf8'));

let failures = 0;
let legacyChecked = 0;
let gatedChecked = 0;

// Recursive, to match codegen.ts's `src/graphql/documents/**/*.graphql` glob
// — a flat readdir would silently skip any future subdirectory.
function findGraphqlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return findGraphqlFiles(path);
    return entry.name.endsWith('.graphql') ? [path] : [];
  });
}

for (const path of findGraphqlFiles(DOCUMENTS_DIR)) {
  const file = relative(DOCUMENTS_DIR, path);
  const doc = parse(readFileSync(path, 'utf8'));

  for (const definition of doc.definitions) {
    if (definition.kind !== 'OperationDefinition') continue;
    const name = definition.name?.value ?? '(anonymous)';
    const gated = name.endsWith(GATED_SUFFIX);
    const schema = gated ? current : legacy;

    // Validate the operation in isolation so one gated operation does not
    // exempt its neighbours in the same file.
    const errors = validate(schema, parse(print({ kind: 'Document', definitions: [definition] })));

    if (errors.length > 0) {
      failures += errors.length;
      console.error(`\n✗ ${name} (${file}) against ${gated ? 'current' : 'Lagoon 2.8'} schema:`);
      for (const error of errors) console.error(`    ${error.message.split('\n')[0]}`);
      if (!gated) {
        console.error(
          `    → either drop the field, or rename the operation to ${name}${GATED_SUFFIX} and gate it in versionGate.ts`,
        );
      }
    } else if (gated) {
      gatedChecked++;
    } else {
      legacyChecked++;
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} incompatible field selection(s).`);
  process.exit(1);
}

console.log(
  `All operations valid: ${legacyChecked} against Lagoon 2.8, ${gatedChecked} version-gated against current.`,
);
