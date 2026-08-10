/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          // Pink / purple / white theme. Token names kept for compatibility:
          // `blue*` = purple (primary), `green*` = pink (accent).
          blue: '#7C3AED',      // violet-600 (primary)
          blueDark: '#6D28D9',  // violet-700 (primary hover)
          blueLight: '#A78BFA', // violet-400
          green: '#DB2777',     // pink-600 (accent)
          greenLight: '#EC4899',// pink-500
          navy: '#3B0764',      // deep purple (headings / dark text)
          silver: '#FAF5FF',    // purple-50 (soft white)
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(15,23,42,.08), 0 1px 2px rgba(15,23,42,.06)',
        cardHover: '0 10px 30px rgba(15,23,42,.12)',
      },
    },
  },
  plugins: [],
}
