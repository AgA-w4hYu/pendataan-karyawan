/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ===== Flying Papers (PRD Section 3) =====
        dusk: '#8584BD',        // background halaman ("panggung")
        hivis: '#F4ED36',       // Hi-Vis Yellow — header tabel, border tombol sekunder
        buttery: '#F9CC73',     // aksen lembut / warning
        lilacshadow: '#61609A', // blok bersarang (panel di dalam modal), teks sekunder
        bubblegum: '#F8C1BA',   // stat card 1
        matcha: '#B5C995',      // stat card 2 / status aktif
        magenta: '#AC4F98',     // stat card 3 — aksen paling berteriak
        firecracker: '#C94245', // badge peringatan / tombol Hapus / status non-aktif
        bone: '#F9F5F2',        // surface utama: tabel, form, modal, tombol utama
        ink: '#1A1A1A',         // teks body di surface terang, border utama
        pure: '#000000',        // teks di atas Hi-Vis Yellow, border tajam

        // ===== Alias lama → nilai tema baru (agar kelas lama tetap hidup) =====
        surface: '#F9F5F2',     // -> bone
        cream: '#F9F5F2',       // -> bone
        blush: '#F9F5F2',       // -> bone (pattern hati dihapus)
        heart: '#1A1A1A',       // divider dashed -> ink
        line: '#1A1A1A',        // border utama -> ink (1px tipis per PRD tabel)
        rose: '#AC4F98',        // aksen -> magenta punch
        rosedark: '#8E3E7E',    // hover magenta
        danger: '#C94245',      // -> firecracker
        clay: '#C94245',        // alias lama -> firecracker
        coal: '#1A1A1A',        // alias lama -> ink
        sage: '#B5C995',        // status aktif -> matcha
        muted: '#61609A',       // teks sekunder -> lilac shadow
      },
      fontFamily: {
        display: ['"Archivo Black"', '"Arial Black"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        grotesk: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '6px',   // semua card — tajam
        pill: '100px', // tombol & badge — pill sempurna
      },
    },
  },
  plugins: [],
};
