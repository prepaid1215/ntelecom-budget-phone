import { defineConfig } from 'astro/config';
import site from './src/data/site.json';

const siteUrl = process.env.SITE_URL?.trim() || site.siteUrl;
const baseValue = String(process.env.BASE_PATH || '/').trim().replace(/^\/+|\/+$/g, '');
const base = baseValue ? '/'+baseValue : '/';

export default defineConfig({ site: siteUrl, base, output: 'static' });
