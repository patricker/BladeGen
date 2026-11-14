"""Generate the experimental envelope schema, separate from canonical editor documents."""
import json
from pathlib import Path

SPECS = {
    'resonance': {'count': ('integer',3,9), 'radius': ('number',.03,.08)},
    'read': {'durationMs': ('integer',2000,15000), 'emissionGain': ('number',1,4)},
    'emission': {'starK': ('number',2500,30000), 'edgeStrength': ('number',0,12), 'channelStrength': ('number',0,12)},
    'scars': {'count': ('integer',1,6), 'depth': ('number',.05,.3), 'length': ('number',.02,.09)},
    'staves': {'count': ('integer',3,6), 'radius': ('number',.2,.45), 'section': ('number',.07,.15), 'bow': ('number',0,.2)},
    'grammar': {'majorMotifBudget': ('integer',1,4), 'minShaftGap': ('number',.05,.3)},
    'gate': {'jawHeight': ('number',.5,1.5), 'stagger': ('number',0,.5), 'readTravel': ('number',.1,.7)},
    'fracture': {'segments': ('integer',2,7), 'gap': ('number',.1,.3), 'offset': ('number',0,.35), 'readClosure': ('number',0,.9)},
    'aperture': {'start': ('number',.08,.35), 'end': ('number',.45,.78), 'width': ('number',.2,.6)},
    'cleft': {'separation': ('number',.3,.9), 'mergeAt': ('number',.6,.8), 'bias': ('number',-.1,.1)},
    'ribs': {'pairs': ('integer',2,4), 'reach': ('number',.4,1)},
    'crystals': {'count': ('integer',1,6), 'length': ('number',.4,1.5), 'width': ('number',.15,.35)},
    'kernel': {'coreRadius': ('number',.12,.2), 'readLift': ('number',0,.1)},
    'chains': {'links': ('integer',4,10), 'slack': ('number',0,.3)},
    'sutures': {'standOff': ('number',.04,.2), 'section': ('number',.07,.16)},
    'strata': {'layers': ('integer',2,6), 'diagonal': ('number',0,.5)},
    'encroachment': {'height': ('number',.04,.2), 'sink': ('number',0,.4), 'projection': ('number',.1,.35)},
    'terminator': {'bias': ('number',-.7,.7)},
    'circuit': {'branches': ('integer',1,3), 'width': ('number',.03,.09)},
    'electrodes': {'count': ('integer',2,6), 'reach': ('number',.8,1.8), 'sink': ('number',0,.4)},
}


def obj(properties, required=None):
    return dict(type='object', properties=properties, additionalProperties=False,
                required=list(properties) if required is None else required)


def main():
    vec = dict(type='array', minItems=3, maxItems=3, items={'type':'number'})
    text = {'type':'string'}
    digest = dict(type='string', pattern='^[0-9a-f]{16}$')
    features = obj({name:obj({key:dict(type=t,minimum=lo,maximum=hi) for key,(t,lo,hi) in fields.items()})
                    for name,fields in SPECS.items()}, [])
    record = obj(dict(id=text, role=text, digest=digest, travel=vec))
    anchor = obj(dict(id=text, parent=text, position=vec, normal=vec, role=text, vocabulary={'type':'integer','const':1}))
    schema = obj(dict(format={'const':'bladegen-explore-recipe/1'}, recipeVersion={'const':1},
                      coreVersion=text, mathProfile={'const':'libm-f64-f32-v1'}, catalogueFnv1a64=digest,
                      implementationFnv1a64=digest, seed=dict(type='integer',minimum=0,maximum=4294967295),
                      base=dict(type='object', required=['blade','guard','handle','pommel'],
                                description='Validated Rust core Sword subset; not the editor document envelope.'),
                      features=features, heightM=dict(type='number',minimum=30,maximum=42),
                      sink=dict(type='number',minimum=0,maximum=.4),
                      components=dict(type='array',minItems=1,items=record), anchors=dict(type='array',items=anchor)))
    schema.update({'$schema':'https://json-schema.org/draft/2020-12/schema',
                   '$id':'https://bladegen.local/schema/explore.recipe.schema.json',
                   'title':'Opt-in Rust exploration recipe',
                   'description':'Shape validation only. Rust contract replay also checks compatibility, placement and digests.'})
    path = Path(__file__).resolve().parent.parent/'schema'/'explore.recipe.schema.json'
    path.write_text(json.dumps(schema,indent=2)+'\n')


if __name__ == '__main__':
    main()
