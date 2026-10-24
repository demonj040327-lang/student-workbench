import {createPeerMiddleware} from './server/peer-learning.mjs';
import {defineConfig, loadEnv} from 'vite';
import {createStudyMiddleware} from './server/study-api.mjs';
import {createCampusMiddleware} from './server/campus-api.mjs';

export default defineConfig(({mode}) => {
  // The unrestricted loadEnv result is used only inside this Node plugin.
  // Only VITE_ variables are normally exposed by Vite; API keys never use that prefix.
  const serverEnv = {...process.env, ...loadEnv(mode, process.cwd(), '')};
  return {
    server: {host: '127.0.0.1'},
    preview: {host: '127.0.0.1'},
    plugins: [{name:'peer-learning-api',configureServer(server){server.middlewares.use(createPeerMiddleware({root:serverEnv.PEER_DATA_ROOT || server.config.root}));},configurePreviewServer(server){server.middlewares.use(createPeerMiddleware({root:serverEnv.PEER_DATA_ROOT || server.config.root}));}},{name: 'local-study-api',
      configureServer(server) {server.middlewares.use(createStudyMiddleware({projectRoot: server.config.root, env: serverEnv}));},
      configurePreviewServer(server) {server.middlewares.use(createStudyMiddleware({projectRoot: server.config.root, env: serverEnv}));},},




      {
        name: 'campus-database-api',
        configureServer(server) {
          server.middlewares.use(createCampusMiddleware());
        },
        configurePreviewServer(server) {
          server.middlewares.use(createCampusMiddleware());
        },
      }
    ],
  };
});
