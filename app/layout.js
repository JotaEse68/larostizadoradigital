import './globals.css';

export const metadata = {
  title: 'Jottarina README Roaster',
  description: 'Roast sarcástico y útil para READMEs de GitHub en español.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
