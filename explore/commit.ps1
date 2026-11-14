param([Parameter(Mandatory=$true)][string]$Message)
$ErrorActionPreference = 'Stop'
# This session's .git is read-only. Keep a genuine, importable per-idea branch in writable metadata.
$workspaceDir = (Resolve-Path '.').Path
$metadataDir = Join-Path $workspaceDir 'explore/out/git-history'
if (!(Test-Path -LiteralPath $metadataDir)) {
  git init --bare --initial-branch=explore/codex-sword-ideas $metadataDir
  if ($LASTEXITCODE -ne 0) { throw 'Could not initialize exploration history' }
  $objectsDir = (Resolve-Path '.git/objects').Path.Replace('\','/')
  [IO.File]::WriteAllText((Join-Path $metadataDir 'objects/info/alternates'), $objectsDir + "`n")
  git --git-dir=$metadataDir update-ref refs/heads/explore/codex-sword-ideas f09919c
  git --git-dir=$metadataDir --work-tree=$workspaceDir read-tree HEAD
}
git --git-dir=$metadataDir --work-tree=$workspaceDir add --all
if ($LASTEXITCODE -ne 0) { throw 'Could not stage exploration' }
git --git-dir=$metadataDir --work-tree=$workspaceDir -c user.name='Peter Wicks' -c user.email='patricker@gmail.com' commit -m $Message -m 'Co-Authored-By: Codex <noreply@openai.com>'
if ($LASTEXITCODE -ne 0) { throw 'Could not commit exploration' }
git --git-dir=$metadataDir bundle create explore/out/ideas.bundle f09919c..explore/codex-sword-ideas
if ($LASTEXITCODE -ne 0) { throw 'Could not bundle exploration' }
