'use client';

import React, { useState } from 'react';
import {
  PlusCircle,
  Music,
  Save,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink
} from 'lucide-react';
import { toRoman } from '../../lib/slugs';
import YoutubeIcon from '../../components/YoutubeIcon';

export default function AddSongForm({ onSongCreated, categories = [] }) {
  const [formData, setFormData] = useState({
    canonicalTitle: '',
    romanTitle: '',
    category: 'भगवती वंदना',
    genre: 'पारंपरिक मैथिली',
    traditionalRaga: '',
    singer: 'पारंपरिक',
    writerName: 'महाकवि विद्यापति',
    writerType: 'traditional',
    composerName: 'पारंपरिक / Traditional',
    composerType: 'folk',
    album: '',
    year: '',
    youtubeUrl: '',
    youtubeVideoId: '',
    jiosaavnUrl: '',
    appleMusicUrl: '',
    lyricsDevanagari: '',
    lyricsRoman: '',
    verified: true,
    tags: 'मैथिली लोकगीत, पारंपरिक'
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

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
      setErrorMsg('गीतक मुख्य शीर्षक (Title) आवश्यक अछि।');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    const payload = {
      titleCanonical: formData.canonicalTitle.trim(),
      title: {
        canonical: formData.canonicalTitle.trim(),
        devanagari: formData.canonicalTitle.trim(),
        roman: formData.romanTitle.trim() || toRoman(formData.canonicalTitle.trim()),
        raw_title: formData.canonicalTitle.trim()
      },
      category: formData.category.trim(),
      genre: formData.genre.trim(),
      traditional_raga: formData.traditionalRaga.trim(),
      credits: {
        singer: formData.singer.trim() || 'पारंपरिक',
        writer: {
          name: formData.writerName.trim() || 'पारंपरिक',
          type: formData.writerType
        },
        composer: {
          name: formData.composerName.trim() || 'पारंपरिक / Traditional',
          type: formData.composerType
        },
        album: formData.album.trim(),
        year: formData.year.trim()
      },
      youtube: {
        url: formData.youtubeUrl.trim(),
        video_id: formData.youtubeVideoId.trim(),
        verified: formData.verified
      },
      audio: {
        jiosaavn_url: formData.jiosaavnUrl.trim() || null,
        apple_music_url: formData.appleMusicUrl.trim() || null
      },
      lyrics: {
        devanagari: formData.lyricsDevanagari.trim(),
        roman: formData.lyricsRoman.trim() || (formData.lyricsDevanagari ? toRoman(formData.lyricsDevanagari) : '')
      },
      verified: formData.verified,
      tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
    };

    try {
      const res = await fetch('/api/admin/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`गीत "${data.song.title.canonical}" सफलता पूर्वक डाटाबेस मे जोडि देल गेल!`);
        onSongCreated && onSongCreated(data.song);
        // Reset form
        setFormData({
          canonicalTitle: '',
          romanTitle: '',
          category: 'भगवती वंदना',
          genre: 'पारंपरिक मैथिली',
          traditionalRaga: '',
          singer: 'पारंपरिक',
          writerName: '',
          writerType: 'traditional',
          composerName: 'पारंपरिक / Traditional',
          composerType: 'folk',
          album: '',
          year: '',
          youtubeUrl: '',
          youtubeVideoId: '',
          jiosaavnUrl: '',
          appleMusicUrl: '',
          lyricsDevanagari: '',
          lyricsRoman: '',
          verified: true,
          tags: 'मैथिली लोकगीत, पारंपरिक'
        });
      } else {
        setErrorMsg(data.error || 'गीत सुरक्षित करबामे त्रुटि भेल।');
      }
    } catch (err) {
      setErrorMsg(err.message || 'नेटवर्क त्रुटि');
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
    padding: '10px 14px',
    borderRadius: '10px',
    background: 'rgba(0, 0, 0, 0.45)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#FAFAFA',
    fontSize: '0.88rem',
    outline: 'none',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#E2E8F0',
    marginBottom: '6px'
  };

  return (
    <div className="glass-panel" style={{ padding: '32px', borderRadius: '18px', border: '1px solid rgba(234, 179, 8, 0.25)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px',
          background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <PlusCircle size={22} color="#EAB308" />
        </div>
        <div>
          <h2 className="font-traditional" style={{ fontSize: '1.6rem', color: '#FAFAFA', margin: 0 }}>
            नब गीत जोडू (Add New Song)
          </h2>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: 0 }}>
            सुर-मिथिला कैटलॉग मे नब मैथिली गीतक संपूर्ण विवरण, बोल एवं मीडिया प्रविष्ट करू।
          </p>
        </div>
      </div>

      {successMsg && (
        <div style={{
          margin: '20px 0',
          padding: '14px 18px',
          borderRadius: '12px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          color: '#6EE7B7',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <CheckCircle2 size={18} color="#10B981" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div style={{
          margin: '20px 0',
          padding: '14px 18px',
          borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#FCA5A5',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={18} color="#EF4444" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Section 1: Basic Info */}
        <div style={{
          padding: '20px',
          borderRadius: '14px',
          background: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <h3 style={{ fontSize: '0.96rem', color: '#EAB308', margin: '0 0 16px', fontWeight: 600 }}>
            १. मूल विवरण (Basic Song Info)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div>
              <label style={labelStyle}>गीतक मुख्य शीर्षक (Devanagari Canonical Title) *</label>
              <input
                type="text"
                required
                value={formData.canonicalTitle}
                onChange={e => handleChange('canonicalTitle', e.target.value)}
                placeholder="उदा. बड सुखसार पाओल तुअ तीरे"
                style={inputStyle}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>रोमन लिपि शीर्षक (Roman Title)</label>
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
                placeholder="e.g. Bad Sukhasar Paol Tua Tire"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>विधा / संस्कार (Category) *</label>
              <input
                type="text"
                list="add-category-suggestions"
                required
                value={formData.category}
                onChange={e => handleChange('category', e.target.value)}
                placeholder="उदा. भगवती वंदना"
                style={inputStyle}
              />
              <datalist id="add-category-suggestions">
                {uniqueCategories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            <div>
              <label style={labelStyle}>पारंपरिक राग (Traditional Raga)</label>
              <input
                type="text"
                value={formData.traditionalRaga}
                onChange={e => handleChange('traditionalRaga', e.target.value)}
                placeholder="उदा. राग मालकौंस / राग यमन"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Credits */}
        <div style={{
          padding: '20px',
          borderRadius: '14px',
          background: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <h3 style={{ fontSize: '0.96rem', color: '#EAB308', margin: '0 0 16px', fontWeight: 600 }}>
            २. कलाकार एवं रचयिता श्रेय (Credits)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            <div>
              <label style={labelStyle}>गायक / गायिका (Singer)</label>
              <input
                type="text"
                value={formData.singer}
                onChange={e => handleChange('singer', e.target.value)}
                placeholder="उदा. शारदा सिन्हा / पारंपरिक"
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
                placeholder="उदा. मैथिली लोकगीत संग्रह"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Media & YouTube */}
        <div style={{
          padding: '20px',
          borderRadius: '14px',
          background: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <h3 style={{ fontSize: '0.96rem', color: '#EAB308', margin: '0 0 16px', fontWeight: 600 }}>
            ३. युट्यूब एवं ऑडियो लिंक (Media Links)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            <div>
              <label style={labelStyle}>YouTube URL</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="url"
                  value={formData.youtubeUrl}
                  onChange={e => handleChange('youtubeUrl', e.target.value)}
                  onBlur={handleYoutubeUrlBlur}
                  placeholder="https://www.youtube.com/watch?v=..."
                  style={{ ...inputStyle, paddingLeft: '38px' }}
                />
                <div style={{ position: 'absolute', left: '12px', top: '12px' }}>
                  <YoutubeIcon size={16} color="#EF4444" />
                </div>
              </div>
            </div>

            <div>
              <label style={labelStyle}>YouTube Video ID (Auto-extracted)</label>
              <input
                type="text"
                value={formData.youtubeVideoId}
                onChange={e => handleChange('youtubeVideoId', e.target.value)}
                placeholder="e.g. bJFcsFe79kE"
                style={inputStyle}
              />
            </div>

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
          </div>
        </div>

        {/* Section 4: Lyrics */}
        <div style={{
          padding: '20px',
          borderRadius: '14px',
          background: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '0.96rem', color: '#EAB308', margin: 0, fontWeight: 600 }}>
              ४. गीतक बोल (Full Lyrics)
            </h3>
            <button
              type="button"
              onClick={handleAutoTransliterateLyrics}
              style={{
                fontSize: '0.74rem',
                color: '#EAB308',
                background: 'rgba(234, 179, 8, 0.1)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Sparkles size={12} /> रोमन लिपि मे स्वत: अनुवाद
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            <div>
              <label style={labelStyle}>देवनागरी लिपि मे संपूर्ण बोल (Devanagari)</label>
              <textarea
                rows={9}
                value={formData.lyricsDevanagari}
                onChange={e => handleChange('lyricsDevanagari', e.target.value)}
                placeholder="गीतक संपूर्ण बोल अहाँ एतय लिखू..."
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
              <label style={labelStyle}>रोमन लिपि मे बोल (Roman)</label>
              <textarea
                rows={9}
                value={formData.lyricsRoman}
                onChange={e => handleChange('lyricsRoman', e.target.value)}
                placeholder="Romanized transliteration of lyrics..."
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
        </div>

        {/* Section 5: Verification & Tags */}
        <div style={{
          padding: '20px',
          borderRadius: '14px',
          background: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <label style={labelStyle}>टैग्स (Tags - अल्पविराम सं अलग करू)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={e => handleChange('tags', e.target.value)}
              placeholder="उदा. विद्यापति, भगवती वंदना, पारंपरिक"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '16px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              color: '#FAFAFA',
              fontSize: '0.88rem',
              fontWeight: 600
            }}>
              <input
                type="checkbox"
                checked={formData.verified}
                onChange={e => handleChange('verified', e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#EAB308' }}
              />
              <span>तुरंत सत्यापित (Verified) घोषित करू</span>
            </label>
          </div>
        </div>

        {/* Submit Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 32px',
              borderRadius: '12px',
              background: '#EAB308',
              border: 'none',
              color: '#070913',
              fontSize: '0.96rem',
              fontWeight: 800,
              cursor: saving ? 'wait' : 'pointer',
              boxShadow: '0 4px 20px rgba(234, 179, 8, 0.4)',
              transition: 'all 0.2s ease'
            }}
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            <span>{saving ? 'गीत जोडि रहल अछि...' : 'नब गीत डाटाबेस मे जोडू (Create Song)'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
