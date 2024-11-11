/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'background': '#111111',
        'column': '#171717',
        'task': '#262626',
        'primary': '#6366F1',
        'secondary': '#f163ad',
      }
    },
  },
  plugins: [],
}