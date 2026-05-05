const RUNNING_COLOR = '#6fcf97'
const THEME_IDLE    = '#0c0c0c'
const THEME_RUNNING = '#1a2e1e'

let originalTitle = ''
let originalFaviconHref = ''

function getFaviconEl() {
  return document.querySelector("link[rel~='icon']")
}

async function drawFaviconWithDot() {
  const el = getFaviconEl()
  if (!el) return

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 32
  const ctx = canvas.getContext('2d')

  const img = new Image()
  img.src = originalFaviconHref || '/favicon.ico'
  await new Promise(r => { img.onload = r; img.onerror = r })
  ctx.drawImage(img, 0, 0, 32, 32)

  ctx.beginPath()
  ctx.arc(25, 25, 7, 0, Math.PI * 2)
  ctx.fillStyle = RUNNING_COLOR
  ctx.fill()

  el.href = canvas.toDataURL('image/png')
}

function restoreFavicon() {
  const el = getFaviconEl()
  if (el && originalFaviconHref) el.href = originalFaviconHref
}

function setThemeColor(color) {
  let el = document.querySelector('meta[name="theme-color"]')
  if (!el) {
    el = document.createElement('meta')
    el.name = 'theme-color'
    document.head.appendChild(el)
  }
  el.content = color
}

export function useLiveIndicator() {
  async function startLive() {
    const el = getFaviconEl()
    if (el && !el.href.startsWith('data:')) {
      originalFaviconHref = el.href
    }

    await drawFaviconWithDot()

    if (!document.title.startsWith('● ')) {
      originalTitle = document.title
      document.title = '● ' + document.title
    }

    navigator.setAppBadge?.()
    setThemeColor(THEME_RUNNING)
  }

  function stopLive() {
    restoreFavicon()

    if (originalTitle) {
      document.title = originalTitle
      originalTitle = ''
    }

    navigator.clearAppBadge?.()
    setThemeColor(THEME_IDLE)
  }

  return { startLive, stopLive }
}
