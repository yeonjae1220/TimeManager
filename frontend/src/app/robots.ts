import type { MetadataRoute } from 'next'

const BASE_URL = 'https://timemgr.mungji.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/register'],
        disallow: ['/members/', '/logs/', '/profile/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
