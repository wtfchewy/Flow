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
      },
      animation: {
				fade: 'fadeIn .5s ease-in-out',
        fadeOut: 'fadeOut .5s ease-in-out',
			},
			keyframes: {
				fadeIn: {
					from: { opacity: 0 },
					to: { opacity: 1 },
				},
        fadeOut: {
          from: { opacity: 1 },
          to: { opacity: 0 },
        },
			},
    },
  },
  plugins: [],
}