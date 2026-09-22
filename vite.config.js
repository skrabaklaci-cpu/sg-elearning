import { defineConfig } from 'vite';

export default defineConfig({
  // Relatív útvonalak: a build bármilyen GitHub Pages repónév alatt (és iframe-ben) működik.
  base: './',
  server: {
    // 127.0.0.1-re kötünk, hogy az iframe-test.html (localhost) cross-site iframe-ként tölthesse be az appot.
    // Telefonos teszthez a helyi hálózaton: npm run dev -- --host
    host: '127.0.0.1',
    port: 5173,
  },
  test: {
    include: ['src/**/*.test.js'],
  },
});
