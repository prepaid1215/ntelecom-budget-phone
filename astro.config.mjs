import { defineConfig } from 'astro/config';
import site from './src/data/site.json';

const siteUrl = process.env.SITE_URL?.trim() || site.siteUrl;

export default defineConfig({ site: siteUrl, output: 'static' });
