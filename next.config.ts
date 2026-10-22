import type {NextConfig} from 'next';
import {createRequire} from 'node:module';
import {dirname, resolve} from 'node:path';

const require = createRequire(import.meta.url);
const transformers = require.resolve('@huggingface/transformers');
const runtime = dirname(require.resolve('onnxruntime-web', {paths: [dirname(transformers)]}));
const runtimeVersion: string = require(resolve(runtime, '../package.json')).version;

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_VOICE_RUNTIME_VERSION: runtimeVersion },
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**', // This allows any path under the hostname
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  webpack: (config, {dev, isServer}) => {
    // Browser voice workers use onnxruntime-web; never bundle native Node bindings.
    if (!isServer) {
      config.resolve ??= {};
      config.resolve.alias = { ...config.resolve.alias, 'onnxruntime-node': false };
    }
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
