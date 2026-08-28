import { runWrangler } from './cloudflare.mjs';

console.log('Deploying SystemSextant web assets…');
runWrangler('deploy');
