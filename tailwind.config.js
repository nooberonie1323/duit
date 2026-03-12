/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: "#F8F9FB",
        surface: "#FFFFFF",
        border: "#EAECF0",
        indigo: {
          DEFAULT: "#4F46E5",
          dark: "#3730A3",
          light: "#EEF2FF",
          mid: "#C7D2FE",
        },
        textPrimary: "#111827",
        textSub: "#6B7280",
        textMuted: "#9CA3AF",
        green: {
          DEFAULT: "#16A34A",
          light: "#DCFCE7",
        },
        red: {
          DEFAULT: "#DC2626",
          light: "#FEE2E2",
        },
        amber: {
          DEFAULT: "#D97706",
          light: "#FEF3C7",
        },
        extra: {
          DEFAULT: "#0EA5E9",
          light: "#E0F2FE",
        },
      },
      fontFamily: {
        sans: ["DMSans_400Regular"],
        "sans-medium": ["DMSans_500Medium"],
        "sans-semibold": ["DMSans_600SemiBold"],
        "sans-bold": ["DMSans_700Bold"],
        "sans-extrabold": ["DMSans_800ExtraBold"],
      },
      borderRadius: {
        card: "16px",
        btn: "14px",
        pill: "99px",
        sm: "8px",
      },
    },
  },
  plugins: [],
};
