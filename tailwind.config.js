/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Waterfront Solutions palette — navy/blue + white, high contrast for sunlight.
        navy: {
          DEFAULT: '#0A2540',
          900: '#071A2E',
          800: '#0A2540',
          700: '#0E3354',
          600: '#13456E',
        },
        wave: {
          DEFAULT: '#1E6FB8',
          500: '#1E6FB8',
          400: '#3B8FD6',
          300: '#7FB8E6',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
