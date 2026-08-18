import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        open: true,
        host: true,
        proxy: {
            '/api/sickw': {
                target: 'https://sickw.com',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/sickw/, '/api.php'),
            },
        },
    },
    build: {
        target: 'es2020',
        cssCodeSplit: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    react: ['react', 'react-dom', 'react-router-dom'],
                    firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
                },
            },
        },
    },
});
