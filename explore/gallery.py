"""Build the local review gallery from exported Rust buffers, no browser renderer or network."""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent/'out'


def main():
    cards = []
    for p in sorted(ROOT.glob('*/mesh.json')):
        name = p.parent.name
        doc = json.loads(p.read_text())
        vertices = sum(len(c['position'])//3 for c in doc['components'])
        triangles = sum(len(c['index'])//3 for c in doc['components'])
        frames = bool(doc['features'].get('read'))
        cards.append(f'''<article data-name="{name}" data-read="{int(frames)}">
<h2>{html.escape(name)}</h2><a href="{name}/sword.glb">GLB</a> ·
<a href="{name}/recipe.json">recipe</a> · <a href="{name}/metrics.json">metrics</a>
<img src="{name}/mast.png" alt="{name} mast silhouette" loading="lazy">
<p>{vertices:,} vertices · {triangles:,} triangles · 36 m blade · seed 42</p>
<details><summary>Resolved feature parameters</summary><pre>{html.escape(json.dumps(doc['features'],indent=2))}</pre></details>
</article>''')
    cells = []
    for p in sorted((ROOT/'23-explorer/cells').glob('*/mast.png')):
        name = str(p.parent.relative_to(ROOT))
        cells.append(f'<a href="{name}/sword.glb"><img src="{name}/mast.png" alt="{name}">{p.parent.name}</a>')
    page = '''<!doctype html><meta charset="utf-8"><title>Bladegen CX2 sword studies</title>
<style>body{background:#10151e;color:#dce7f8;font:16px system-ui;margin:2rem}h1{margin-bottom:.2rem}
a{color:#85dfff}header{position:sticky;top:0;background:#10151e;padding:1rem 0;z-index:1}
main,.cells{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:1.5rem}
article{background:#1d2531;padding:1rem;border-radius:.6rem}h2{font-size:1.2rem}img{width:100%;margin-top:.7rem}
label{margin-right:1.5rem}pre{white-space:pre-wrap}p{color:#acbbce;font-size:.9rem}.cells img{max-width:350px}</style>
<h1>25 giant sword studies</h1><p>Rust geometry · explicit opt-in · no production catalogue changes.</p>
<p>First families: window-keel, faultbound, shear-gate. Add open staves and captive kernel next.
Read nodes, choreography and stellar roles are shared infrastructure. See ../LOG.md for verdicts and limits.</p>
<header><label>View <select id="view"><option value="mast">Mast · 75 m</option><option value="drone">Drone</option></select></label>
<label><input type="checkbox" id="mask"> Binary silhouette</label>
<label>Read sample <input type="range" id="time" min="0" max="3" value="2"><output id="ms">4000 ms</output></label></header>
<main>''' + '\n'.join(cards) + '''</main><h2>Trait sweep: magnetic and volcanic candidates</h2><div class="cells">''' + '\n'.join(cells) + '''</div>
<script>
function update(){const view=document.querySelector('#view').value;const mask=document.querySelector('#mask').checked;
const ms=[0,1800,4000,6500][document.querySelector('#time').value];document.querySelector('#ms').textContent=ms+' ms';
document.querySelectorAll('article').forEach(card=>{let path=card.dataset.name;
if(card.dataset.read==='1')path+='/frames/time-'+String(ms).padStart(4,'0');
card.querySelector('img').src=path+'/'+view+(mask?'-silhouette':'')+'.png';});}
document.querySelectorAll('header input,header select').forEach(el=>el.addEventListener('input',update));
</script>'''
    (ROOT/'index.html').write_text(page,encoding='utf-8')
    print(ROOT/'index.html')


if __name__ == '__main__':
    main()
