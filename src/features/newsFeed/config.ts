import {IS_DUTCH_API_CONFIGURED} from '#/features/news/dutch/config'

/**
 * Whether News appears in the app's navigation (left nav, drawer, keyboard
 * shortcut). Off unless EXPO_PUBLIC_ENABLE_NEWS=true. The routes still exist,
 * so a direct /news link keeps working for testing.
 */
export const NEWS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_NEWS === 'true'

/**
 * Whether the news hub (the news page shaped by interests, the frontpage
 * explore spread, the directory and the article page) replaces the original
 * news feed and newsrooms. The editorial frontpage layout and editor are
 * also exclusive to news v2; the original newsrooms keep their RSS layout.
 *
 * Opt-in per build with EXPO_PUBLIC_ENABLE_NEWS_V2=true, and only once the news
 * aggregator it reads is configured (see `news/dutch/config.ts`), so a
 * half-configured build keeps the original pages instead of a hub with nothing
 * to show. When off, the app serves the pages in `legacy/` and the hub's routes
 * resolve to Not Found.
 */
export const NEWS_V2_ENABLED =
  process.env.EXPO_PUBLIC_ENABLE_NEWS_V2 === 'true' && IS_DUTCH_API_CONFIGURED
