/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0071e3',
        accent: {
          DEFAULT: '#2997ff',
          hover: '#0066cc'
        },
        background: {
          DEFAULT: '#f5f5f7',
          alt: '#ffffff'
        },
        surface: {
          DEFAULT: '#fafafc',
          dark: '#000000'
        },
        text: {
          primary: '#1d1d1f',
          muted: '#6e6e73',
          inverse: '#f5f5f7'
        },
        border: '#d2d2d7'
      },
      fontFamily: {
        display: [
          '"SF Pro Display"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif'
        ],
        text: [
          '"SF Pro Text"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif'
        ]
      },
      borderRadius: {
        sm: '8px',
        md: '11px',
        full: '9999px'
      }
    }
  },
  plugins: []
}
