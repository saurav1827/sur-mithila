import React from 'react';
import { SignIn } from '@clerk/nextjs';
import { clerkAppearance } from '../../../lib/clerkAppearance';

export default function SignInPage() {
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
          सुर-मिथिला लॉगिन
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          मिथिलाक पारंपरिक संगीत एवं गीत संग्रह मे स्वागत अछि
        </p>
      </div>
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        appearance={clerkAppearance}
        forceRedirectUrl="/"
        fallbackRedirectUrl="/"
      />
    </div>
  );
}
