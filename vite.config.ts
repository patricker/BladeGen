import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: false,
  },
  preview: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          'three-addons': [
            'three/examples/jsm/controls/OrbitControls.js',
            'three/examples/jsm/loaders/RGBELoader.js',
            'three/examples/jsm/postprocessing/EffectComposer.js',
            'three/examples/jsm/postprocessing/RenderPass.js',
            'three/examples/jsm/postprocessing/UnrealBloomPass.js',
            'three/examples/jsm/postprocessing/OutlinePass.js',
            'three/examples/jsm/postprocessing/ShaderPass.js',
            'three/examples/jsm/postprocessing/SMAAPass.js',
            'three/examples/jsm/shaders/FXAAShader.js',
          ],
          exporters: [
            'three/examples/jsm/exporters/GLTFExporter.js',
            'three/examples/jsm/exporters/OBJExporter.js',
            'three/examples/jsm/exporters/STLExporter.js',
          ],
        },
      },
    },
  },
});
