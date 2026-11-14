//! Explicit review presets, never selected by the shipped catalogue.
use super::*;

pub const IDEAS: [&str; 25] = [
  "18-resonance",
  "16-read",
  "15-emission",
  "12-scars",
  "07-staves",
  "20-grammar",
  "21-silhouette",
  "06-gate",
  "03-faultbound",
  "01-window",
  "02-cleft",
  "04-ribs",
  "05-crystals",
  "08-kernel",
  "09-chains",
  "10-sutures",
  "11-strata",
  "13-basalt",
  "14-terminator",
  "17-circuit",
  "19-electrodes",
  "22-dedup",
  "23-explorer",
  "24-lod",
  "25-contract",
];

pub fn preset(id: &str) -> anyhow::Result<Features> {
  Ok(match id {
    "18-resonance" => Features {
      resonance: Some(Resonance::default()),
      ..Features::default()
    },
    "16-read" => Features {
      resonance: Some(Resonance {
        radius: 0.08,
        ..Resonance::default()
      }),
      read: Some(Read::default()),
      ..Features::default()
    },
    "15-emission" => Features {
      resonance: Some(Resonance::default()),
      emission: Some(Emission::default()),
      ..Features::default()
    },
    "12-scars" => Features {
      scars: Some(Scars::default()),
      resonance: Some(Resonance::default()),
      ..Features::default()
    },
    "07-staves" => Features {
      staves: Some(Staves::default()),
      ..Features::default()
    },
    "20-grammar" => Features {
      scars: Some(Scars::default()),
      staves: Some(Staves::default()),
      resonance: Some(Resonance::default()),
      grammar: Some(Grammar::default()),
      ..Features::default()
    },
    "21-silhouette" => Features {
      staves: Some(Staves::default()),
      emission: Some(Emission::default()),
      ..Features::default()
    },
    "06-gate" => Features {
      gate: Some(Gate::default()),
      read: Some(Read::default()),
      ..Features::default()
    },
    "03-faultbound" => Features {
      fracture: Some(Fracture::default()),
      read: Some(Read::default()),
      ..Features::default()
    },
    "01-window" => Features {
      aperture: Some(Aperture::default()),
      ..Features::default()
    },
    "02-cleft" => Features {
      cleft: Some(Cleft::default()),
      ..Features::default()
    },
    "04-ribs" => Features {
      ribs: Some(Ribs::default()),
      ..Features::default()
    },
    "05-crystals" => Features {
      crystals: Some(Crystals::default()),
      ..Features::default()
    },
    "08-kernel" => Features {
      kernel: Some(Kernel::default()),
      read: Some(Read::default()),
      ..Features::default()
    },
    "09-chains" => Features {
      chains: Some(Chains::default()),
      ..Features::default()
    },
    "10-sutures" => Features {
      scars: Some(Scars::default()),
      sutures: Some(Sutures::default()),
      ..Features::default()
    },
    "11-strata" => Features {
      strata: Some(Strata::default()),
      ..Features::default()
    },
    "13-basalt" => Features {
      encroachment: Some(Encroachment::default()),
      ..Features::default()
    },
    "14-terminator" => Features {
      terminator: Some(Terminator::default()),
      ..Features::default()
    },
    "17-circuit" => Features {
      circuit: Some(Circuit::default()),
      ..Features::default()
    },
    "19-electrodes" => Features {
      electrodes: Some(Electrodes::default()),
      ..Features::default()
    },
    "22-dedup" => Features {
      aperture: Some(Aperture::default()),
      ..Features::default()
    },
    "23-explorer" => Features {
      aperture: Some(Aperture::default()),
      ..Features::default()
    },
    "24-lod" => Features {
      aperture: Some(Aperture::default()),
      ..Features::default()
    },
    "25-contract" => Features {
      aperture: Some(Aperture::default()),
      staves: Some(Staves::default()),
      ..Features::default()
    },
    _ => anyhow::bail!("unknown experiment {id}"),
  })
}
