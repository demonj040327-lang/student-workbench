import { cp, mkdir } from 'node:fs/promises';
await mkdir('dist', {recursive:true});
for (const item of ['references','docs']) {
  await cp(item, `dist/${item}`, {recursive:true, filter:(source)=>!source.includes('/qa/')});
}
