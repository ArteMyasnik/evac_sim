import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
    publicDir: false,
    build: {
        outDir: 'public',
        emptyOutDir: false,
        rollupOptions: {
            input: {
                login: resolve(__dirname, 'src/ui/login.ts'),
                buildings: resolve(__dirname, 'src/ui/buildings.ts'),
                building: resolve(__dirname, 'src/ui/building.ts'),
                scenario: resolve(__dirname, 'src/ui/scenario.ts'),
                viewer: resolve(__dirname, 'src/ui/viewer.ts'),
                shared: resolve(__dirname, 'src/styles/shared.css')
            },
            output: {
                entryFileNames: '[name].js',
                assetFileNames: '[name][extname]'
            }
        }
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true
            }
        }
    }
})