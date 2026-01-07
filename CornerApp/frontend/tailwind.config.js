/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#667eea',
          600: '#5b5bd6',
          700: '#4c4cc4',
          800: '#3f3fa0',
          900: '#35357e',
        },
        accent: {
          50: '#fdf4f3',
          100: '#fce8e6',
          200: '#fad5d1',
          300: '#f5b5ad',
          400: '#ec877c',
          500: '#c72323',
          600: '#b31d1d',
          700: '#961818',
          800: '#7c1717',
          900: '#671919',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

