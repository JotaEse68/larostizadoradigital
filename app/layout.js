import './globals.css';

export const metadata = {
  title: 'La Rostizadora Digital',
  description: 'Roastea READMEs de GitHub con cinismo útil y soluciones accionables.',
  metadataBase: new URL('https://larostizadoradigital.vercel.app'),
  openGraph: {
    title: 'La Rostizadora Digital',
    description: 'README a la parrilla: primero lo quemamos, luego lo arreglamos.',
    images: ['/rostizadora-coach.svg']
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
