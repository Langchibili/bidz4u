import ClientProviders from './ClientProviders';

export const metadata = {
  title: 'bidz4u',
  description: 'Live pan-African auctions, escrow-protected.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
