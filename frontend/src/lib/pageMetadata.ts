import metadata from '../pageMetadata.json'

export function updatePageMetadata(path: string) {
  const normalized = path.replace(/\/+$/, '') || '/'
  const page = metadata[normalized as keyof typeof metadata]
  document.title = page?.title ?? 'SceneChain | Practice and Research Workspace'
  const description = document.head.querySelector<HTMLMetaElement>('meta[name="description"]')
  if (description) description.content = page?.description ?? 'SceneChain local practice, research participation and sign-in tools.'
  let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')
  if (!robots) {
    robots = document.createElement('meta')
    robots.name = 'robots'
    document.head.append(robots)
  }
  robots.content = page ? 'index,follow' : 'noindex,follow'
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!page) {
    canonical?.remove()
  } else {
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.rel = 'canonical'
      document.head.append(canonical)
    }
    canonical.href = `https://scenechain.elfeel.me${normalized}`
  }
}
