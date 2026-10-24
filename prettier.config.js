export default {
  printWidth: 100,
  tabWidth: 2,
  semi: false,
  singleQuote: true,
  bracketSameLine: true,
  trailingComma: 'es5',

  plugins: ['prettier-plugin-tailwindcss'],
  // Class sorting reads the real theme (tokens included), not Tailwind's defaults.
  tailwindStylesheet: './apps/web/src/styles/app.css',
  tailwindAttributes: ['className'],
}
