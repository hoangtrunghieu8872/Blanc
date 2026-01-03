const rawSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || 'https://blanc.up.railway.app';

export const PUBLIC_SITE_URL = rawSiteUrl.replace(/\/+$/, '');

export const buildPublicMentorUrl = (id: string) =>
  `${PUBLIC_SITE_URL}/mentors/${encodeURIComponent(id)}`;
