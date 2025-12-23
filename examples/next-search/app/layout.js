export const metadata = { title: 'MFE Example' };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body style={{ margin: 0, fontFamily: 'system-ui, Arial' }}>{children}</body>
    </html>
  );
}
