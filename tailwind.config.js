/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#6b56ff",
        "primary-content": "#ffffff",
        "primary-dark": "#3e23ff",
        "primary-light": "#9889ff",

        secondary: "#bf56ff",
        "secondary-content": "#350056",
        "secondary-dark": "#ac23ff",
        "secondary-light": "#d289ff",

        background: "#17161d",
        foreground: "#22212c",
        border: "#393649",

        copy: "#fbfbfc",
        "copy-light": "#d4d3de",
        "copy-lighter": "#9c98b3",

        success: "#56ff56",
        warning: "#ffff56",
        error: "#ff5656",

        "success-content": "#005600",
        "warning-content": "#565600",
        "error-content": "#560000"
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