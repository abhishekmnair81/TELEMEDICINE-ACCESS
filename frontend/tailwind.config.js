
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        green: {
          50: '#e6f7f4',
          100: '#d5f3ed',
          200: '#c8eae3',
          300: '#72cdb9',
          400: '#3eb49f',
          500: '#00b38e',
          600: '#00b38e',
          700: '#009a7a',
          800: '#008f70',
          900: '#00755b',
        }
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
      },
      screens: {
        'xs': '480px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [],
}