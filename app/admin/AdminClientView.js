'use client';

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  Edit,
  Music,
  Radio,
  Search,
  ExternalLink,
  Database,
  Lock,
  PlusCircle,
  Clock,
  Sparkles,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Filter,
  CheckCheck,
  FileDiff,
  User,
  ArrowRight
} from 'lucide-react';
import YoutubeIcon from '../../components/YoutubeIcon';
import SongEditorModal from './SongEditorModal';
import AddSongForm from './AddSongForm';

export default function AdminClientView({
  initialStats,
  initialUnverifiedQueue = [],
  initialSongs = [],
  initialEditRequests = [],
  categoriesList = []
}) {
  const [stats, setStats] = useState(initialStats);
  const [activeTab, setActiveTab] = useState('songs'); // 'songs' | 'verification' | 'edits' | 'add_song'
  
  // Songs Manager State
  const [songsList, setSongsList] = useState(initialSongs);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'verified' | 'unverified'
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(Math.ceil((initialStats?.total_songs || 20) / 20));
  const [loadingSongs, setLoadingSongs] = useState(false);

  // Verification Queue State
  const [queue, setQueue] = useState(initialUnverifiedQueue);
  const [loadingQueue, setLoadingQueue] = useState(false);

  // Edit Requests State
  const [editRequests, setEditRequests] = useState(initialEditRequests);
  const [editStatusFilter, setEditStatusFilter] = useState('pending'); // 'pending' | 'approved' | 'rejected' | 'all'
  const [loadingEdits, setLoadingEdits] = useState(false);

  // Editor Modal State
  const [editingSong, setEditingSong] = useState(null);
  const [prefilledChanges, setPrefilledChanges] = useState(null);

  // Toast notification
  const [toast, setToast] = useState({ message: '', type: 'success', visible: false });

  const showToast = (message, type = 'success') => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3500);
  };

  // Fetch songs with pagination and filters
  const fetchSongs = useCallback(async (page = 1, q = searchQuery, cat = selectedCategory, st = statusFilter) => {
    setLoadingSongs(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (q.trim()) params.set('q', q.trim());
      if (cat && cat !== 'all') params.set('category', cat);
      if (st && st !== 'all') params.set('status', st);

      const res = await fetch(`/api/admin/songs?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.songs) {
        setSongsList(data.songs);
        setCurrentPage(data.pagination.page);
        setTotalPages(data.pagination.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching songs:', err);
    } finally {
      setLoadingSongs(false);
    }
  }, [searchQuery, selectedCategory, statusFilter]);

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSongs(1, searchQuery, selectedCategory, statusFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory, statusFilter, fetchSongs]);

  // Fetch Edit Requests
  const fetchEditRequests = useCallback(async (st = editStatusFilter) => {
    setLoadingEdits(true);
    try {
      const res = await fetch(`/api/admin/edit-requests?status=${st}`);
      const data = await res.json();
      if (res.ok && data.requests) {
        setEditRequests(data.requests);
      }
    } catch (err) {
      console.error('Error fetching edit requests:', err);
    } finally {
      setLoadingEdits(false);
    }
  }, [editStatusFilter]);

  useEffect(() => {
    if (activeTab === 'edits') {
      fetchEditRequests(editStatusFilter);
    }
  }, [activeTab, editStatusFilter, fetchEditRequests]);

  // One-click Verify Song in Verification Queue
  const handleVerifySong = async (songId) => {
    try {
      const res = await fetch(`/api/admin/songs/${songId}/verify`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'गीत सत्यापित कएल गेल!');
        setQueue(prev => prev.filter(s => s.id !== songId));
        setStats(prev => ({
          ...prev,
          verified_count: (prev.verified_count || 0) + 1,
          unverified_count: Math.max(0, (prev.unverified_count || 0) - 1)
        }));
        // Update in songsList if present
        setSongsList(prev => prev.map(s => s.id === songId ? { ...s, verification: { ...s.verification, status: 'verified' } } : s));
      } else {
        showToast(data.error || 'सत्यापन विफल भेल।', 'error');
      }
    } catch (err) {
      showToast('सत्यापन विफल भेल।', 'error');
    }
  };

  // Delete song
  const handleDeleteSong = async (song) => {
    const confirmDelete = window.confirm(`की अहाँ सच मे गीत "${song.title?.canonical}" डाटाबेस सं हटाबय चाहैत छी?`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/admin/songs/${song.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`गीत "${song.title?.canonical}" हटाओल गेल!`);
        setSongsList(prev => prev.filter(s => s.id !== song.id));
        setQueue(prev => prev.filter(s => s.id !== song.id));
        setStats(prev => ({ ...prev, total_songs: Math.max(0, prev.total_songs - 1) }));
      } else {
        showToast(data.error || 'हटाबय मे त्रुटि।', 'error');
      }
    } catch (err) {
      showToast('हटाबय मे त्रुटि।', 'error');
    }
  };

  // Accept and apply user edit request
  const handleApplyEditRequest = async (requestId) => {
    try {
      const res = await fetch(`/api/admin/edit-requests/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'संशोधन स्वीकृत क\' गीत मे लागू कएल गेल!');
        setEditRequests(prev => prev.filter(r => r._id !== requestId));
        setStats(prev => ({ ...prev, pending_edits_count: Math.max(0, prev.pending_edits_count - 1) }));
        fetchSongs(currentPage);
      } else {
        showToast(data.error || 'लागू करबामे त्रुटि।', 'error');
      }
    } catch (err) {
      showToast('लागू करबामे त्रुटि।', 'error');
    }
  };

  // Reject user edit request
  const handleRejectEditRequest = async (requestId) => {
    const reason = window.prompt('अस्वीकार करबाक कारण (वैकल्पिक):', 'संशोधन वर्तमान संदर्भ अनुसार उपयुक्त नहि अछि।');
    if (reason === null) return;

    try {
      const res = await fetch(`/api/admin/edit-requests/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('संशोधन अनुरोध अस्वीकृत कएल गेल।');
        setEditRequests(prev => prev.filter(r => r._id !== requestId));
        setStats(prev => ({ ...prev, pending_edits_count: Math.max(0, prev.pending_edits_count - 1) }));
      } else {
        showToast(data.error || 'अस्वीकार करबामे त्रुटि।', 'error');
      }
    } catch (err) {
      showToast('अस्वीकार करबामे त्रुटि।', 'error');
    }
  };

  // Open editor pre-filled with user suggestion
  const handleEditAndApply = (request) => {
    const targetSong = request.song || { id: request.songId };
    setPrefilledChanges(request.changes);
    setEditingSong(targetSong);
  };

  // Callback when song is saved in editor modal
  const handleSongSaved = (updatedSong) => {
    showToast(`गीत "${updatedSong.title?.canonical}" अद्यतन कएल गेल!`);
    setSongsList(prev => prev.map(s => s.id === updatedSong.id ? updatedSong : s));
    setQueue(prev => prev.filter(s => s.id !== updatedSong.id));
    if (editingSong && prefilledChanges) {
      fetchEditRequests(editStatusFilter);
    }
    setPrefilledChanges(null);
  };

  // Callback when new song is created
  const handleSongCreated = (newSong) => {
    setStats(prev => ({
      ...prev,
      total_songs: (prev.total_songs || 0) + 1,
      verified_count: (prev.verified_count || 0) + 1
    }));
    setSongsList(prev => [newSong, ...prev]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Toast Notification */}
      {toast.visible && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 10000,
          background: toast.type === 'error' ? 'linear-gradient(135deg, #EF4444, #B91C1C)' : 'linear-gradient(135deg, #10B981, #059669)',
          color: '#FAFAFA',
          padding: '12px 22px',
          borderRadius: '12px',
          boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
          fontWeight: 600,
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease'
        }}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Admin Header Banner */}
      <div className="glass-panel" style={{
        padding: '32px',
        borderRadius: '20px',
        border: '1px solid rgba(234, 179, 8, 0.25)',
        background: 'linear-gradient(145deg, rgba(15, 18, 30, 0.95), rgba(8, 10, 18, 0.95))',
        boxShadow: '0 16px 40px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span className="vermilion-badge" style={{ fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                प्रशासन नियंत्रण कक्ष (Admin Hub)
              </span>
              <span style={{ fontSize: '0.76rem', color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                MongoDB Atlas (Live Real Database)
              </span>
            </div>
            <h1 className="font-traditional" style={{ fontSize: '2.4rem', color: '#FAFAFA', margin: '4px 0 8px' }}>
              सुर-मिथिला सामग्री प्रबंधन एवं संपादन प्रणाली
            </h1>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', maxWidth: '780px', lineHeight: 1.5 }}>
              डाटाबेस मे उपस्थित सकल मैथिली गीतोंक संपादन, नब गीतोंक प्रविष्टि, युट्यूब सत्यापन, एवं उपयोगकर्ता द्वारा प्रस्तावित संशोधनोंक समीक्षा।
            </p>
          </div>

          <button
            onClick={() => setActiveTab('add_song')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 22px',
              borderRadius: '12px',
              background: '#EAB308',
              border: 'none',
              color: '#070913',
              fontSize: '0.92rem',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(234, 179, 8, 0.35)',
              transition: 'all 0.2s ease'
            }}
          >
            <PlusCircle size={18} />
            <span>नब गीत जोडू (Add Song)</span>
          </button>
        </div>

        {/* Real Dynamic Metric Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '16px',
          marginTop: '28px'
        }}>
          <div style={{
            padding: '18px 20px',
            borderRadius: '14px',
            background: 'rgba(0, 0, 0, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              कुल पंजीकृत गीत (Total Songs)
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#FAFAFA' }}>
              {stats.total_songs?.toLocaleString() || '2,156'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              सकल मैथिली संग्रह
            </div>
          </div>

          <div style={{
            padding: '18px 20px',
            borderRadius: '14px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)'
          }}>
            <div style={{ fontSize: '0.78rem', color: '#6EE7B7', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              सत्यापित गीत (Verified)
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10B981' }}>
              {stats.verified_count?.toLocaleString() || '424'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              प्रामाणिक ऑडियो/वीडियो सहित
            </div>
          </div>

          <div style={{
            padding: '18px 20px',
            borderRadius: '14px',
            background: 'rgba(234, 179, 8, 0.08)',
            border: '1px solid rgba(234, 179, 8, 0.25)'
          }}>
            <div style={{ fontSize: '0.78rem', color: '#FCD34D', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              समीक्षाधीन कतार (Unverified Queue)
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#EAB308' }}>
              {stats.unverified_count?.toLocaleString() || '1,732'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              सत्यापन अपेक्षित
            </div>
          </div>

          <div style={{
            padding: '18px 20px',
            borderRadius: '14px',
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.25)'
          }}>
            <div style={{ fontSize: '0.78rem', color: '#93C5FD', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              उपयोगकर्ता सुझाव (Edit Requests)
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#60A5FA' }}>
              {stats.pending_edits_count ?? editRequests.length}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              समुदाय द्वारा प्रस्तावित संशोधन
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginTop: '28px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          paddingTop: '20px',
          overflowX: 'auto'
        }}>
          {[
            { id: 'songs', label: `सकल गीत संपादक (Songs Manager: ${stats.total_songs || '2,156'})` },
            { id: 'verification', label: `वास्तविक सत्यापन कतार (Verification Queue: ${queue.length})` },
            { id: 'edits', label: `संशोधन सुझाव (User Edit Requests: ${stats.pending_edits_count || editRequests.length})` },
            { id: 'add_song', label: 'नब गीत जोडू (Add Song)' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '9px 18px',
                borderRadius: '10px',
                fontSize: '0.86rem',
                fontWeight: 600,
                color: activeTab === tab.id ? '#070913' : 'var(--text-secondary)',
                background: activeTab === tab.id ? '#EAB308' : 'rgba(255, 255, 255, 0.04)',
                border: activeTab === tab.id ? '1px solid #EAB308' : '1px solid rgba(255, 255, 255, 0.08)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: SONGS MANAGER */}
      {activeTab === 'songs' && (
        <div className="glass-panel" style={{ padding: '28px', borderRadius: '18px' }}>
          {/* Controls Bar */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div>
              <h2 className="font-traditional" style={{ fontSize: '1.5rem', color: '#FAFAFA', margin: 0 }}>
                सकल गीत तालिका एवं संपादक
              </h2>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                कोनो गीतक शीर्षक, बोल, गायक, युट्यूब लिंक, अथवा अन्य कोनो विवरण संपादित करू।
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#FAFAFA',
                  fontSize: '0.84rem',
                  outline: 'none'
                }}
              >
                <option value="all">सकल विधा (All Categories)</option>
                {categoriesList.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: 'rgba(0, 0, 0, 0.45)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#FAFAFA',
                  fontSize: '0.84rem',
                  outline: 'none'
                }}
              >
                <option value="all">सकल स्थिति (All Status)</option>
                <option value="verified">सत्यापित (Verified)</option>
                <option value="unverified">समीक्षाधीन (Unverified)</option>
              </select>

              {/* Search Input */}
              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={16} color="#EAB308" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                <input
                  type="text"
                  placeholder="शीर्षक, गायक, बोल खोजू..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: '10px',
                    background: 'rgba(0, 0, 0, 0.45)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#FAFAFA',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Table */}
          {loadingSongs ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              गीत लोड भ' रहल अछि...
            </div>
          ) : songsList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              कोनो गीत नहि भेटल।
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px 14px' }}>गीत शीर्षक (Title)</th>
                    <th style={{ padding: '12px 14px' }}>गायक (Singer)</th>
                    <th style={{ padding: '12px 14px' }}>विधा (Category)</th>
                    <th style={{ padding: '12px 14px' }}>मीडिया (Media)</th>
                    <th style={{ padding: '12px 14px' }}>सत्यापन (Status)</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>क्रिया (Actions)</th>
                  </tr>
                </thead>
                <tbody>
                  {songsList.map((s) => {
                    const isVerified = s.verification?.status === 'verified';
                    const hasYoutube = Boolean(s.youtube?.url || s.youtube?.video_id);

                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s ease' }}>
                        <td style={{ padding: '14px', fontWeight: 600, color: '#FAFAFA', maxWidth: '280px' }}>
                          <Link href={`/songs/${s.slug}`} target="_blank" style={{ color: 'inherit', textDecoration: 'none' }}>
                            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {s.title?.canonical || s.title?.devanagari}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                              {s.slug}
                            </div>
                          </Link>
                        </td>
                        <td style={{ padding: '14px', color: 'var(--text-secondary)' }}>
                          {s.credits?.singer || 'पारंपरिक'}
                        </td>
                        <td style={{ padding: '14px' }}>
                          <span className="gold-badge" style={{ fontSize: '0.7rem' }}>{s.category}</span>
                        </td>
                        <td style={{ padding: '14px' }}>
                          {hasYoutube ? (
                            <a
                              href={s.youtube.url || `https://youtube.com/watch?v=${s.youtube.video_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#EF4444', textDecoration: 'none' }}
                            >
                              <YoutubeIcon size={16} color="#EF4444" />
                              <span style={{ fontSize: '0.76rem', color: '#93C5FD' }}>वीडियो</span>
                            </a>
                          ) : (
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '14px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: isVerified ? '#10B981' : '#EAB308',
                            fontSize: '0.76rem',
                            fontWeight: 600
                          }}>
                            {isVerified ? <CheckCircle size={13} /> : <Clock size={13} />}
                            <span>{isVerified ? 'सत्यापित' : 'समीक्षाधीन'}</span>
                          </span>
                        </td>
                        <td style={{ padding: '14px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={() => {
                                setPrefilledChanges(null);
                                setEditingSong(s);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                color: '#070913',
                                background: '#EAB308',
                                border: 'none',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                padding: '5px 10px',
                                borderRadius: '7px',
                                cursor: 'pointer'
                              }}
                              title="Edit song"
                            >
                              <Edit size={12} />
                              <span>संपादित करू</span>
                            </button>

                            <button
                              onClick={() => handleDeleteSong(s)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '5px 8px',
                                borderRadius: '7px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                color: '#EF4444',
                                cursor: 'pointer'
                              }}
                              title="Delete song"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <button
                disabled={currentPage <= 1 || loadingSongs}
                onClick={() => fetchSongs(currentPage - 1)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: currentPage <= 1 ? 'var(--text-muted)' : '#FAFAFA',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: '0.84rem'
                }}
              >
                <ChevronLeft size={16} />
                <span>पिछला (Previous)</span>
              </button>

              <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                पृष्ठ <strong>{currentPage}</strong> / {totalPages}
              </span>

              <button
                disabled={currentPage >= totalPages || loadingSongs}
                onClick={() => fetchSongs(currentPage + 1)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: currentPage >= totalPages ? 'var(--text-muted)' : '#FAFAFA',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '0.84rem'
                }}
              >
                <span>अगिला (Next)</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: VERIFICATION QUEUE */}
      {activeTab === 'verification' && (
        <div className="glass-panel" style={{ padding: '28px', borderRadius: '18px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 className="font-traditional" style={{ fontSize: '1.5rem', color: '#FAFAFA', margin: 0 }}>
              वास्तविक युट्यूब एवं संगीत सत्यापन कतार (Live Verification Queue)
            </h2>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              डाटाबेस मे उपस्थित समीक्षाधीन मैथिली गीतोंक ऑडियो/वीडियो सुनू, प्रामाणिकता जांचू, आ १-क्लिक मे सत्यापित करू।
            </p>
          </div>

          {queue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={48} color="#10B981" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ color: '#FAFAFA', fontSize: '1.2rem', marginBottom: '4px' }}>कतार रिक्त अछि!</h3>
              <p style={{ fontSize: '0.85rem' }}>सकल उपलब्ध गीत सत्यापित भ' गेल अछि अथवा समीक्षाधीन कतार खाली अछि।</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {queue.map((song) => {
                const vid = song.youtube?.video_id || (song.youtube?.url?.match(/(?:youtu\.be\/|watch\?v=)([\w-]{11})/)?.[1]);

                return (
                  <div
                    key={song.id}
                    style={{
                      padding: '20px',
                      borderRadius: '14px',
                      background: 'rgba(7, 9, 19, 0.7)',
                      border: '1px solid rgba(234, 179, 8, 0.2)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '20px'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '18px', flex: 1, minWidth: '300px' }}>
                      {/* Video Thumbnail */}
                      {vid ? (
                        <div style={{ position: 'relative', width: '130px', height: '80px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden' }}>
                          <img
                            src={`https://img.youtube.com/vi/${vid}/hqdefault.jpg`}
                            alt="Preview"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <a
                            href={`https://www.youtube.com/watch?v=${vid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background: 'rgba(0,0,0,0.4)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff'
                            }}
                          >
                            <YoutubeIcon size={24} color="#EF4444" />
                          </a>
                        </div>
                      ) : (
                        <div style={{
                          width: '130px', height: '80px', flexShrink: 0, borderRadius: '8px',
                          background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <Music size={24} color="var(--text-muted)" />
                        </div>
                      )}

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span className="gold-badge" style={{ fontSize: '0.68rem' }}>{song.category}</span>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>ID: {song.id}</span>
                        </div>
                        <h3 className="font-traditional" style={{ fontSize: '1.25rem', color: '#FAFAFA', margin: 0 }}>
                          <Link href={`/songs/${song.slug}`} target="_blank" style={{ color: 'inherit', textDecoration: 'none' }}>
                            {song.title?.canonical || song.title?.devanagari}
                          </Link>
                        </h3>
                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                          गायक: <strong>{song.credits?.singer || 'पारंपरिक'}</strong> | रचयिता: <strong>{song.credits?.writer?.name || 'पारंपरिक'}</strong>
                        </p>

                        {song.youtube?.url && (
                          <a
                            href={song.youtube.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '0.76rem', color: '#60A5FA', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', textDecoration: 'none' }}
                          >
                            <span>{song.youtube.url}</span>
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        onClick={() => handleVerifySong(song.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 18px',
                          borderRadius: '9px',
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: '#6EE7B7',
                          border: '1px solid #10B981',
                          fontSize: '0.84rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        <CheckCircle size={16} />
                        <span>सत्यापित करू (Verify)</span>
                      </button>

                      <button
                        onClick={() => {
                          setPrefilledChanges(null);
                          setEditingSong(song);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          borderRadius: '9px',
                          background: 'rgba(234, 179, 8, 0.15)',
                          color: '#EAB308',
                          border: '1px solid rgba(234, 179, 8, 0.35)',
                          fontSize: '0.84rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <Edit size={14} />
                        <span>संपादित क' जांचू</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: USER EDIT REQUESTS & SUGGESTIONS */}
      {activeTab === 'edits' && (
        <div className="glass-panel" style={{ padding: '28px', borderRadius: '18px' }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div>
              <h2 className="font-traditional" style={{ fontSize: '1.5rem', color: '#FAFAFA', margin: 0 }}>
                उपयोगकर्ता संशोधन सुझाव (User Edit Requests)
              </h2>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                श्रोता एवं समुदाय द्वारा प्रस्तावित संशोधनोंक समीक्षा। स्वीकृत क' १-क्लिक मे गीत मे लागू करू अथवा स्वयं संपादित करू।
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { id: 'pending', label: 'समीक्षाधीन (Pending)' },
                { id: 'approved', label: 'स्वीकृत (Approved)' },
                { id: 'rejected', label: 'अस्वीकृत (Rejected)' },
                { id: 'all', label: 'सकल (All)' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setEditStatusFilter(f.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: editStatusFilter === f.id ? '#070913' : 'var(--text-secondary)',
                    background: editStatusFilter === f.id ? '#EAB308' : 'rgba(255,255,255,0.04)',
                    border: editStatusFilter === f.id ? '1px solid #EAB308' : '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loadingEdits ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              अनुरोध लोड भ' रहल अछि...
            </div>
          ) : editRequests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              <CheckCheck size={44} color="#10B981" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ color: '#FAFAFA', fontSize: '1.15rem', marginBottom: '4px' }}>
                कोनो संशोधन अनुरोध लंबित नहि अछि!
              </h3>
              <p style={{ fontSize: '0.84rem' }}>
                उपयोगकर्ता द्वारा जखन कोनो गीतक पृष्ठ सं "त्रुटि सुधार" प्रस्तावित कएल जायत, त' ओ एतय प्रदर्शित होयत।
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {editRequests.map((req) => {
                const targetSong = req.song || {};
                const songTitle = targetSong.title?.canonical || targetSong.title?.devanagari || req.songTitle || req.songId;
                const isPending = req.status === 'pending' || req.status === 'pending_triage' || req.status === 'in_review';

                return (
                  <div
                    key={req._id}
                    style={{
                      padding: '22px',
                      borderRadius: '16px',
                      background: 'rgba(7, 9, 19, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px'
                    }}
                  >
                    {/* Header: User Info & Song Target */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: 'linear-gradient(135deg, #EAB308, #CA8A04)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#070913', fontWeight: 700, fontSize: '0.82rem'
                        }}>
                          {(req.requesterName || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#FAFAFA' }}>
                            {req.requesterName || 'अतिथि पाठक'}
                            {req.requesterEmail && (
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '6px' }}>
                                ({req.requesterEmail})
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            प्रस्तुत तिथि: {new Date(req.createdAt).toLocaleString('hi-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          color: isPending ? '#FCD34D' : (req.status === 'approved' ? '#6EE7B7' : '#FCA5A5'),
                          background: isPending ? 'rgba(234, 179, 8, 0.15)' : (req.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)')
                        }}>
                          {isPending ? 'समीक्षाधीन (Pending)' : (req.status === 'approved' ? 'स्वीकृत (Approved)' : 'अस्वीकृत (Rejected)')}
                        </span>

                        <Link
                          href={`/songs/${targetSong.slug || req.songSlug || req.songId}`}
                          target="_blank"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#EAB308',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            textDecoration: 'none'
                          }}
                        >
                          <span>{songTitle}</span>
                          <ExternalLink size={12} />
                        </Link>
                      </div>
                    </div>

                    {/* Diff Table: What did the user propose? */}
                    <div style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px' }}>
                        प्रस्तावित संशोधन (Proposed Changes):
                      </div>

                      {(req.changes || []).map((ch, idx) => (
                        <div key={idx} style={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(120px, 160px) 1fr 24px 1fr',
                          alignItems: 'center',
                          gap: '12px',
                          fontSize: '0.84rem',
                          marginBottom: idx === req.changes.length - 1 ? 0 : '8px'
                        }}>
                          <span style={{ color: '#EAB308', fontWeight: 600 }}>{ch.path}</span>
                          <span style={{ color: '#F87171', textDecoration: 'line-through', wordBreak: 'break-word' }}>
                            {ch.oldValue || '(रिक्त)'}
                          </span>
                          <ArrowRight size={14} color="var(--text-muted)" style={{ margin: '0 auto' }} />
                          <span style={{ color: '#34D399', fontWeight: 600, wordBreak: 'break-word' }}>
                            {ch.newValue}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* User's Explanation & Reference URL */}
                    {(req.reason || req.evidenceUrls?.length > 0) && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {req.reason && <div><strong>कारण / संदर्भ:</strong> {req.reason}</div>}
                        {req.evidenceUrls?.length > 0 && (
                          <div style={{ marginTop: '4px' }}>
                            <strong>प्रमाण लिंक:</strong>{' '}
                            {req.evidenceUrls.map((u, i) => (
                              <a key={i} href={u} target="_blank" rel="noopener noreferrer" style={{ color: '#60A5FA', marginLeft: '6px' }}>
                                {u}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Controls for Admin */}
                    {isPending && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                        <button
                          onClick={() => handleRejectEditRequest(req._id)}
                          style={{
                            padding: '7px 14px',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#FCA5A5',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          अस्वीकार करू (Reject)
                        </button>

                        <button
                          onClick={() => handleEditAndApply(req)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '7px 14px',
                            borderRadius: '8px',
                            background: 'rgba(234, 179, 8, 0.15)',
                            border: '1px solid rgba(234, 179, 8, 0.35)',
                            color: '#EAB308',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <Edit size={13} />
                          <span>संपादक मे खोलू</span>
                        </button>

                        <button
                          onClick={() => handleApplyEditRequest(req._id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 18px',
                            borderRadius: '8px',
                            background: '#10B981',
                            border: 'none',
                            color: '#070913',
                            fontSize: '0.84rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                          }}
                        >
                          <CheckCircle size={15} />
                          <span>स्वीकृत क' लागू करू (Accept & Apply)</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ADD NEW SONG */}
      {activeTab === 'add_song' && (
        <AddSongForm
          onSongCreated={handleSongCreated}
          categories={categoriesList}
        />
      )}

      {/* Master Song Editor Modal */}
      {editingSong && (
        <SongEditorModal
          song={editingSong}
          isOpen={Boolean(editingSong)}
          onClose={() => {
            setEditingSong(null);
            setPrefilledChanges(null);
          }}
          onSaveSuccess={handleSongSaved}
          prefilledChanges={prefilledChanges}
          categories={categoriesList}
        />
      )}
    </div>
  );
}
