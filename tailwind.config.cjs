/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  // Dünaamilised klassid (template literalid) – Vercel/production build ei jäta neid välja
  safelist: [
    'bg-emerald-100', 'text-emerald-800', 'bg-red-100', 'text-red-800',
    'bg-amber-600', 'text-white', 'shadow-md', 'bg-amber-100', 'text-amber-800', 'hover:bg-amber-200',
    'bg-amber-200', 'text-amber-900', 'text-amber-100', 'hover:bg-amber-800/50',
    'cursor-pointer',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
