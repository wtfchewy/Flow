/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        'primary-content': 'var(--color-primary-content)',
        'primary-dark': 'var(--color-primary-dark)',
        'primary-light': 'var(--color-primary-light)',
        secondary: 'var(--color-secondary)',
        'secondary-content': 'var(--color-secondary-content)',
        'secondary-dark': 'var(--color-secondary-dark)',
        'secondary-light': 'var(--color-secondary-light)',
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        border: 'var(--color-border)',
        copy: 'var(--color-copy)',
        'copy-light': 'var(--color-copy-light)',
        'copy-lighter': 'var(--color-copy-lighter)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        'success-content': 'var(--color-success-content)',
        'warning-content': 'var(--color-warning-content)',
        'error-content': 'var(--color-error-content)',
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