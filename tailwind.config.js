/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        indigo: {
          DEFAULT: '#4F46E5',
          dark: '#3730A3',
          light: '#EEF2FF',
        },
        sky: {
          DEFAULT: '#0EA5E9',
          light: '#E0F2FE',
        },
        danger: '#EF4444',
        amber: '#F59E0B',
        success: '#10B981',
        'text-primary': '#111827',
        'text-secondary': '#6B7280',
        border: '#E5E7EB',
        surface: '#F9FAFB',
      },
      fontFamily: {
        sans: ['PlusJakartaSans', 'system-ui'],
      },
    },
  },
  plugins: [],
};
