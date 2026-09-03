/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1A1815',     // background utama (dark)
        cream: '#F5F1E8',   // surface / kartu (terang)
        coal: '#111111',    // teks utama di atas surface terang
        muted: '#8A8578',   // teks sekunder
        sage: '#5C7A4A',    // aksen positif
        clay: '#B5654A',    // aksen warning
        line: '#DAD5C8',    // border tipis
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};