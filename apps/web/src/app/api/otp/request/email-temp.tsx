import * as React from 'react';

interface EmailTemplateProps {
  code: string;
}

export function EmailTemplate({ code }: EmailTemplateProps) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
        rel="stylesheet"
      />
      <div
        style={{
          fontFamily: 'Inter, Arial, sans-serif',
          color: '#111827',
          lineHeight: 1.5,
        }}
      >
        <h1
          style={{
            margin: '0 0 12px',
            fontSize: '28px',
            fontWeight: 600,
            fontFamily: '"Instrument Serif", Georgia, serif',
          }}
        >
          DealSeal
        </h1>
        <p style={{ margin: '0', fontSize: '16px' }}>
          Your one-time code is <strong>{code}</strong>. This expires in 10 minutes.
        </p>
      </div>
    </>
  );
}
