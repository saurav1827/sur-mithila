'use client';

import React, { useState, useMemo } from 'react';
import { X, Edit3, Send, CheckCircle2, AlertCircle, Sparkles, FileText, Link as LinkIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function SuggestEditModal({ song, isOpen, onClose }) {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [field, setField] = useState('credits.singer');
  const [newValue, setNewValue] = useState('');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'submitting' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  const currentValues = useMemo(() => {
    if (!song) return {};
    return {
      'credits.singer': song.credits?.singer || '',
      'credits.writer.name': song.credits?.writer?.name || '',
      'credits.composer.name': song.credits?.composer?.name || '',
      'title.canonical': song.title?.canonical || song.title?.devanagari || '',
      'category': song.category || '',
      'traditional_raga': song.traditional_raga || '',
      'credits.album': song.credits?.album || '',
      'youtube.url': song.youtube?.url || '',
      'lyrics.devanagari': song.lyrics?.devanagari || '',
      'general': ''
    };
  }, [song]);

  if (!isOpen || !song) return null;

  const currentVal = currentValues[field] || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newValue.trim() && field !== 'general') {
      setErrorMessage('कृपया प्रस्तावित नव मान (Correct Value) भरू।');
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    const payload = {
      songId: song.id,
      workId: song.workId || song.id,
      songTitle: song.title?.canonical || '',
      songSlug: song.slug || '',
      userId: user?.id || null,
      userName: user?.name || '',
      userEmail: user?.email || '',
      changes: [{
        path: field,
        oldValue: currentVal,
        newValue: newValue.trim()
      }],
      reason: reason.trim(),
      evidenceUrls: evidence.trim() ? [evidence.trim()] : []
    };

    try {
      const res = await fetch('/api/edit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus('success');
        setTimeout(() => {
          onClose();
          setStatus('idle');
          setNewValue('');
          setReason('');
          setEvidence('');
        }, 2200);
      } else {
        setStatus('error');
        setErrorMessage(data.error || 'त्रुटि सुधार प्रेषित करबामे समस्या भेल।');
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage('सर्वर सं संपर्क नहि भ सकल।');
    }
  };

  const isMultilineField = field === 'lyrics.devanagari' || field === 'general';

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
        background: 'rgba(5, 7, 15, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '28px',
          position: 'relative',
          borderRadius: '18px',
          border: '1px solid rgba(234, 179, 8, 0.25)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
          background: 'linear-gradient(145deg, rgba(15, 18, 30, 0.98), rgba(8, 10, 18, 0.98))',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            color: 'var(--text-muted)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Edit3 size={18} color="#EAB308" />
          </div>
          <div>
            <h3 className="font-traditional" style={{ fontSize: '1.35rem', color: '#FAFAFA', margin: 0 }}>
              {t('संशोधन अथवा त्रुटि सुधार प्रस्ताव', 'Suggest Song Edit')}
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#EAB308', fontWeight: 500 }}>
              {song.title?.canonical || song.title?.devanagari}
            </span>
          </div>
        </div>

        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.4 }}>
          {t(
            'अपन सुझाव प्रस्तुत करू। प्रशासक (Admin) द्वारा समीक्षा क\' ई परिवर्तन गीत मे तुरंत लागू क\' देल जायत।',
            'Submit your proposed correction. The administrator will review and apply it directly to the catalog.'
          )}
        </p>

        {status === 'success' ? (
          <div style={{ textAlign: 'center', padding: '36px 12px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
            }}>
              <CheckCircle2 size={36} color="#10B981" />
            </div>
            <h4 style={{ color: '#FAFAFA', fontSize: '1.2rem', marginBottom: '8px', fontWeight: 600 }}>
              {t('सुझाव सफलता पूर्वक प्रेषित भेल!', 'Edit Suggestion Submitted!')}
            </h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {t('प्रशासक कतार मे ई संशोधन समीक्षा लेल सुरक्षित क\' देल गेल अछि। धन्यवाद!', 'Your suggested correction is now queued for admin review. Thank you!')}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Field selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#E2E8F0', fontWeight: 600, marginBottom: '6px' }}>
                {t('कोन क्षेत्र मे सुधार चाही? (Field to Correct)', 'Which field needs correction?')}
              </label>
              <select
                value={field}
                onChange={(e) => {
                  setField(e.target.value);
                  setNewValue('');
                }}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#FAFAFA',
                  fontSize: '0.86rem',
                  outline: 'none',
                }}
              >
                <option value="credits.singer">गायक / गायिका (Singer)</option>
                <option value="credits.writer.name">रचयिता / कवि / गीतकार (Lyricist / Poet)</option>
                <option value="credits.composer.name">संगीतकार (Composer)</option>
                <option value="title.canonical">गीत शीर्षक (Song Title)</option>
                <option value="category">विधा / संस्कार (Category)</option>
                <option value="traditional_raga">राग / शास्त्रीय आधार (Traditional Raga)</option>
                <option value="youtube.url">युट्यूब लिंक (YouTube Video Link)</option>
                <option value="lyrics.devanagari">गीतक बोल (Lyrics - Devanagari)</option>
                <option value="credits.album">एल्बम / वर्ष (Album / Year)</option>
                <option value="general">सामान्य संशोधन / अन्य टिप्पणी (General Suggestion)</option>
              </select>
            </div>

            {/* Current Value Display */}
            {currentVal && field !== 'general' && (
              <div style={{
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(234, 179, 8, 0.08)',
                border: '1px dashed rgba(234, 179, 8, 0.3)',
                fontSize: '0.78rem',
              }}>
                <span style={{ color: '#EAB308', fontWeight: 600 }}>{t('वर्तमान विवरण (Current Value): ', 'Current: ')}</span>
                <span style={{ color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                  {currentVal.length > 120 ? `${currentVal.slice(0, 120)}...` : currentVal}
                </span>
              </div>
            )}

            {/* Proposed Value */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#E2E8F0', fontWeight: 600, marginBottom: '6px' }}>
                {t('प्रस्तावित शुद्ध मान (Proposed Correct Value):', 'Proposed Correct Value:')}{' '}
                <span style={{ color: '#EF4444' }}>*</span>
              </label>
              {isMultilineField ? (
                <textarea
                  required={field !== 'general'}
                  rows={4}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={field === 'lyrics.devanagari' ? 'संपूर्ण शुद्ध बोल अहाँ एतय लिखू...' : 'सुझाव विस्तार सं लिखू...'}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#FAFAFA',
                    fontSize: '0.86rem',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              ) : (
                <input
                  type="text"
                  required
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={t('सही मान लिखू...', 'Enter proposed correct value...')}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    background: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#FAFAFA',
                    fontSize: '0.86rem',
                    outline: 'none',
                  }}
                />
              )}
            </div>

            {/* Reason */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#E2E8F0', fontWeight: 600, marginBottom: '6px' }}>
                {t('कारण / स्रोत (Why is this correct?):', 'Reason / Explanation:')}{' '}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({t('ऐच्छिक', 'optional')})</span>
              </label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('संक्षिप्त टिप्पणी लिखू (उदा. मूल पुस्तक / प्रामाणिक ऑडियो अनुसार)...', 'Brief note (e.g. from original album/book)...')}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#FAFAFA',
                  fontSize: '0.84rem',
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Evidence Link */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#E2E8F0', fontWeight: 600, marginBottom: '6px' }}>
                {t('प्रमाण लिंक (Reference / YouTube / Archive URL):', 'Reference URL:')}{' '}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({t('ऐच्छिक', 'optional')})</span>
              </label>
              <div style={{ position: 'relative' }}>
                <LinkIcon size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                <input
                  type="url"
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 34px',
                    borderRadius: '10px',
                    background: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#FAFAFA',
                    fontSize: '0.84rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {errorMessage && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#EF4444', fontSize: '0.82rem' }}>
                <AlertCircle size={15} />
                <span>{errorMessage}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {t('रद्द करू', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={status === 'submitting'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 18px',
                  borderRadius: '10px',
                  background: '#EAB308',
                  border: 'none',
                  color: '#070913',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  cursor: status === 'submitting' ? 'wait' : 'pointer',
                  boxShadow: '0 4px 14px rgba(234, 179, 8, 0.3)',
                }}
              >
                <Send size={15} />
                <span>{status === 'submitting' ? t('भेजि रहल अछि...', 'Submitting...') : t('प्रस्ताव भेजू', 'Submit Suggestion')}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
