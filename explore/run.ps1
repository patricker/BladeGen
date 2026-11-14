param([string]$Idea = '18-resonance', [switch]$Tests)
$ErrorActionPreference = 'Stop'
# Uses only an already installed toolchain and cached dependencies. All output stays in this clone.
$toolchainDir = Join-Path $env:USERPROFILE '.rustup/toolchains/1.94.1-x86_64-pc-windows-msvc/bin'
$env:RUSTC = Join-Path $toolchainDir 'rustc.exe'
$env:RUSTDOC = Join-Path $toolchainDir 'rustdoc.exe'
$cargoExe = Join-Path $toolchainDir 'cargo.exe'
if ($Tests) {
  & $cargoExe test --offline --locked
  if ($LASTEXITCODE -ne 0) { throw 'Rust tests failed' }
} else {
  & $cargoExe run --offline --locked -p bladegen-core --example explore -- $Idea
  if ($LASTEXITCODE -ne 0) { throw 'Rust generation failed' }
  python explore/render.py $Idea
  if ($LASTEXITCODE -ne 0) { throw 'Preview export failed' }
}
