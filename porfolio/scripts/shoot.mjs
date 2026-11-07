import puppeteer from 'puppeteer-core'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const URL = process.env.TARGET || 'http://localhost:5173'
const out = process.env.OUT || 'shots'
const width = Number(process.env.W || 1440)
const height = Number(process.env.H || 900)
const mode = process.env.MODE || 'desktop'

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--hide-scrollbars', '--force-device-scale-factor=1'],
})

const page = await browser.newPage()
await page.setViewport({ width, height, deviceScaleFactor: 1 })
await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 })
await page.evaluate(() => document.fonts.ready)
await new Promise((r) => setTimeout(r, 1400))

// trigger all scroll reveals
await page.evaluate(async () => {
  const total = document.body.scrollHeight
  for (let y = 0; y < total; y += window.innerHeight * 0.8) {
    window.scrollTo(0, y)
    await new Promise((r) => setTimeout(r, 120))
  }
  window.scrollTo(0, 0)
})
await new Promise((r) => setTimeout(r, 1200))

await page.screenshot({ path: `${out}/${mode}-hero.png` })
await page.screenshot({ path: `${out}/${mode}-full.png`, fullPage: true })

const sections = await page.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { top: Math.round(r.top + window.scrollY), h: Math.round(r.height) }
  }
  return {
    docH: document.body.scrollHeight,
    viewport: { w: innerWidth, h: innerHeight },
    heroTitle: pick('.hero__title'),
    artStage: pick('.art-stage'),
    about: pick('#about'),
    toolkit: pick('#toolkit'),
    work: pick('#work'),
    contact: pick('#contact'),
    overflowX: document.documentElement.scrollWidth > innerWidth,
    titleFont: getComputedStyle(document.querySelector('.hero__title')).fontFamily,
    fontsLoaded: document.fonts.status,
  }
})

console.log(JSON.stringify(sections, null, 2))
await browser.close()
