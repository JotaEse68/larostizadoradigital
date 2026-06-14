import './globals.css';
import './rostizadora-extra.css';

export const metadata = {
  title: 'La Rostizadora Digital',
  description: 'Roast útil para READMEs en español.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
