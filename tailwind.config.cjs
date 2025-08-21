module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'brand-primary': 'var(--brand-primary)',
        'brand-secondary': 'var(--brand-secondary)',
        'brand-accent': 'var(--brand-accent)',
        'brand-bg': 'var(--brand-bg)',
      },
    },
  },
  plugins: [],
};
