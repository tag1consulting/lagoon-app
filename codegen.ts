import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'graphql/schema.graphql',
  documents: ['src/graphql/documents/**/*.graphql'],
  generates: {
    'src/graphql/generated/': {
      preset: 'client',
      presetConfig: {
        fragmentMasking: false,
      },
      config: {
        useTypeImports: true,
        scalars: {
          Date: 'string',
          JSON: 'unknown',
          Upload: 'unknown',
        },
      },
    },
  },
  hooks: {},
};

export default config;
