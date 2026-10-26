import React from 'react';
import { notFound } from 'next/navigation';
import { getArtistDetails, getArtists } from '../../../lib/data-service';
import ArtistHero from '../../../components/artist/ArtistHero';
import ArtistTabs from '../../../components/artist/ArtistTabs';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const data = await getArtistDetails(slug);
  if (!data || !data.artist) {
    return { title: 'गायक | सुर-मिथिला' };
  }
  const artist = data.artist;
  const name = artist.name_devanagari || artist.name;
  return {
    title: `${name} - संपूर्ण मैथिली गीत संग्रह | सुर-मिथिला`,
    description: artist.bio?.maithili || `${name} केर प्रसिद्ध मैथिली लोकगीत, भगवती वंदना, छठि गीत आ विद्यापति पदावलीक संपूर्ण संग्रह।`,
    openGraph: {
      title: `${name} - सुर-मिथिला`,
      description: artist.bio?.maithili || 'मैथिली गीत संग्रह',
      images: [artist.avatar_url || artist.banner_url || '/icons/icon-512.png']
    }
  };
}

export default async function DedicatedArtistPage({ params }) {
  const { slug } = await params;
  const data = await getArtistDetails(slug);

  if (!data || !data.artist) {
    notFound();
  }

  const { artist, songs } = data;

  return (
    <div className="artist-page-wrapper">
      <ArtistHero artist={artist} songs={songs} />
      <ArtistTabs artist={artist} songs={songs} />
    </div>
  );
}
