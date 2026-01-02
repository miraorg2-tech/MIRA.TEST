import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'classic',
    }),
  ],
  esbuild: {
    // Explicitly configure esbuild to transform JSX to React.createElement
    // This provides a fallback if the plugin configuration is not picked up for any reason.
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
  },
});