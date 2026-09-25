// Kafra service art themes. Selection persists per device; the image used by
// the Storage scene advances once per Storage open (OPEN_EVENT_ROUND_ROBIN),
// never on a timer and never while a Storage session stays open.
export const KAFRA_THEME_STORAGE_KEY = 'ghost-island.kafra-theme.v1';
export const KAFRA_ROTATION_STORAGE_KEY = 'ghost-island.kafra-rotation.v1';

export function kafraThemes(manifest) {
  return Array.isArray(manifest?.themes)
    ? manifest.themes.filter((theme) => theme?.id && Array.isArray(theme.images) && theme.images.length)
    : [];
}

export function resolveKafraTheme(manifest, requested) {
  const themes = kafraThemes(manifest);
  if (themes.some((theme) => theme.id === requested)) return requested;
  if (themes.some((theme) => theme.id === manifest?.defaultTheme)) return manifest.defaultTheme;
  return themes[0]?.id ?? null;
}

export function kafraImageUrl(manifest, themeId, image) {
  const root = String(manifest?.webRoot ?? '/assets/kafra-themes').replace(/\/+$/, '');
  return `${root}/${encodeURIComponent(themeId)}/${encodeURIComponent(image.file)}`;
}

// Rotation state: { theme, next }. A different theme restarts at image 1.
export function resetKafraRotation(themeId) {
  return { theme: themeId, next: 0 };
}

export function takeKafraImage(manifest, themeId, rotation) {
  const theme = kafraThemes(manifest).find((entry) => entry.id === themeId);
  if (!theme) return null;
  const start = rotation?.theme === themeId ? Number(rotation.next) : 0;
  const index = Number.isInteger(start) && start >= 0 ? start % theme.images.length : 0;
  const image = theme.images[index];
  return {
    theme: themeId,
    index,
    image,
    url: kafraImageUrl(manifest, themeId, image),
    rotation: { theme: themeId, next: (index + 1) % theme.images.length },
  };
}
