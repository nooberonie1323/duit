/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#16A34A',
        'primary-dark': '#14532D',
        'primary-light': '#F0FDF4',
        sky: '#0EA5E9',
        'sky-light': '#E0F2FE',
        error: '#EF4444',
        warning: '#F59E0B',
        success: '#10B981',
        surface: '#F9FAFB',
        card: '#FFFFFF',
        'text-primary': '#111827',
        'text-secondary': '#6B7280',
        border: '#E5E7EB',
      },
      fontFamily: {
        sans: ['PlusJakartaSans_400Regular'],
        medium: ['PlusJakartaSans_500Medium'],
        semibold: ['PlusJakartaSans_600SemiBold'],
        bold: ['PlusJakartaSans_700Bold'],
        extrabold: ['PlusJakartaSans_800ExtraBold'],
      },
    },
  },
  plugins: [],
};
