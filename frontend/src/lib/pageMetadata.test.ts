import { expect, it } from 'vitest'
import { updatePageMetadata } from './pageMetadata'

it('keeps public metadata distinct and removes its canonical on research routes', () => {
  document.head.innerHTML = '<meta name="description" content="">'
  updatePageMetadata('/how-it-works/')
  expect(document.title).toBe('How SceneChain Works | Graphical Password Research')
  expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://scenechain.elfeel.me/how-it-works')
  updatePageMetadata('/research/session')
  expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,follow')
  expect(document.querySelector('link[rel="canonical"]')).toBeNull()
  updatePageMetadata('/')
  expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index,follow')
  expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://scenechain.elfeel.me/')
})
