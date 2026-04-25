$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..\.." )).Path
$contractsDir = Join-Path $repoRoot "contracts"
$envFile = Join-Path $repoRoot ".env"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) {
            return
        }

        $parts = $line -split "=", 2
        if ($parts.Length -ne 2) {
            return
        }

        $key = $parts[0].Trim()
        $value = $parts[1].Trim()

        if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
            $value = $value.Substring(1, $value.Length - 2)
        }

        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

$deployerPk = $env:DEPLOYER_PRIVATE_KEY
if ([string]::IsNullOrWhiteSpace($deployerPk)) {
    throw "DEPLOYER_PRIVATE_KEY is required (set it in .env or your shell)."
}

if (-not $deployerPk.StartsWith("0x")) {
    $deployerPk = "0x$deployerPk"
    [Environment]::SetEnvironmentVariable("DEPLOYER_PRIVATE_KEY", $deployerPk, "Process")
}

$rpcUrl = $env:NEXT_PUBLIC_RPC_URL
if ([string]::IsNullOrWhiteSpace($rpcUrl)) {
    $rpcUrl = "https://api.avax-test.network/ext/bc/C/rpc"
}

Write-Host "Deploying to Avalanche Fuji (chainId=43113)"
Write-Host "RPC: $rpcUrl"

Push-Location $contractsDir
try {
    $forgeCmdInfo = Get-Command forge -ErrorAction SilentlyContinue
    $forgeCmd = $null
    if ($forgeCmdInfo) {
        $forgeCmd = $forgeCmdInfo.Source
    }
    if ([string]::IsNullOrWhiteSpace($forgeCmd)) {
        $fallbackForge = Join-Path $env:USERPROFILE ".foundry\bin\forge.exe"
        if (Test-Path $fallbackForge) {
            $forgeCmd = $fallbackForge
        }
        else {
            throw "forge was not found in this shell. Install Foundry and/or add $HOME/.foundry/bin to PATH."
        }
    }

    if ([string]::IsNullOrWhiteSpace($env:SNOWTRACE_API_KEY)) {
        Write-Host "SNOWTRACE_API_KEY not set; skipping source verification."
        & $forgeCmd script script/Deploy.s.sol:Deploy --rpc-url $rpcUrl --chain-id 43113 --broadcast -vvv
    }
    else {
        & $forgeCmd script script/Deploy.s.sol:Deploy --rpc-url $rpcUrl --chain-id 43113 --broadcast --verify -vvv
    }
}
finally {
    Pop-Location
}
