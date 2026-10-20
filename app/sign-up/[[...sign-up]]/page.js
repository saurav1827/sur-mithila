import React from 'react';
import { SignUp } from '@clerk/nextjs';
import { clerkAppearance } from '../../../lib/clerkAppearance';

export default function SignUpPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '75vh',
      padding: '24px 16px'
    }}>
      <div style={{ marginBottom: '24px', textAlign: 'center' }}>
        <h1 className="font-traditional" style={{ fontSize: '2.2rem', color: '#F8FAFC', marginBottom: '8px' }}>
          नया खाता बनाउ
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          सुर-मिथिला समुदाय सं जुड़ू आ अपन लोकगीत कवर साझा करू
        </p>
      </div>
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        appearance={clerkAppearance}
        forceRedirectUrl="/"
        fallbackRedirectUrl="/"
      />
    </div>
  );
}
