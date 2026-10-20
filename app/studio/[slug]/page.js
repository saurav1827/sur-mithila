import React from 'react';
import { notFound } from 'next/navigation';
import { getSongBySlug } from '../../../lib/data-service';
import StudioClientView from './StudioClientView';

export const metadata = {
  title: 'गाउ-मिथिला स्टुडियो | Gaau-Mithila Studio',
  description: 'Record your own Maithili folk song cover',
};

export default async function StudioPage({ params }) {
  const { slug } = await params;
  const song = await getSongBySlug(slug);

  if (!song) {
    notFound();
  }

  return (
    <StudioClientView song={song} />
  );
}
