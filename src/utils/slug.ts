// Utility helpers for shop slugs and URL handling

const ACCENT_MAP: Array<[RegExp, string]> = [
  [/à|á|â|ã|ä|å/gi, 'a'],
  [/è|é|ê|ë/gi, 'e'],
  [/ì|í|î|ï/gi, 'i'],
  [/ò|ó|ô|õ|ö/gi, 'o'],
  [/ù|ú|û|ü/gi, 'u'],
  [/ñ/gi, 'n'],
  [/ç/gi, 'c'],
];

const DEFAULT_SHOP_SLUG = 'retro-barbershop';

export const slugify = (value: string, fallback: string = DEFAULT_SHOP_SLUG): string => {
  if (!value) return fallback;

  const normalized = ACCENT_MAP.reduce((acc, [regex, replacement]) => acc.replace(regex, replacement), value)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
};

export const nextSlugCandidate = (baseSlug: string, attempt: number): string => {
  if (attempt <= 1) return baseSlug;
  return `${baseSlug}-${attempt}`;
};

export const extractSlugFromPathname = (pathname: string): string | null => {
  if (!pathname) return null;
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  const raw = segments[0];
  return raw ? decodeURIComponent(raw.trim()) : null;
};

export const extractSlugFromLocation = (loc?: Location): string | null => {
  if (typeof window === 'undefined' && !loc) return null;
  const locationObj = loc || window.location;
  const pathSlug = extractSlugFromPathname(locationObj.pathname);
  if (pathSlug) return pathSlug;

  // Backward compatibility: fallback to ?shop=
  const params = new URLSearchParams(locationObj.search);
  const querySlug = params.get('shop');
  if (querySlug && querySlug.trim().length > 0) {
    return decodeURIComponent(querySlug.trim());
  }
  return null;
};

export const buildShopPath = (slug: string, includeOrigin: boolean = false): string => {
  const safeSlug = encodeURIComponent(slug || DEFAULT_SHOP_SLUG);
  const path = `/${safeSlug}`;
  if (!includeOrigin) return path;
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
};

export const buildShopUrl = (slug: string): string => buildShopPath(slug, true);






