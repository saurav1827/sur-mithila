'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, Check, X, Search, ChevronRight, FileDiff } from 'lucide-react';

export default function AdminReviewsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending_triage');

  useEffect(() => {
    fetchRequests(statusFilter);
  }, [statusFilter]);

  const fetchRequests = async (status) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/edit-requests?status=${status}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, decision) => {
    // In a real implementation this would hit /api/admin/edit-requests/:id/decision
    // For now we optimistically remove it from the list
    setRequests(reqs => reqs.filter(r => r._id !== id));
    alert(`Request ${id} marked as ${decision}`);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '40px auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 className="font-traditional" style={{ fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '12px', margin: '0 0 8px 0', color: '#fff' }}>
            <ShieldAlert size={28} color="var(--accent-vermilion)" />
            Admin: Edit Requests (AI Queue)
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Review user-submitted corrections pre-triaged by the AI Orchestrator.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className={`chip ${statusFilter === 'pending_triage' ? '' : 'inactive'}`} data-active={statusFilter === 'pending_triage'} onClick={() => setStatusFilter('pending_triage')}>Pending AI Triage</button>
          <button className={`chip ${statusFilter === 'in_review' ? '' : 'inactive'}`} data-active={statusFilter === 'in_review'} onClick={() => setStatusFilter('in_review')}>Needs Human Review</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Loading queue...</p>
        ) : requests.length === 0 ? (
          <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No requests in this queue right now.
          </div>
        ) : (
          requests.map(req => (
            <div key={req._id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', margin: '0 0 4px 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Request for: <Link href={`/songs/${req.songId}`} style={{ color: 'var(--accent-gold)' }}>{req.songId}</Link>
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Submitted by: {req.requesterId} • {new Date(req.createdAt).toLocaleString()}
                  </p>
                </div>
                
                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-card)', maxWidth: '400px' }}>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px', display: 'block' }}>AI Triage Brief</span>
                  <p style={{ fontSize: '0.85rem', margin: 0, color: req.triage?.confidence === 'high' ? 'var(--accent-emerald)' : 'var(--accent-gold)' }}>
                    {req.triage?.brief || "AI brief pending... (Agent pipeline hasn't run yet)"}
                  </p>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '8px', display: 'block' }}>
                  <FileDiff size={12} style={{ display: 'inline', marginRight: '4px' }} /> Proposed Changes
                </span>
                
                <div style={{ background: 'rgba(20,20,20,0.8)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', overflow: 'hidden' }}>
                  {req.changes.map((change, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 1fr', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ padding: '12px', background: 'rgba(0,0,0,0.5)', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                        {change.path}
                      </div>
                      <div style={{ padding: '12px', color: 'var(--accent-vermilion)', background: 'rgba(239, 68, 68, 0.05)', fontSize: '0.9rem', textDecoration: 'line-through' }}>
                        {change.oldValue || '(empty)'}
                      </div>
                      <div style={{ padding: '12px', color: 'var(--accent-emerald)', background: 'rgba(16, 185, 129, 0.05)', fontSize: '0.9rem' }}>
                        {change.newValue}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px', display: 'block' }}>User Reason & Evidence</span>
                <p style={{ fontSize: '0.9rem', color: '#F8FAFC', margin: '0 0 8px 0', fontStyle: 'italic' }}>"{req.reason}"</p>
                {req.evidenceUrls?.length > 0 && (
                  <a href={req.evidenceUrls[0]} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem', color: 'var(--accent-teal)' }}>
                    ↗ {req.evidenceUrls[0]}
                  </a>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-card)', paddingTop: '16px' }}>
                <button onClick={() => handleAction(req._id, 'rejected')} className="btn-secondary" style={{ color: 'var(--accent-vermilion)' }}>
                  <X size={16} /> Reject
                </button>
                <button onClick={() => handleAction(req._id, 'approved')} className="btn-primary" style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: '#fff', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)' }}>
                  <Check size={16} /> Approve & Apply
                </button>
              </div>

            </div>
          ))
        )}
      </div>

    </div>
  );
}
