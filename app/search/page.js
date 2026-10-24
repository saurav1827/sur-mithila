import React from 'react';
import { getSongs } from '../../lib/data-service';
import SearchClientView from '../../components/search/SearchClientView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'गीत अन्वेषण (Smart Search) | सुर-मिथिला',
  description: 'मैथिली गीत, गायक, रचयिता, एवं पारंपरिक पद खोजू।'
};

export default async function SearchPage({ searchParams }) {
  const resolvedParams = await searchParams;
  const q = resolvedParams?.q || '';
  const category = resolvedParams?.category || '';
  const singer = resolvedParams?.singer || '';
  const verifiedOnly = resolvedParams?.verified === 'true';
  const hasMediaOnly = resolvedParams?.has_media === 'true';

  const { songs, pagination } = await getSongs({
    query: q,
    category,
    singer,
    verified_only: verifiedOnly,
    has_media_only: hasMediaOnly,
    limit: 48
  });

  return (
    <SearchClientView
      initialQuery={q}
      initialSongs={songs}
      totalCount={pagination?.total || songs.length}
    />
  );
}
