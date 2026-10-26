import { cp, mkdir } from 'node:fs/promises';

// Publish operating guides only; research archives are kept outside the checkout.
await mkdir('dist', {recursive: true});
await cp('docs', 'dist/docs', {recursive: true,
  filter: source => !source.split(/[\\/]/).includes('qa'),
});
