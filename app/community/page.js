import React from 'react';
import CommunityClientView from './CommunityClientView';
import { getCommunityPage } from '../../lib/community-service';

export const metadata = {
  title: 'गाउ-मिथिला समुदाय | Gaau-Mithila Community',
  description: 'Listen to Maithili folk song covers recorded by the community',
};
export const revalidate = 0;

export default async function CommunityPage() {
  let page = { items: [], nextOffset: null };
  try { page = await getCommunityPage({ offset: 0, sort: 'latest' }); }
  catch (e) { console.error('Failed to fetch community recordings:', e); }
  return <CommunityClientView initialItems={page.items} initialNextOffset={page.nextOffset} />;
}