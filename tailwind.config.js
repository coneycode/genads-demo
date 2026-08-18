/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      animation: {
        "pulse-red": "pulse-red 1s ease-in-out infinite",
        "pulse-blue": "pulse-blue 1.4s ease-in-out infinite",
      },
      keyframes: {
        "pulse-red": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(239,68,68,0.6)" },
          "50%": { boxShadow: "0 0 0 6px rgba(239,68,68,0)" },
        },
        "pulse-blue": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(37,99,235,0.55), 0 4px 14px rgba(37,99,235,0.35)" },
          "50%": { boxShadow: "0 0 0 10px rgba(37,99,235,0), 0 4px 14px rgba(37,99,235,0.45)" },
        },
      },
    },
  },
  plugins: [],
};
