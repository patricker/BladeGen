/**
 * bladegen headless CLI entry point (run with `npm run bladegen -- <command>`).
 * Commands: `gen` (see USAGE in ./gen.ts), `presets`, `help`.
 */
import { USAGE, parseArgs, runGen } from './gen';
import { giantPresets, swordPresets } from '../components/presets';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0] ?? 'help';
  if (cmd === 'presets') {
    for (const p of [...swordPresets, ...giantPresets]) console.log(`${p.id}  ${p.label}`);
    return;
  }
  if (cmd === 'gen') {
    console.log(JSON.stringify(await runGen(args), null, 2));
    return;
  }
  console.log(USAGE);
}

main().catch((err) => {
  console.error(`bladegen: ${err?.message ?? err}`);
  process.exit(1);
});
