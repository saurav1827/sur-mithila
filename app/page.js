import React from 'react';
import { getSongs, getDatabaseStats, getCategories } from '../lib/data-service';
import { getFeedRows, slim } from '../lib/feed-service';
import { getAIRecommendations } from '../lib/ai-recommendation-service';
import Sidebar from '../components/home/Sidebar';
import Spotlight from '../components/home/Spotlight';
import HomeFeed from '../components/home/HomeFeed';
import CategoryChips from '../components/CategoryChips';

export const dynamic = 'force-dynamic';

export default async function HomePage({ searchParams }) {
  const sp = await searchParams;
  const category = sp?.category || 'all';
  const isAll = category === 'all';

  const [stats, feed, aiSpotlight, pool, categoryList] = await Promise.all([
    getDatabaseStats(),
    getFeedRows({ cursor: 0, count: 2, category }),
    isAll ? getAIRecommendations({ isSpotlight: true, limit: 6, mood: 'all' }).catch(() => []) : Promise.resolve([]),
    isAll ? getSongs({ sort_by: 'popular', limit: 30 }) : Promise.resolve({ songs: [] }),
    getCategories(),
  ]);

  // Spotlight: Curated AI recommendations with high-res poster artwork, falling back to top pool
  const fallbackSpotlight = pool.songs.filter((s) => s.poster?.image_url).slice(0, 5).map((s) => slim(s));
  const spotlight = (aiSpotlight && aiSpotlight.length >= 3) ? aiSpotlight : fallbackSpotlight;
  const activeCat = categoryList.find((c) => c.value === category || c.name === category);

  return (
    <div className="feed-layout">
      <Sidebar
        stats={{ total: stats.total_songs, verified: stats.verified_count }}
        categories={categoryList}
      />

      <div className="feed-main">
        <div className="feed-mobile-chips">
          <CategoryChips activeCategory={category} />
        </div>

        {isAll && spotlight.length > 0 && <Spotlight songs={spotlight} />}

        {!isAll && (
          <h1 className="font-traditional" style={{ fontSize: '2rem', color: '#F8FAFC' }}>
            {activeCat?.name || category}
          </h1>
        )}

        {/* key resets feed state when the category changes */}
        <HomeFeed key={category} initialRows={feed.rows} initialCursor={feed.nextCursor} category={category} />
      </div>
    </div>
  );
}