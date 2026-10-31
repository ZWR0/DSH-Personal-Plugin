param([string]$HarnessRoot = $env:DSH_SOURCE, [switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
try {
    $tailscale = (Get-Command tailscale.exe -ErrorAction SilentlyContinue).Source
    if (-not $tailscale) { $tailscale = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe' }
    if (-not (Test-Path -LiteralPath $tailscale)) { throw 'Tailscale is not installed.' }
    $raw = & $tailscale status --json
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read Tailscale status. Open Tailscale; if access is denied, run as administrator.' }
    $state = ($raw -join "`n") | ConvertFrom-Json
    if ($state.BackendState -ne 'Running' -or -not $state.Self.Online) {
        throw "Tailscale is not connected (state: $($state.BackendState)). Sign in and connect, then run again."
    }
    $dnsName = ([string]$state.Self.DNSName).TrimEnd('.')
    if ($dnsName -notmatch '^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+\.ts\.net$') {
        throw 'No valid Tailscale DNS name. Enable MagicDNS and HTTPS for this tailnet.'
    }
    $baseUrl = "https://${dnsName}/"
    Write-Host "Remote HTTPS address: $baseUrl"
    Write-Host 'Paste this base address into Wayfarer Key and save it.'
    $serveRaw = & $tailscale serve status --json
    if ($LASTEXITCODE -ne 0) { throw 'Cannot read Tailscale Serve configuration.' }
    $serve = ($serveRaw -join "`n") | ConvertFrom-Json
    $siteKey = "${dnsName}:443"
    $site = $serve.Web.PSObject.Properties[$siteKey]
    if ($site) {
        $rootHandler = $site.Value.Handlers.PSObject.Properties['/']
        if ($rootHandler -and $rootHandler.Value.Proxy -ne 'http://127.0.0.1:3080') {
            throw 'HTTPS root is already used by another service. Existing Serve configuration was not changed.'
        }
    }
    if ($serve.AllowFunnel) {
        $publicSites = @($serve.AllowFunnel.PSObject.Properties | Where-Object { $_.Value -eq $true })
        if ($publicSites.Name -contains $siteKey) { throw 'Funnel is enabled on this HTTPS endpoint. Disable it before using this private DSH launcher.' }
    }
    if ($CheckOnly) { Write-Host 'Check only: no configuration changed and no DSH process started.'; exit 0 }
    if (-not $HarnessRoot -or -not (Test-Path -LiteralPath (Join-Path $HarnessRoot 'package.json'))) { throw 'Pass -HarnessRoot <DSH checkout> or set DSH_SOURCE. Keep your existing DSH_HOME.' }
    Set-Location -LiteralPath $HarnessRoot
    $pnpm = (Get-Command pnpm.cmd -ErrorAction Stop).Source
    # Serve uses a fixed backend; never silently fall back to a random port.
    $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 3080)
    try { $probe.Start() }
    catch { throw 'Port 3080 is busy. Stop the existing DSH in its original terminal (Ctrl+C), then run again.' }
    finally { $probe.Stop() }
    Write-Host 'Configuring private Tailscale Serve. Follow any HTTPS enablement URL printed below.'
    & $tailscale serve --bg --https=443 http://127.0.0.1:3080
    if ($LASTEXITCODE -ne 0) { throw 'Tailscale Serve setup failed. Complete HTTPS enablement and run again.' }
    Write-Host 'Keep this terminal open. Connect remote devices to the same tailnet.'
    & $pnpm dsh web --host 127.0.0.1 --port 3080 --trusted-host $dnsName --public-url $baseUrl
    exit $LASTEXITCODE
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
