'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Music,
  Youtube,
  Radio,
  FileText,
  Tag,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  AlertCircle,
  Loader2,
  Trash2
} from 'lucide-react';
import { toRoman } from '../../lib/slugs';
import YoutubeIcon from '../../components/YoutubeIcon';

export default function SongEditorModal({
  song,
  isOpen,
  onClose,
  onSaveSuccess,
  prefilledChanges = null,
  categories = []
}) {
  const [formData, setFormData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeSubTab, setActiveSubTab] = useState('basic'); // 'basic' | 'credits' | 'media' | 'lyrics' | 'meta'

  useEffect(() => {
    if (!song) return;

    // Clone song data into editable state
    const data = {
      id: song.id,
      canonicalTitle: song.title?.canonical || song.title?.devanagari || '',
      romanTitle: song.title?.roman || '',
      rawTitle: song.title?.raw_title || '',
      category: song.category || 'मैथिली लोकगीत',
      genre: song.genre || 'Maithili Music',
      traditionalRaga: song.traditional_raga || '',
      singer: song.credits?.singer || '',
      writerName: song.credits?.writer?.name || '',
      writerType: song.credits?.writer?.type || 'traditional',
      composerName: song.credits?.composer?.name || '',
      composerType: song.credits?.composer?.type || 'folk',
      album: song.credits?.album || '',
      year: song.credits?.year || '',
      youtubeUrl: song.youtube?.url || '',
      youtubeVideoId: song.youtube?.video_id || '',
      youtubeTitle: song.youtube?.title || '',
      youtubeChannel: song.youtube?.channel || '',
      jiosaavnUrl: song.audio?.jiosaavn_url || '',
      appleMusicUrl: song.audio?.apple_music_url || '',
      spotifyUrl: song.audio?.spotify_url || '',
      lyricsDevanagari: song.lyrics?.devanagari || '',
      lyricsRoman: song.lyrics?.roman || '',
      verificationStatus: song.verification?.status || 'pending_review',
      tags: Array.isArray(song.tags) ? song.tags.join(', ') : (song.tags || '')
    };

    // If prefilledChanges from user suggestion were passed in, overlay them!
    if (prefilledChanges && Array.isArray(prefilledChanges)) {
      for (const ch of prefilledChanges) {
        if (ch.path === 'credits.singer') data.singer = ch.newValue;
        if (ch.path === 'credits.writer.name') data.writerName = ch.newValue;
        if (ch.path === 'credits.composer.name') data.composerName = ch.newValue;
        if (ch.path === 'title.canonical') data.canonicalTitle = ch.newValue;
        if (ch.path === 'category') data.category = ch.newValue;
        if (ch.path === 'lyrics.devanagari') data.lyricsDevanagari = ch.newValue;
        if (ch.path === 'youtube.url') data.youtubeUrl = ch.newValue;
        if (ch.path === 'credits.album') data.album = ch.newValue;
        if (ch.path === 'traditional_raga') data.traditionalRaga = ch.newValue;
      }
    }

    setFormData(data);
    setErrorMessage('');
  }, [song, prefilledChanges, isOpen]);

  if (!isOpen || !formData) return null;

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleAutoTransliterateTitle = () => {
    if (formData.canonicalTitle) {
      handleChange('romanTitle', toRoman(formData.canonicalTitle));
    }
  };

  const handleAutoTransliterateLyrics = () => {
    if (formData.lyricsDevanagari) {
      handleChange('lyricsRoman', toRoman(formData.lyricsDevanagari));
    }
  };

  const handleYoutubeUrlBlur = () => {
    if (formData.youtubeUrl) {
      const match = formData.youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      if (match && !formData.youtubeVideoId) {
        handleChange('youtubeVideoId', match[1]);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.canonicalTitle.trim()) {
      setErrorMessage('गीतक शीर्षक आवश्यक अछि।');
      return;
    }

    setSaving(true);
    setErrorMessage('');

    const payload = {
      title: {
        canonical: formData.canonicalTitle.trim(),
        devanagari: formData.canonicalTitle.trim(),
        roman: formData.romanTitle.trim() || toRoman(formData.canonicalTitle.trim()),
        raw_title: formData.rawTitle.trim() || formData.canonicalTitle.trim()
      },
      category: formData.category.trim(),
      genre: formData.genre.trim(),
      traditional_raga: formData.traditionalRaga.trim(),
      credits: {
        singer: formData.singer.trim(),
        writer: {
          name: formData.writerName.trim(),
          type: formData.writerType
        },
        composer: {
          name: formData.composerName.trim(),
          type: formData.composerType
        },
        album: formData.album.trim(),
        year: formData.year.trim()
      },
      youtube: {
        url: formData.youtubeUrl.trim(),
        video_id: formData.youtubeVideoId.trim(),
        title: formData.youtubeTitle.trim(),
        channel: formData.youtubeChannel.trim(),
        verified: formData.verificationStatus === 'verified'
      },
      audio: {
        jiosaavn_url: formData.jiosaavnUrl.trim() || null,
        apple_music_url: formData.appleMusicUrl.trim() || null,
        spotify_url: formData.spotifyUrl.trim() || null
      },
      lyrics: {
        devanagari: formData.lyricsDevanagari.trim(),
        roman: formData.lyricsRoman.trim() || (formData.lyricsDevanagari ? toRoman(formData.lyricsDevanagari) : '')
      },
      verification: {
        status: formData.verificationStatus
      },
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
    };

    try {
      const res = await fetch(`/api/admin/songs/${song.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onSaveSuccess(data.song);
        onClose();
      } else {
        setErrorMessage(data.error || 'सुरक्षित करबामे त्रुटि भेल।');
      }
    } catch (err) {
      setErrorMessage(err.message || 'नेटवर्क त्रुटि');
    } finally {
      setSaving(false);
    }
  };

  const defaultCategories = [
    'भगवती वंदना',
    'सोहर',
    'समदाउन',
    'लगनी',
    'नचारी',
    'बटगवनी',
    'विद्यापति गीत',
    'विवाह गीत',
    'महेशवाणी',
    'झिझिया',
    'कजरी',
    'मैथिली लोकगीत',
    'आधुनिक मैथिली',
    'छठि गीत'
  ];

  const uniqueCategories = Array.from(new Set([...defaultCategories, ...categories])).filter(Boolean);

  const inputStyle = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '8px',
    background: 'rgba(0, 0, 0, 0.45)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#FAFAFA',
    fontSize: '0.86rem',
    outline: 'none',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#CBD5E1',
    marginBottom: '6px'
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(4, 6, 14, 0.88)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '20px',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          background: 'linear-gradient(150deg, #0B0E1A, #060812)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.9)',
          overflow: 'hidden'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '10px',
              background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Music size={18} color="#EAB308" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="vermilion-badge" style={{ fontSize: '0.65rem' }}>गीत संपादक (Editor)</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {song.id}</span>
              </div>
              <h2 className="font-traditional" style={{ fontSize: '1.4rem', color: '#FAFAFA', margin: '2px 0 0' }}>
                {formData.canonicalTitle || 'गीत संपादन'}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <a
              href={`/songs/${song.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                textDecoration: 'none'
              }}
            >
              <ExternalLink size={13} />
              <span>लाइव देखू</span>
            </a>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '8px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          background: 'rgba(0, 0, 0, 0.2)',
          overflowX: 'auto'
        }}>
          {[
            { id: 'basic', label: '१. मूल विवरण (Basic Info)' },
            { id: 'credits', label: '२. श्रेय (Credits)' },
            { id: 'media', label: '३. युट्यूब एवं ऑडियो (Media)' },
            { id: 'lyrics', label: '४. गीतक बोल (Lyrics)' },
            { id: 'meta', label: '५. सत्यापन एवं टैग (Meta)' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: activeSubTab === tab.id ? '#EAB308' : 'var(--text-secondary)',
                background: activeSubTab === tab.id ? 'rgba(234, 179, 8, 0.12)' : 'transparent',
                border: activeSubTab === tab.id ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Body / Scrollable Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* SUBTAB 1: BASIC INFO */}
            {activeSubTab === 'basic' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>गीतक मुख्य शीर्षक (Devanagari Canonical Title) *</label>
                    <input
                      type="text"
                      required
                      value={formData.canonicalTitle}
                      onChange={e => handleChange('canonicalTitle', e.target.value)}
                      placeholder="उदा. जय जय भैरवि असुर-भयाउनि"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>रोमन लिपि शीर्षक (Roman Transliterated)</label>
                      <button
                        type="button"
                        onClick={handleAutoTransliterateTitle}
                        style={{
                          fontSize: '0.72rem',
                          color: '#EAB308',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <Sparkles size={11} /> स्वत: अनुवाद
                      </button>
                    </div>
                    <input
                      type="text"
                      value={formData.romanTitle}
                      onChange={e => handleChange('romanTitle', e.target.value)}
                      placeholder="e.g. Jay Jay Bhairavi Asur-Bhayauni"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>विधा / संस्कार (Category) *</label>
                    <input
                      type="text"
                      list="category-suggestions"
                      required
                      value={formData.category}
                      onChange={e => handleChange('category', e.target.value)}
                      placeholder="उदा. भगवती वंदना"
                      style={inputStyle}
                    />
                    <datalist id="category-suggestions">
                      {uniqueCategories.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>

                  <div>
                    <label style={labelStyle}>संगीत विधा (Genre)</label>
                    <input
                      type="text"
                      value={formData.genre}
                      onChange={e => handleChange('genre', e.target.value)}
                      placeholder="उदा. Maithili Folk / Classical"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>पारंपरिक राग (Traditional Raga)</label>
                    <input
                      type="text"
                      value={formData.traditionalRaga}
                      onChange={e => handleChange('traditionalRaga', e.target.value)}
                      placeholder="उदा. राग मालकौंस / राग भैरवी"
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 2: CREDITS */}
            {activeSubTab === 'credits' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>गायक / गायिका (Singer)</label>
                    <input
                      type="text"
                      value={formData.singer}
                      onChange={e => handleChange('singer', e.target.value)}
                      placeholder="उदा. शारदा सिन्हा / उदित नारायण / पारंपरिक"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>रचयिता / कवि (Writer / Lyricist)</label>
                    <input
                      type="text"
                      value={formData.writerName}
                      onChange={e => handleChange('writerName', e.target.value)}
                      placeholder="उदा. महाकवि विद्यापति / चंदा झा"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>रचयिता प्रकार (Writer Type)</label>
                    <select
                      value={formData.writerType}
                      onChange={e => handleChange('writerType', e.target.value)}
                      style={inputStyle}
                    >
                      <option value="traditional">पारंपरिक / लोक धरोहर (Traditional)</option>
                      <option value="contemporary">समकालीन / आधुनिक (Contemporary)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>संगीतकार (Composer)</label>
                    <input
                      type="text"
                      value={formData.composerName}
                      onChange={e => handleChange('composerName', e.target.value)}
                      placeholder="उदा. पारंपरिक / Traditional"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>एल्बम (Album Name)</label>
                    <input
                      type="text"
                      value={formData.album}
                      onChange={e => handleChange('album', e.target.value)}
                      placeholder="उदा. मैथिली लोकगीत संग्रह, Vol. 1"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>वर्ष (Release Year)</label>
                    <input
                      type="text"
                      value={formData.year}
                      onChange={e => handleChange('year', e.target.value)}
                      placeholder="उदा. 2022"
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 3: MEDIA LINKS */}
            {activeSubTab === 'media' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>युट्यूब वीडियो URL (YouTube URL)</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="url"
                        value={formData.youtubeUrl}
                        onChange={e => handleChange('youtubeUrl', e.target.value)}
                        onBlur={handleYoutubeUrlBlur}
                        placeholder="https://www.youtube.com/watch?v=..."
                        style={{ ...inputStyle, paddingLeft: '36px' }}
                      />
                      <div style={{ position: 'absolute', left: '10px', top: '10px' }}>
                        <YoutubeIcon size={16} color="#EF4444" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>YouTube Video ID</label>
                    <input
                      type="text"
                      value={formData.youtubeVideoId}
                      onChange={e => handleChange('youtubeVideoId', e.target.value)}
                      placeholder="e.g. bJFcsFe79kE"
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Live YouTube Preview Card */}
                {formData.youtubeVideoId && (
                  <div style={{
                    padding: '14px',
                    borderRadius: '12px',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                  }}>
                    <img
                      src={`https://img.youtube.com/vi/${formData.youtubeVideoId}/hqdefault.jpg`}
                      alt="Thumbnail"
                      style={{ width: '120px', height: '68px', objectFit: 'cover', borderRadius: '8px' }}
                    />
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#FAFAFA' }}>
                        {formData.youtubeTitle || formData.canonicalTitle}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        वीडियो ID: {formData.youtubeVideoId}
                      </div>
                      <a
                        href={`https://www.youtube.com/watch?v=${formData.youtubeVideoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '0.75rem', color: '#60A5FA', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '4px' }}
                      >
                        <span>युट्यूब पर चलाउ</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={labelStyle}>JioSaavn Link</label>
                    <input
                      type="url"
                      value={formData.jiosaavnUrl}
                      onChange={e => handleChange('jiosaavnUrl', e.target.value)}
                      placeholder="https://www.jiosaavn.com/song/..."
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Apple Music Link</label>
                    <input
                      type="url"
                      value={formData.appleMusicUrl}
                      onChange={e => handleChange('appleMusicUrl', e.target.value)}
                      placeholder="https://music.apple.com/..."
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Spotify Link</label>
                    <input
                      type="url"
                      value={formData.spotifyUrl}
                      onChange={e => handleChange('spotifyUrl', e.target.value)}
                      placeholder="https://open.spotify.com/..."
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* SUBTAB 4: LYRICS */}
            {activeSubTab === 'lyrics' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ ...labelStyle, marginBottom: 0 }}>देवनागरी लिपि मे संपूर्ण बोल (Devanagari Lyrics)</label>
                    <button
                      type="button"
                      onClick={handleAutoTransliterateLyrics}
                      style={{
                        fontSize: '0.72rem',
                        color: '#EAB308',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      <Sparkles size={11} /> रोमन लिपि मे अनुवाद करू
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    value={formData.lyricsDevanagari}
                    onChange={e => handleChange('lyricsDevanagari', e.target.value)}
                    placeholder="जय जय भैरवि असुर-भयाउनि,&#10;पशुपति-भामिनि माया।&#10;सहज सुमति वर दिअ गोसाउनि,&#10;अनुगति गति तुअ पाया।।"
                    style={{
                      ...inputStyle,
                      resize: 'vertical',
                      lineHeight: 1.6,
                      fontFamily: 'inherit',
                      fontSize: '0.92rem'
                    }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>रोमन लिपि मे बोल (Roman Transliterated Lyrics)</label>
                  <textarea
                    rows={6}
                    value={formData.lyricsRoman}
                    onChange={e => handleChange('lyricsRoman', e.target.value)}
                    placeholder="Jay jay bhairavi asur-bhayauni,&#10;Pashupati-bhamini maya..."
                    style={{
                      ...inputStyle,
                      resize: 'vertical',
                      lineHeight: 1.6,
                      fontFamily: 'inherit',
                      fontSize: '0.86rem'
                    }}
                  />
                </div>
              </div>
            )}

            {/* SUBTAB 5: METADATA & VERIFICATION */}
            {activeSubTab === 'meta' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div>
                  <label style={labelStyle}>सत्यापन स्थिति (Verification Status)</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      borderRadius: '10px',
                      background: formData.verificationStatus === 'verified' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.03)',
                      border: formData.verificationStatus === 'verified' ? '1px solid #10B981' : '1px solid rgba(255,255,255,0.1)',
                      color: formData.verificationStatus === 'verified' ? '#6EE7B7' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.86rem',
                      fontWeight: 600
                    }}>
                      <input
                        type="radio"
                        name="vstatus"
                        checked={formData.verificationStatus === 'verified'}
                        onChange={() => handleChange('verificationStatus', 'verified')}
                      />
                      <CheckCircle2 size={16} />
                      <span>सत्यापित (Verified)</span>
                    </label>

                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      borderRadius: '10px',
                      background: formData.verificationStatus === 'pending_review' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.03)',
                      border: formData.verificationStatus === 'pending_review' ? '1px solid #EAB308' : '1px solid rgba(255,255,255,0.1)',
                      color: formData.verificationStatus === 'pending_review' ? '#FCD34D' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '0.86rem',
                      fontWeight: 600
                    }}>
                      <input
                        type="radio"
                        name="vstatus"
                        checked={formData.verificationStatus === 'pending_review'}
                        onChange={() => handleChange('verificationStatus', 'pending_review')}
                      />
                      <Clock size={16} />
                      <span>समीक्षाधीन (Pending Review)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>टैग्स (Tags - अल्पविराम सं अलग करू)</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={e => handleChange('tags', e.target.value)}
                    placeholder="उदा. विद्यापति, भगवती वंदना, पारंपरिक, शारदा सिन्हा"
                    style={inputStyle}
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                    खोज एवं वर्गीकरण सुगम बनाबय लेल टैग लिखू
                  </span>
                </div>
              </div>
            )}

            {errorMessage && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#FCA5A5',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 0, 0, 0.4)'
          }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 18px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              रद्द करू (Cancel)
            </button>

            <button
              type="submit"
              disabled={saving}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 24px',
                borderRadius: '10px',
                background: '#EAB308',
                border: 'none',
                color: '#070913',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: saving ? 'wait' : 'pointer',
                boxShadow: '0 4px 16px rgba(234, 179, 8, 0.35)'
              }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{saving ? 'सुरक्षित भ\' रहल अछि...' : 'परिवर्तन सुरक्षित करू (Save Changes)'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
