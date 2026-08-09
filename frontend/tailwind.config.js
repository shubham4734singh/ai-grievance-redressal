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
          50:  '#EAF1FB',
          100: '#CBDFF5',
          500: '#1E4D8C',
          600: '#173D70',
          700: '#122F58',
        },
        status: {
          urgent:   '#D64545',
          progress: '#E0A030',
          resolved: '#2E9E5B',
          closed:   '#8A8F98',
        },
        surface: {
          bg:     '#F7F8FA',
          card:   '#FFFFFF',
          border: '#E4E7EB',
        },
      },
      fontFamily: {
        sans: ['Public Sans', 'Noto Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
