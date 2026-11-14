import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = pathToFileURL(`${path.resolve(import.meta.dirname, '..')}/`);

/** Resolve `@/` to this repo so Node can import the app's TypeScript modules. */
export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith('@/')) return nextResolve(specifier, context);
  let relative = specifier.slice(2);
  if (!path.extname(relative)) relative += '.ts';
  return nextResolve(new URL(relative, root).href, context);
}
