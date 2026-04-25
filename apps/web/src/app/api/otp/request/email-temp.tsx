import * as React from 'react';

interface EmailTemplateProps {
  code: string;
}

export function EmailTemplate({ code }: EmailTemplateProps) {
  const formattedCode = code.split('').join(' ');

  return (
    <>
<<<<<<< HEAD
=======
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
        rel="stylesheet"
      />
>>>>>>> d504d1913a43489a0214f95103ff0c10ffb247ae
      <div
        style={{
          fontFamily: 'Inter, Arial, sans-serif',
          color: '#111827',
          lineHeight: 1.5,
          maxWidth: '460px',
        }}
      >
        <style>
          {`
            @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap');
          `}
        </style>
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
        <hr></hr>
        <p style={{ margin: '0 0 14px', fontSize: '16px', fontFamily: 'Inter, Arial, sans-serif' }}>
          Use this one-time code to sign in. It expires in 10 minutes.
        </p>
        <div
          style={{
            margin: '0 0 14px',
            padding: '14px 18px',
            border: '1px solid #d1d5db',
            borderRadius: '10px',
            backgroundColor: '#f9fafb',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              margin: '0',
              fontSize: '28px',
              lineHeight: 1.2,
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              fontWeight: 700,
              fontFamily: 'Inter, Arial, sans-serif',
            }}
          >
            {formattedCode}
          </p>
        </div>
        <p style={{ margin: '0', fontSize: '13px', color: '#4b5563', fontFamily: 'Inter, Arial, sans-serif' }}>
          Don&apos;t share this code with anyone.
        </p>
      </div>
    </>
  );
}
