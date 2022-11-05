/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createRequestHandler } from '@remix-run/express';
import { config } from 'dotenv';
import vitePluginReact from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { getRemixPlugin } from './plugins/remix';
import { getTransformPlugin } from './plugins/transform';
import { SERVER_ENTRY_ID } from './constants';
import type { ServerBuild } from '@remix-run/server-runtime';

config();

const mode = 'development';

async function createServer() {
  const app = express();

  app.use(express.static('public', { maxAge: '1h' }));

  const remixPlugin = await getRemixPlugin();
  const remixTransformPlugin = await getTransformPlugin();

  // Create Vite server in middleware mode and configure the app type as
  // 'custom', disabling Vite's own HTML serving logic so parent server
  // can take control
  const vite = await createViteServer({
    server: { middlewareMode: true },
    plugins: [
      tsconfigPaths(),
      remixPlugin,
      remixTransformPlugin,
      vitePluginReact({
        include: '**/*.tsx',
      }),
    ].filter(Boolean),
    appType: 'custom',
  });

  // use vite's connect instance as middleware
  // if you use your own express router (express.Router()), you should use router.use
  app.use(vite.middlewares);

  app.all('*', async (req, res, next) => {
    try {
      const build = (await vite.ssrLoadModule(
        `virtual:${SERVER_ENTRY_ID}`,
      )) as ServerBuild;

      const handler = createRequestHandler({
        build,
        mode,
      });

      return handler(req, res, next);
    } catch (e: any) {
      // If an error is caught, let Vite fix the stack trace so it maps back to
      // your actual source code.
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });

  app.listen(3000);
}

createServer()
  .then(() => {
    console.log('🖲 remix-vite started at http://localhost:3000');
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
