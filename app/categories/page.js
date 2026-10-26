'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Heart, Sparkles, Disc, Flame, Sun, Moon, Music,
  ArrowRight, ArrowLeft, Feather, Layers, Search, X,
  ChevronLeft, ChevronRight, Check, Filter, Play, Music2
} from 'lucide-react';
import SongCard from '../../components/SongCard';
import { useLanguage } from '../../context/LanguageContext';

// Authentic Cultural Collections with curated Maithili metadata
const CULTURAL_GROUPS = [
  {
    groupId: 'sanskars',
    groupTitle: 'सोलह संस्कार गीत (Sacred Life-Cycle Sanskars)',
    groupSubtitle: 'जन्म, उपनयन, लगन, विवाह आ समदाउनक अमर पारंपरिक लोक परंपरा',
    accentColor: '#FB7185',
    badge: 'संस्कार विशेष',
    categories: [
      {
        keyword: 'सोहर',
        title: 'सोहर (Sohar)',
        desc: 'संतानोत्पत्तिक पावन अवसर पर गाम-घरक महिला लोकनि द्वारा गाओल जाइबला मंगल गीत।',
        theme: 'theme-sanskari',
        count: 236
      },
      {
        keyword: 'विवाह',
        title: 'विवाह एवं लगनी (Vivah & Lagani)',
        desc: 'मिथिलाक रीति-रिवाज, मटकोर, लगन, चुमाओन आ परिछनक मधुर पारंपरिक गीत।',
        theme: 'theme-sanskari',
        count: 486
      },
      {
        keyword: 'कोहबर',
        title: 'कोहबर गीत (Kohbar)',
        desc: 'वर-वधुक प्रथम मिलनक पवित्र कक्ष कोहबर घरक विशिष्ट पारम्परिक गायन।',
        theme: 'theme-sanskari',
        count: 134
      },
      {
        keyword: 'समदाउन',
        title: 'समदाउन (Samdaun - Farewell)',
        desc: 'कन्याक विदाईक समय गाओल जाइबला अत्यंत मार्मिक, करुणामयी आ अमर लोक-धरोहर।',
        theme: 'theme-sanskari',
        count: 67
      },
      {
        keyword: 'बटगवनी',
        title: 'बटगवनी एवं उपनयन (Batgavani)',
        desc: 'उपनयन (यज्ञोपवीत) संस्कार आ मिथिलाक द्वार पर पाहुनक स्वागतक मंगल गान।',
        theme: 'theme-sanskari',
        count: 113
      }
    ]
  },
  {
    groupId: 'bhakti',
    groupTitle: 'भगवती वंदना एवं देव आराधना (Devotional & Sacred Traditions)',
    groupSubtitle: 'गोसाउनि वंदना, दुर्गा स्तुति, शिव नचारी आ राम-जानकीक अमर भक्ति पद',
    accentColor: '#F59E0B',
    badge: 'भक्ति एवं स्तुति',
    categories: [
      {
        keyword: 'भगवती',
        title: 'भगवती वंदना एवं गोसाउनि गीत',
        desc: 'जय जय भैरवि असुर भयाउनि सं लऽ कऽ जगदम्बक अलौकिक वंदना आ शक्ति साधना।',
        theme: 'theme-bhakti',
        count: 664
      },
      {
        keyword: 'नचारी',
        title: 'शिव नचारी एवं महेशवाणी',
        desc: 'महादेव भोलेनाथक अलमस्त रूप, तांडव आ माता पार्वती संग नोकझोंकक दिव्य पद।',
        theme: 'theme-nachari',
        count: 375
      },
      {
        keyword: 'राम',
        title: 'राम-जानकी विवाह एवं पद',
        desc: 'अयोध्या सं मिथिला पहुँचल राघवजी आ सियाजीक स्वयंबरक आनंदमयी संकीर्तन।',
        theme: 'theme-bhakti',
        count: 888
      },
      {
        keyword: 'कृष्ण',
        title: 'कृष्ण लीला एवं पदावली',
        desc: 'राधा-कृष्णक प्रेम, रस, रास आ विरहक शास्त्रीय मैथिली पदावली।',
        theme: 'theme-bhakti',
        count: 144
      }
    ]
  },
  {
    groupId: 'festivals',
    groupTitle: 'ऋतु, लोक पर्व एवं उत्सव (Seasons & Folk Festivals)',
    groupSubtitle: 'छठि महापर्व, झिझिया, सामा-चकेवा, चैती आ मधुश्रावणीक ऋतु चक्र',
    accentColor: '#34D399',
    badge: 'महापर्व एवं ऋतु',
    categories: [
      {
        keyword: 'छठि',
        title: 'छठि महापर्व गीत (Chhath Geet)',
        desc: 'काँच ही बाँस के बहँगिया, सुरुज देवक पावन अर्घ्य आ लोक आस्थाक महापर्व।',
        theme: 'theme-lokgeet',
        count: 93
      },
      {
        keyword: 'झिझिया',
        title: 'झिझिया लोकगीत (Jhijhiya)',
        desc: 'शारदीय नवरात्र में माथ पर दीप-छिद्रयुक्त घैला लऽ कऽ गाओल जाइबला विशिष्ट लोकनृत्य गीत।',
        theme: 'theme-lokgeet',
        count: 13
      },
      {
        keyword: 'सामा',
        title: 'सामा-चकेवा (Sama Chakeva)',
        desc: 'कार्तिक पूर्णिमाक अवसर पर भाई-बहिनक अटूट प्रेमक पावन लोक उत्सव।',
        theme: 'theme-lokgeet',
        count: 69
      },
      {
        keyword: 'चैती',
        title: 'चैती एवं फगुआ (Chaiti & Phagua)',
        desc: 'वसंत ऋतु, होलीक रंग आ चैतक विरहाग्नि में गाओल जाइबला मधुर गान।',
        theme: 'theme-lokgeet',
        count: 331
      }
    ]
  },
  {
    groupId: 'vidyapati',
    groupTitle: 'विद्यापति एवं शास्त्रीय धरोहर (Vidyapati Padavali)',
    groupSubtitle: 'मैथिल कोकिल महाकवि विद्यापतिक अमर श्रृंगार, भक्ति आ विरह काव्य',
    accentColor: '#A855F7',
    badge: 'साहित्यिक धरोहर',
    categories: [
      {
        keyword: 'विद्यापति',
        title: 'महाकवि विद्यापति पदावली',
        desc: 'मध्यकालीन भारतक अमर काव्य धरोहर, जे मिथिला संगीतक प्राण आ आत्मा अछि।',
        theme: 'theme-vidyapati',
        count: 319
      },
      {
        keyword: 'सलहेस गाथा',
        title: 'राजा सलहेस लोक गाथा',
        desc: 'मिथिलाक लोक नायक राजा सलहेसक शौर्य, पराक्रम आ लोक-आस्थाक महागाथा।',
        theme: 'theme-vidyapati',
        count: 205
      },
      {
        keyword: 'मैथिली लोकगीत',
        title: 'पारंपरिक मैथिली लोकगीत',
        desc: 'गाम-घर, खेत-खलिहान, श्रम आ जन-जीवनक सहज अभिव्यक्ति सं भरल लोकगीत।',
        theme: 'theme-vidyapati',
        count: 1899
      }
    ]
  }
];

// All library categories index with verified song counts
const ALL_CAT_INDEX = [
  { name: 'मैथिली लोकगीत', count: 1899 },
  { name: 'भगवती गीत', count: 664 },
  { name: 'विवाह गीत', count: 486 },
  { name: 'नचारी / महेशवाणी', count: 375 },
  { name: 'ऋतु / पर्व गीत', count: 331 },
  { name: 'विद्यापति पदावली', count: 319 },
  { name: 'सोहर / जन्मोत्सव', count: 236 },
  { name: 'सलहेस गाथा', count: 205 },
  { name: 'राम-जानकी विवाह पद', count: 888 },
  { name: 'कोहबर गीत', count: 134 },
  { name: 'बटगवनी एवं उपनयन', count: 113 },
  { name: 'छठि महापर्व गीत', count: 93 },
  { name: 'सामा-चकेवा गीत', count: 69 },
  { name: 'समदाउन (विदाई गीत)', count: 67 },
  { name: 'झिझिया लोकनृत्य', count: 13 }
];

function getLocalizedCategoryTitle(rawTitle, language, t) {
  if (!rawTitle) return '';
  if (language === 'english') {
    const match = rawTitle.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      return match[1].replace(/-\s*Farewell/, '').trim();
    }
    if (rawTitle.includes('भगवती')) return 'Bhagwati Vandana & Sacred Hymns';
    if (rawTitle.includes('नचारी')) return 'Shiva Nachari & Maheshvani';
    if (rawTitle.includes('राम')) return 'Ram-Janaki Vivah Songs';
    if (rawTitle.includes('कृष्ण')) return 'Krishna Leela & Padavali';
    if (rawTitle.includes('विद्यापति')) return 'Vidyapati Padavali';
    if (rawTitle.includes('सलहेस')) return 'King Salhesh Epic';
    if (rawTitle.includes('लोकगीत')) return 'Traditional Folk Songs';
    return rawTitle;
  }
  if (language === 'maithili_plus') {
    return t(rawTitle, null);
  }
  return rawTitle;
}

function CategoryPageContent() {
  const { language, t, isEnglish, isMaithiliPlus } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeCategory, setActiveCategory] = useState(null);
  const [songs, setSongs] = useState([]);
  const [totalSongs, setTotalSongs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeSort, setActiveSort] = useState('popular');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const gridTopRef = useRef(null);

  // Sync initial category from URL param (?cat=... or ?category=...)
  useEffect(() => {
    const catParam = searchParams.get('cat') || searchParams.get('category');
    if (catParam) {
      setActiveCategory(catParam);
    } else {
      setActiveCategory(null);
    }
  }, [searchParams]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setCurrentPage(1);
    }, 280);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset pagination when sort changes
  const handleSortChange = (sortKey) => {
    setActiveSort(sortKey);
    setCurrentPage(1);
  };

  // Fetch songs whenever activeCategory, debouncedQuery, activeSort, or currentPage changes
  useEffect(() => {
    if (!activeCategory) {
      setSongs([]);
      return;
    }
    fetchCategorySongs();
  }, [activeCategory, debouncedQuery, activeSort, currentPage]);

  const fetchCategorySongs = async () => {
    setLoading(true);
    try {
      const url = `/api/categories/songs?category=${encodeURIComponent(activeCategory)}&q=${encodeURIComponent(debouncedQuery)}&sort=${activeSort}&page=${currentPage}&limit=12`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSongs(data.songs || []);
        setTotalSongs(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (e) {
      console.error('Failed to load category songs:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCategory = (keyword) => {
    setActiveCategory(keyword);
    setSearchQuery('');
    setDebouncedQuery('');
    setActiveSort('popular');
    setCurrentPage(1);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', `/categories?cat=${encodeURIComponent(keyword)}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBackToHub = () => {
    setActiveCategory(null);
    setSearchQuery('');
    setDebouncedQuery('');
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/categories');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    if (gridTopRef.current) {
      gridTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Resolve category details for hero panel
  const getCategoryDetails = (catKey) => {
    for (const group of CULTURAL_GROUPS) {
      const found = group.categories.find(c => c.keyword === catKey || c.title.includes(catKey));
      if (found) {
        return {
          title: getLocalizedCategoryTitle(found.title, language, t),
          desc: isEnglish ? 'Sacred and folk musical heritage of Mithila.' : (isMaithiliPlus ? t(found.desc) : found.desc),
          badge: isEnglish ? 'Sacred Tradition' : (isMaithiliPlus ? t(group.badge) : group.badge),
          accentColor: group.accentColor
        };
      }
    }
    return {
      title: getLocalizedCategoryTitle(catKey, language, t),
      desc: isEnglish ? 'Rich musical tradition and cultural heritage of Mithila.' : 'मिथिलाक समृद्ध संगीत परंपरा आ लोक सांस्कृतिक धरोहर।',
      badge: isEnglish ? 'Musical Category' : 'सांस्कृतिक विधा',
      accentColor: '#EAB308'
    };
  };

  // If a category is selected: render the interactive card-based view
  if (activeCategory) {
    const details = getCategoryDetails(activeCategory);
    const startRange = (currentPage - 1) * 12 + 1;
    const endRange = Math.min(currentPage * 12, totalSongs);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', minHeight: '100vh', paddingBottom: '80px' }}>
        {/* Back Button */}
        <div>
          <button onClick={handleBackToHub} className="category-back-btn">
            <ArrowLeft size={16} />
            <span>{t('सभ विधा (All Categories)', 'All Categories', 'सभ विधा')}</span>
          </button>
        </div>

        {/* Category Hero Banner */}
        <div className="category-hero-panel" style={{ borderColor: `${details.accentColor}44` }}>
          <div className="category-hero-meta">
            <div className="category-hero-badge" style={{ color: details.accentColor, borderColor: `${details.accentColor}55`, background: `${details.accentColor}18` }}>
              <Sparkles size={14} />
              <span>{details.badge}</span>
            </div>

            <h1 className="category-hero-title font-traditional">
              {details.title}
            </h1>

            <p className="category-hero-desc">
              {details.desc}
            </p>
          </div>

          <div className="category-hero-stats">
            <div className="hero-stat-card" style={{ borderColor: `${details.accentColor}33` }}>
              <span className="stat-value font-traditional" style={{ color: details.accentColor }}>
                {totalSongs}
              </span>
              <span className="stat-label">{t('गीत उपलब्ध', 'tracks available', 'गीत उपलब्ध')}</span>
            </div>
          </div>
        </div>

        {/* Interactive Search & Filter Controls Bar */}
        <div ref={gridTopRef} className="category-controls-panel">
          {/* Search Box */}
          <div className="category-search-box">
            <Search size={16} color="var(--accent-gold)" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isEnglish ? `Search songs, singers or writers in "${details.title}"...` : `"${details.title.split(' ')[0]}" में गीत, गायक या रचनाकार खोजू...`}
              className="category-search-input"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="category-search-clear"
                title={t('हटाउ', 'Clear', 'हटाउ')}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="category-filter-pills">
            <button
              onClick={() => handleSortChange('popular')}
              className={`category-pill-btn ${activeSort === 'popular' ? 'active' : ''}`}
            >
              {t('सर्वाधिक लोकप्रिय (Popular)', 'Popular', 'सर्वाधिक लोकप्रिय')}
            </button>

            <button
              onClick={() => handleSortChange('newest')}
              className={`category-pill-btn ${activeSort === 'newest' ? 'active' : ''}`}
            >
              {t('नवीनतम (Newest)', 'Newest', 'नवीनतम')}
            </button>

            <button
              onClick={() => handleSortChange('az')}
              className={`category-pill-btn ${activeSort === 'az' ? 'active' : ''}`}
            >
              {t('अक्षरानुसार (A to Z)', 'A to Z', 'अक्षरानुसार')}
            </button>
          </div>
        </div>

        {/* Songs Cards Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <p>{t('गीत लोड भऽ रहल अछि...', 'Loading tracks...', 'गीत लोड भऽ रहल अछि...')}</p>
          </div>
        ) : songs.length > 0 ? (
          <div>
            <div className="category-songs-cards-grid">
              {songs.map((song) => (
                <SongCard key={song.id || song.slug} song={song} />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="category-pagination-container">
                <div className="category-pagination-bar">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="cat-page-btn"
                  >
                    <ChevronLeft size={16} />
                    <span>{t('पाछाँ', 'Previous', 'पाछाँ')}</span>
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                    .map((pageNum, idx, arr) => {
                      const showEllipsisBefore = idx > 0 && pageNum - arr[idx - 1] > 1;
                      return (
                        <React.Fragment key={pageNum}>
                          {showEllipsisBefore && <span style={{ color: 'var(--text-muted)', padding: '0 4px' }}>...</span>}
                          <button
                            onClick={() => handlePageChange(pageNum)}
                            className={`cat-page-btn ${currentPage === pageNum ? 'active' : ''}`}
                          >
                            {pageNum}
                          </button>
                        </React.Fragment>
                      );
                    })}

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="cat-page-btn"
                  >
                    <span>{t('आगाँ', 'Next', 'आगाँ')}</span>
                    <ChevronRight size={16} />
                  </button>
                </div>

                <span className="category-pagination-info">
                  {t(`गीत ${startRange} - ${endRange} (कुल ${totalSongs} गीत)`, `Tracks ${startRange} - ${endRange} of ${totalSongs}`, `गीत ${startRange} - ${endRange} (कुल ${totalSongs} गीत)`)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '70px 20px', color: 'var(--text-muted)' }} className="glass-panel">
            <Disc size={44} color="var(--accent-gold)" style={{ opacity: 0.5, margin: '0 auto 16px' }} />
            <h3 style={{ color: '#F8FAFC', marginBottom: '8px' }}>{t('कोनो गीत नै भेटल', 'No tracks found', 'कोनो गीत नहि भेटल')}</h3>
            <p style={{ maxWidth: '440px', margin: '0 auto 16px', fontSize: '0.9rem' }}>
              {searchQuery
                ? (isEnglish ? `No results found for "${searchQuery}". Try different keywords.` : `"${searchQuery}" लेल कोनो परिणाम नै भेटल। खोज शब्द बदलि कऽ देखू।`)
                : (isEnglish ? 'No tracks currently available in this category.' : 'ई विधा में अखनि गीत उपलब्ध नै अछि।')}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="category-pill-btn active"
                style={{ padding: '8px 20px' }}
              >
                {t('खोज हटाउ (Show All)', 'Clear Search', 'खोज हटाउ')}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // If no category is selected: render the full Cultural Groups Hub
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '36px', minHeight: '100vh', paddingBottom: '80px' }}>
      {/* Hero Cultural Banner */}
      <div className="category-hero-panel">
        <div className="category-hero-meta">
          <div className="category-hero-badge">
            <Sparkles size={14} color="#EAB308" />
            <span>{t('मिथिलाक सांस्कृतिक वर्गीकरण', 'Mithila Cultural Classification', 'मिथिलाक सांस्कृतिक वर्गीकरण')}</span>
          </div>
          <h1 className="category-hero-title font-traditional">
            {t('संस्कार, विधा एवं लोक पर्व', 'Traditions, Sanskars & Folk Festivals', 'संस्कार, विधा एवं लोक पर्व')}
          </h1>
          <p className="category-hero-desc">
            {isEnglish
              ? 'Explore the vibrant musical heritage of Mithila spanning sacred life-cycle sanskars (Sohar, Samdaun), devotional traditions, seasonal folk festivals (Chhath), and Vidyapati Padavali. Click any category to explore all curated songs.'
              : (isMaithiliPlus
                  ? 'मिथिलाक जीवन-दर्शन जन्म (सोहर), उपनयन (बटगवनी), विवाह (कोहबर, समदाउन) सं लऽ कऽ महापर्व (छठि, महाशिवरात्रि) आ विद्यापति पदावली धरि आबद्ध अछि।'
                  : 'मिथिलाक जीवन-दर्शन जन्म (सोहर), उपनयन (बटगवनी), विवाह (कोहबर, समदाउन) सं लऽ कऽ महापर्व (छठि, महाशिवरात्रि) आ विद्यापति पदावली धरि आबद्ध अछि। कोनो सेहो विधा पर क्लिक कऽ कार्ड प्रारूप में सभ गीत देखू।')}
          </p>
        </div>

        <div className="category-hero-stats">
          <div className="hero-stat-card">
            <span className="stat-value font-traditional">15</span>
            <span className="stat-label">{t('सांस्कृतिक विधा', 'Cultural Categories', 'सांस्कृतिक विधा')}</span>
          </div>
          <div className="hero-stat-card">
            <span className="stat-value font-traditional">2,354</span>
            <span className="stat-label">{t('संगृहीत रचना', 'Curated Tracks', 'संगृहीत रचना')}</span>
          </div>
        </div>
      </div>

      {/* 4 Cultural Tiers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
        {CULTURAL_GROUPS.map((group) => {
          const groupTitle = group.groupId === 'sanskars'
            ? t(group.groupTitle, 'Sacred Life-Cycle Sanskars (16 Sanskars)', 'सोलह संस्कार गीत')
            : group.groupId === 'bhakti'
            ? t(group.groupTitle, 'Devotional & Sacred Traditions (Bhagwati & Shiva)', 'भगवती वंदना एवं देव आराधना')
            : group.groupId === 'festivals'
            ? t(group.groupTitle, 'Seasons & Folk Festivals (Chhath, Sama, Jhijhiya)', 'ऋतु, लोक पर्व एवं उत्सव')
            : t(group.groupTitle, 'Vidyapati & Classical Heritage (Padavali)', 'विद्यापति एवं शास्त्रीय धरोहर');

          const groupSubtitle = isEnglish
            ? (group.groupId === 'sanskars'
                ? 'Traditional folk songs celebrating birth, upanayan, wedding and samdaun.'
                : group.groupId === 'bhakti'
                ? 'Gosavani vandana, Durga stuti, Shiva nachari and divine hymns of Ram-Janaki.'
                : group.groupId === 'festivals'
                ? 'Chhath Mahaparva, Jhijhiya, Sama-Chakeva, Chaiti and festive seasonal cycles.'
                : 'Immortal devotional, romantic and philosophical compositions of Mahakavi Vidyapati.')
            : group.groupSubtitle;

          const groupBadge = group.groupId === 'sanskars'
            ? t(group.badge, 'Life-Cycle Sanskars', 'संस्कार विशेष')
            : group.groupId === 'bhakti'
            ? t(group.badge, 'Devotional Hymns', 'भक्ति एवं स्तुति')
            : group.groupId === 'festivals'
            ? t(group.badge, 'Seasons & Festivals', 'महापर्व एवं ऋतु')
            : t(group.badge, 'Literary Heritage', 'साहित्यिक धरोहर');

          return (
            <section key={group.groupId} className="cultural-group-section">
              {/* Group Header */}
              <div className="cultural-group-header">
                <div>
                  <span className="cultural-tier-badge" style={{ borderColor: `${group.accentColor}55`, color: group.accentColor, background: `${group.accentColor}18` }}>
                    {groupBadge}
                  </span>
                  <h2 className="cultural-group-title font-traditional">
                    {groupTitle}
                  </h2>
                  <p className="cultural-group-subtitle">
                    {groupSubtitle}
                  </p>
                </div>
              </div>

              {/* Cards Grid: Clicking ANY card opens that category in-page */}
              <div className="cultural-cards-grid">
                {group.categories.map((cat) => (
                  <div
                    key={cat.title}
                    onClick={() => handleSelectCategory(cat.keyword)}
                    className={`cultural-cat-card ${cat.theme}`}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="cat-card-top">
                      <div className="cat-icon-container">
                        <Disc size={22} color={group.accentColor} />
                      </div>
                      <span className="cat-count-badge font-traditional">
                        {cat.count} {t('गीत', 'tracks', 'गीत')}
                      </span>
                    </div>

                    <div className="cat-card-body">
                      <h3 className="cat-card-title font-traditional">
                        {getLocalizedCategoryTitle(cat.title, language, t)}
                      </h3>
                      <p className="cat-card-desc">
                        {isEnglish ? 'Authentic traditional composition preserved in the Sur-Mithila archive.' : (isMaithiliPlus ? t(cat.desc) : cat.desc)}
                      </p>
                    </div>

                    <div className="cat-card-footer">
                      <span className="cat-explore-text">{t('गीत कार्ड देखू', 'Explore Tracks', 'गीत देखू')}</span>
                      <ArrowRight size={14} className="cat-arrow-icon" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Complete Index of All Categories: Clicking any pill opens in-page */}
      <div className="glass-panel" style={{ padding: '32px 28px', marginTop: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <Layers size={20} color="#EAB308" />
          <h2 className="font-traditional" style={{ fontSize: '1.4rem', color: '#F8FAFC', margin: 0 }}>
            {t('संपूर्ण विधा अनुक्रमणिका (Complete Index of Musical Genres)', 'Complete Index of Musical Genres', 'संपूर्ण विधा अनुक्रमणिका')}
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '12px'
        }}>
          {ALL_CAT_INDEX.map((c) => (
            <div
              key={c.name}
              onClick={() => handleSelectCategory(c.name)}
              className="category-index-pill"
              style={{ cursor: 'pointer' }}
            >
              <span className="cat-index-name font-traditional">{getLocalizedCategoryTitle(c.name, language, t)}</span>
              <span className="cat-index-count">{c.count} {t('गीत', 'tracks', 'गीत')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <Suspense fallback={
      <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
        <p>विधा सूची लोड भऽ रहल अछि...</p>
      </div>
    }>
      <CategoryPageContent />
    </Suspense>
  );
}
