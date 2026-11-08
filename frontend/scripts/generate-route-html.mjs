import { mkdir, readFile, writeFile } from 'node:fs/promises';
const dist = new URL('../dist/', import.meta.url);
const metadata = JSON.parse(await readFile(new URL('../src/pageMetadata.json', import.meta.url), 'utf8'));
const template = await readFile(new URL('index.html', dist), 'utf8');
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function render(path) {
  const page = metadata[path];
  const title = page?.title ?? 'SceneChain | Practice and Research Workspace';
  const description = page?.description ?? 'SceneChain local practice, research participation and sign-in tools.';
  const canonical = page ? `\n    <link rel="canonical" href="https://scenechain.elfeel.me${path}" />` : '';
  if (!/<title>[^<]*<\/title>/.test(template) || !/<meta name="description" content="[^"]*"\s*\/>/.test(template)) throw new Error('Missing template metadata');
  return template.replace(/<title>[^<]*<\/title>/, () => `<title>${escape(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, () => `<meta name="description" content="${escape(description)}" />\n    <meta name="robots" content="${page ? 'index,follow' : 'noindex,follow'}" />${canonical}`);
}
await mkdir(new URL('__seo/', dist), { recursive: true });
await Promise.all([
  writeFile(new URL('index.html', dist), render('/')),
  writeFile(new URL('__seo/how.html', dist), render('/how-it-works')),
  writeFile(new URL('__seo/workspace.html', dist), render(null)),
]);
