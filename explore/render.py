"""Offline GLB writer and fixed-point CPU silhouette rasterizer. No third-party packages.

Consumes Rust meshes only; never implements sword geometry. Cameras are in metres, 45 degree
vertical FOV, mast 75 m away at y=22, drone (35,48,65). Raster coverage uses integer edge
functions at pixel centres, round-to-nearest 1/256 px, double-sided triangles, depth buffering.
PNG shows dark metal and emission roles, without bloom. Metrics are diagnostic, not aesthetics.
"""
import json
import math
import pathlib
import struct
import sys
import zlib

ROOT = pathlib.Path(__file__).resolve().parent


def point(m, p):
    return [sum(m[k * 4 + j] * p[k] for k in range(3)) + m[12 + j] for j in range(3)]


def normal(m, n):
    a,b,c,d,e,f,g,h,i = m[0],m[4],m[8],m[1],m[5],m[9],m[2],m[6],m[10]
    cof = [[e*i-f*h,f*g-d*i,d*h-e*g],[c*h-b*i,a*i-c*g,b*g-a*h],[b*f-c*e,c*d-a*f,a*e-b*d]]
    det = a*cof[0][0]+b*cof[0][1]+c*cof[0][2]
    v = [sum(cof[j][k]*n[k] for k in range(3))/det for j in range(3)]
    length = math.sqrt(sum(x*x for x in v)) or 1
    return [-v[0]/length,-v[1]/length,v[2]/length]


def world(doc):
    scale = doc['heightM'] / doc['bladeLength']
    ground = doc['heightM'] * (1 - doc['sink'])
    out = []
    for c in doc['components']:
        ps = c['position']
        vs = [point(c['matrix'], ps[i:i+3]) for i in range(0, len(ps), 3)]
        out.append((c, [[-p[0]*scale, ground-p[1]*scale, p[2]*scale] for p in vs]))
    return out


def glb(doc, path):
    data = bytearray()
    g = dict(asset={'version': '2.0', 'generator': 'bladegen-core CX2 offline'},
             scene=0, scenes=[{'nodes': []}], nodes=[], meshes=[], materials=[],
             buffers=[], bufferViews=[], accessors=[],
             extensionsUsed=['KHR_materials_emissive_strength'])

    def accessor(values, typ, component, width):
        while len(data) % 4:
            data.append(0)
        offset = len(data)
        data.extend(struct.pack('<' + ('f' if component == 5126 else 'I')*len(values), *values))
        view = len(g['bufferViews'])
        g['bufferViews'].append(dict(buffer=0, byteOffset=offset, byteLength=len(data)-offset))
        a = dict(bufferView=view, componentType=component, count=len(values)//width, type=typ)
        if typ == 'VEC3':
            a['min'] = [min(values[k::3]) for k in range(3)]
            a['max'] = [max(values[k::3]) for k in range(3)]
        g['accessors'].append(a)
        return len(g['accessors'])-1

    for c, vs in world(doc):
        p = accessor([v for xyz in vs for v in xyz], 'VEC3', 5126, 3)
        # Preview matrices are rigid; rotate normal by monument pi Z and component matrix.
        ns = c['normal']
        normals = []
        for i in range(0, len(ns), 3):
            normals.extend(normal(c['matrix'],ns[i:i+3]))
        n = accessor(normals, 'VEC3', 5126, 3)
        idx = accessor(c['index'], 'SCALAR', 5125, 1)
        mat = dict(name=c['role'], pbrMetallicRoughness=dict(baseColorFactor=c['color']+[1],
                   metallicFactor=0.8 if c['strength']==0 else 0., roughnessFactor=0.38))
        if c['strength']:
            mat['emissiveFactor'] = c['color']
            mat['extensions'] = {'KHR_materials_emissive_strength': {'emissiveStrength': c['strength']}}
        g['materials'].append(mat)
        g['meshes'].append(dict(name=c['id'], primitives=[dict(attributes={'POSITION': p, 'NORMAL': n}, indices=idx, material=len(g['materials'])-1)]))
        g['scenes'][0]['nodes'].append(len(g['nodes']))
        g['nodes'].append(dict(name=c['id'], mesh=len(g['meshes'])-1, extras={'role':c['role']}))
    g['scenes'][0]['extras'] = {k: v for k, v in doc.items() if k != 'components'}
    g['buffers'] = [dict(byteLength=len(data))]
    js = json.dumps(g, separators=(',', ':'), allow_nan=False).encode()
    js += b' ' * (-len(js) % 4)
    data.extend(b'\0' * (-len(data) % 4))
    path.write_bytes(struct.pack('<III', 0x46546c67, 2, 28+len(js)+len(data)) +
                     struct.pack('<II', len(js), 0x4e4f534a) + js +
                     struct.pack('<II', len(data), 0x004e4942) + data)


def png(path, pixels, size):
    def chunk(name, content):
        return struct.pack('>I', len(content)) + name + content + struct.pack('>I', zlib.crc32(name+content))
    raw = b''.join(b'\0'+bytes(pixels[y*size*3:(y+1)*size*3]) for y in range(size))
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size,size,8,2,0,0,0)) +
                     chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b''))


def raster(doc, eye, path, size=512):
    def sub(a,b): return [a[k]-b[k] for k in range(3)]
    def dot(a,b): return sum(a[k]*b[k] for k in range(3))
    def norm(a): return [x/math.sqrt(dot(a,a)) for x in a]
    def cross(a,b): return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
    forward = norm(sub([0,22,0],eye))
    right = norm(cross(forward,[0,1,0]))
    up = cross(right,forward)
    focal = size/(2*math.tan(math.pi/8))
    pix = [241,244,248]*(size*size)
    depth = [float('inf')]*(size*size)
    mask = [0]*(size*size)
    for c, vs in world(doc):
        screen = []
        for v in vs:
            p = sub(v,eye)
            z = dot(p,forward)
            screen.append((math.floor((size/2+focal*dot(p,right)/z)*256+0.5),
                           math.floor((size/2-focal*dot(p,up)/z)*256+0.5),z))
        col = [max(0,min(255,round(x*255))) for x in c['color']]
        for i in range(0,len(c['index']),3):
            a,b,d = [screen[j] for j in c['index'][i:i+3]]
            if min(a[2],b[2],d[2]) <= 0: continue
            def edge(a,b,x,y): return (x-a[0])*(b[1]-a[1])-(y-a[1])*(b[0]-a[0])
            area = edge(a,b,d[0],d[1])
            if not area: continue
            x0,x1 = max(0,min(a[0],b[0],d[0])//256),min(size-1,max(a[0],b[0],d[0])//256)
            y0,y1 = max(0,min(a[1],b[1],d[1])//256),min(size-1,max(a[1],b[1],d[1])//256)
            for y in range(y0,y1+1):
                for x in range(x0,x1+1):
                    px,py = x*256+128,y*256+128
                    e = [edge(b,d,px,py),edge(d,a,px,py),edge(a,b,px,py)]
                    if not (min(e)>=0 if area>0 else max(e)<=0): continue
                    z = 1/sum(e[k]/area/[a,b,d][k][2] for k in range(3))
                    indices = c['index'][i:i+3]
                    wy = z*sum(e[k]/area*vs[indices[k]][1]/[a,b,d][k][2] for k in range(3))
                    if wy < 0: continue  # buried sword remains in GLB, hidden by ground in diagnostic views
                    q = y*size+x
                    if z < depth[q]:
                        depth[q]=z
                        pix[q*3:q*3+3]=col
                        mask[q] = 2 if c['strength'] else 1
    png(path,pix,size)
    # Separate binary silhouette for judging negative space without palette distraction.
    png(path.with_stem(path.stem+'-silhouette'), [v for m in mask for v in ([0,0,0] if m else [255,255,255])],size)
    return {'occupiedPixels':sum(m>0 for m in mask),'emissionPixels':mask.count(2),'resolution':size,
            'eyeM':eye,'targetM':[0,22,0],'verticalFovDeg':45}


def main():
    names = sys.argv[1:]
    if names == ['--all']:
        names = [str(p.parent.relative_to(ROOT/'out')) for p in sorted((ROOT/'out').rglob('mesh.json'))]
    for name in names:
        folder = ROOT/'out'/name
        doc = json.loads((folder/'mesh.json').read_text())
        glb(doc,folder/'sword.glb')
        stats = {name:raster(doc,eye,folder/(name+'.png')) for name,eye in [('mast',[0,22,75]),('drone',[35,48,65])]}
        (folder/'views.json').write_text(json.dumps(stats,indent=2)+'\n')
        print(folder.relative_to(ROOT), 'GLB + mast/drone PNG')


if __name__ == '__main__':
    main()
