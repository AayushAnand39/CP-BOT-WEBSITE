param(
    [switch]$SkipSetup,
    [switch]$Dev,
    [switch]$ClearLogs
)

# ============================================================
# CP Bot - Local Backend Launcher
# ============================================================

$ErrorActionPreference = "Stop"

$RootDir = $PSScriptRoot
$BackendDir = Join-Path $RootDir "backend"
$LogDir = Join-Path $RootDir "logs"

$script:RunningServices = @()
$script:Stopping = $false


# ============================================================
# Utility functions
# ============================================================

function Write-Section {
    param([string]$Text)

    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor DarkGray
    Write-Host " $Text" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor DarkGray
}


function Write-Ok {
    param([string]$Text)
    Write-Host "[OK] $Text" -ForegroundColor Green
}


function Write-Warn {
    param([string]$Text)
    Write-Host "[WARN] $Text" -ForegroundColor Yellow
}


function Write-Fail {
    param([string]$Text)
    Write-Host "[ERROR] $Text" -ForegroundColor Red
}


function Test-CommandExists {
    param([string]$Command)

    return $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}


function Test-PortInUse {
    param([int]$Port)

    try {
        $connection = Get-NetTCPConnection `
            -LocalPort $Port `
            -State Listen `
            -ErrorAction SilentlyContinue

        return $null -ne $connection
    }
    catch {
        return $false
    }
}


function Get-PortOwner {
    param([int]$Port)

    try {
        $connection = Get-NetTCPConnection `
            -LocalPort $Port `
            -State Listen `
            -ErrorAction SilentlyContinue |
            Select-Object -First 1

        if ($connection) {
            return $connection.OwningProcess
        }
    }
    catch {}

    return $null
}


# ============================================================
# Service configuration
# ============================================================

$Services = @(
    @{
        Name = "Auth Service"
        Key = "auth"
        Directory = "auth-service"
        Port = 4001
    },

    @{
        Name = "User Service"
        Key = "user"
        Directory = "user-service"
        Port = 4002
    },

    @{
        Name = "Problem Service"
        Key = "problem"
        Directory = "problem-service"
        Port = 4003
    },

    @{
        Name = "Contest Service"
        Key = "contest"
        Directory = "contest-service"
        Port = 4004
    },

    @{
        Name = "Bot Service"
        Key = "bot"
        Directory = "bot-service"
        Port = 4005
    },

    @{
        Name = "Testcase Service"
        Key = "testcase"
        Directory = "testcase-service"
        Port = 4006
    },

    @{
        Name = "Judge Service"
        Key = "judge"
        Directory = "judge-service"
        Port = 4007
    },

    @{
        Name = "AI Service"
        Key = "ai"
        Directory = "ai-service"
        Port = 4008
    },

    @{
        Name = "API Gateway"
        Key = "gateway"
        Directory = "api-gateway"
        Port = 4000
    }
)


# ============================================================
# Logging
# ============================================================

function Initialize-Logs {

    if (-not (Test-Path $LogDir)) {
        New-Item `
            -ItemType Directory `
            -Path $LogDir `
            -Force |
            Out-Null
    }

    if ($ClearLogs) {
        Write-Host "Clearing old logs..."

        Get-ChildItem `
            -Path $LogDir `
            -File `
            -ErrorAction SilentlyContinue |
            Remove-Item `
                -Force `
                -ErrorAction SilentlyContinue
    }
}


function Get-ServiceLogPaths {

    param($Service)

    return @{
        Stdout = Join-Path $LogDir "$($Service.Key).log"
        Stderr = Join-Path $LogDir "$($Service.Key)-error.log"
    }
}


# ============================================================
# Environment checks
# ============================================================

function Test-SystemRequirements {

    Write-Section "Checking local environment"

    if (-not (Test-CommandExists "node")) {
        throw "Node.js was not found in PATH."
    }

    if (-not (Test-CommandExists "npm")) {
        throw "npm was not found in PATH."
    }

    $nodeVersion = node --version

    Write-Host "Node:       $nodeVersion"
    Write-Host "Backend:    $BackendDir"
    Write-Host "Logs:       $LogDir"

    if (-not (Test-Path $BackendDir)) {
        throw "Backend directory does not exist: $BackendDir"
    }

    Write-Ok "Environment check complete"
}


# ============================================================
# Port verification
# ============================================================

function Test-ServicePorts {

    Write-Section "Checking service ports"

    $blocked = $false

    foreach ($service in $Services) {

        if (Test-PortInUse $service.Port) {

            $pidValue = Get-PortOwner $service.Port

            Write-Fail (
                "$($service.Name) port $($service.Port) " +
                "is already in use by PID $pidValue"
            )

            $blocked = $true
        }
        else {
            Write-Ok "$($service.Name) :$($service.Port) available"
        }
    }

    if ($blocked) {

        Write-Host ""
        Write-Host "Some backend processes may still be running." `
            -ForegroundColor Yellow

        Write-Host ""
        Write-Host "Inspect them with:"
        Write-Host ""
        Write-Host 'Get-CimInstance Win32_Process | Where-Object { $_.Name -eq "node.exe" } | Select-Object ProcessId,CommandLine'
        Write-Host ""

        throw "One or more required ports are already occupied."
    }
}


# ============================================================
# Dependency setup
# ============================================================

function Install-ServiceDependencies {

    param($Service)

    $serviceDir = Join-Path $BackendDir $Service.Directory

    if (-not (Test-Path $serviceDir)) {
        throw "$($Service.Name) directory missing: $serviceDir"
    }

    $packageJson = Join-Path $serviceDir "package.json"

    if (-not (Test-Path $packageJson)) {
        throw "package.json missing for $($Service.Name)"
    }

    $nodeModules = Join-Path $serviceDir "node_modules"

    if (-not (Test-Path $nodeModules)) {

        Write-Host ""
        Write-Host "Installing dependencies for $($Service.Name)..." `
            -ForegroundColor Yellow

        Push-Location $serviceDir

        try {
            npm install

            if ($LASTEXITCODE -ne 0) {
                throw "npm install failed for $($Service.Name)"
            }
        }
        finally {
            Pop-Location
        }

        Write-Ok "Dependencies installed for $($Service.Name)"
    }
    else {
        Write-Ok "$($Service.Name) dependencies already installed"
    }
}


# ============================================================
# Prisma setup
# ============================================================

function Invoke-PrismaGenerate {

    param($Service)

    $serviceDir = Join-Path $BackendDir $Service.Directory
    $schemaPath = Join-Path $serviceDir "prisma\schema.prisma"

    if (-not (Test-Path $schemaPath)) {
        return
    }

    Write-Host "Prisma generate: $($Service.Name)..."

    Push-Location $serviceDir

    try {

        npx prisma generate

        if ($LASTEXITCODE -ne 0) {
            throw "prisma generate failed for $($Service.Name)"
        }
    }
    finally {
        Pop-Location
    }

    Write-Ok "Prisma generated for $($Service.Name)"
}


# ============================================================
# Full bootstrap
# ============================================================

function Invoke-BackendSetup {

    Write-Section "Backend bootstrap"

    Write-Host ""
    Write-Warn "Backend services must NOT be running during Prisma generation."
    Write-Host ""

    foreach ($service in $Services) {
        Install-ServiceDependencies $service
    }

    Write-Host ""

    foreach ($service in $Services) {
        Invoke-PrismaGenerate $service
    }

    Write-Host ""
    Write-Ok "Backend bootstrap complete"

    Write-Host ""
    Write-Warn "Database migrations are intentionally NOT run automatically."
    Write-Host "Run Prisma migrations manually only when needed."
}


# ============================================================
# Start individual service
# ============================================================

function Start-BackendService {

    param($Service)

    $serviceDir = Join-Path $BackendDir $Service.Directory
    $serverFile = Join-Path $serviceDir "src\server.js"

    if (-not (Test-Path $serverFile)) {
        throw "src/server.js missing for $($Service.Name): $serverFile"
    }

    $logs = Get-ServiceLogPaths $Service

    # Start each run with fresh logs.
    Set-Content `
        -Path $logs.Stdout `
        -Value "" `
        -Encoding UTF8

    Set-Content `
        -Path $logs.Stderr `
        -Value "" `
        -Encoding UTF8

    if ($Dev) {
        $arguments = @(
            "--watch",
            "src/server.js"
        )
    }
    else {
        $arguments = @(
            "src/server.js"
        )
    }

    try {

        $process = Start-Process `
            -FilePath "node" `
            -ArgumentList $arguments `
            -WorkingDirectory $serviceDir `
            -RedirectStandardOutput $logs.Stdout `
            -RedirectStandardError $logs.Stderr `
            -WindowStyle Hidden `
            -PassThru

        $entry = [PSCustomObject]@{
            Name = $Service.Name
            Key = $Service.Key
            Port = $Service.Port
            Process = $process
            StdoutLog = $logs.Stdout
            StderrLog = $logs.Stderr
            ExitReported = $false
        }

        $script:RunningServices += $entry

        Write-Host (
            "Started {0,-20} :{1}  PID {2}" -f `
            $Service.Name,
            $Service.Port,
            $process.Id
        ) -ForegroundColor Green

        return $entry
    }
    catch {

        Write-Fail "Failed to start $($Service.Name)"
        Write-Host $_.Exception.Message

        throw
    }
}


# ============================================================
# Startup health check
# ============================================================

function Test-InitialServiceState {

    Write-Host ""
    Write-Host "Waiting briefly for startup validation..."

    Start-Sleep -Seconds 3

    $failedServices = @()

    foreach ($service in $script:RunningServices) {

        $service.Process.Refresh()

        if ($service.Process.HasExited) {

            $service.ExitReported = $true

            Write-Fail (
                "$($service.Name) exited during startup " +
                "with code $($service.Process.ExitCode)"
            )

            Write-Host "  stderr: $($service.StderrLog)" `
                -ForegroundColor Yellow

            $failedServices += $service
        }
        elseif (-not (Test-PortInUse $service.Port)) {

            Write-Warn (
                "$($service.Name) is running but port " +
                "$($service.Port) is not listening yet."
            )
        }
        else {

            Write-Ok "$($service.Name) listening on :$($service.Port)"
        }
    }

    if ($failedServices.Count -gt 0) {

        Write-Host ""
        Write-Host "Startup errors:" -ForegroundColor Red

        foreach ($service in $failedServices) {

            Write-Host ""
            Write-Host "----- $($service.Name) -----" `
                -ForegroundColor Yellow

            if (Test-Path $service.StderrLog) {

                Get-Content `
                    $service.StderrLog `
                    -Tail 50 `
                    -ErrorAction SilentlyContinue
            }
        }

        throw "$($failedServices.Count) service(s) failed during startup."
    }
}


# ============================================================
# Stop services
# ============================================================

function Stop-AllBackendServices {

    if ($script:Stopping) {
        return
    }

    $script:Stopping = $true

    Write-Section "Stopping CP Bot backend"

    foreach ($service in $script:RunningServices) {

        try {

            $service.Process.Refresh()

            if (-not $service.Process.HasExited) {

                Write-Host (
                    "Stopping {0} (PID {1})..." -f `
                    $service.Name,
                    $service.Process.Id
                )

                # taskkill /T also kills descendants such as node --watch children.
                & taskkill `
                    /PID $service.Process.Id `
                    /T `
                    /F `
                    2>$null |
                    Out-Null
            }
        }
        catch {
            Write-Warn "Could not stop $($service.Name): $($_.Exception.Message)"
        }
    }

    Write-Host ""
    Write-Ok "Backend services stopped"
}


# ============================================================
# Process monitor
# ============================================================

function Watch-BackendServices {

    Write-Host ""
    Write-Host "Monitoring services. Press Ctrl+C to stop." `
        -ForegroundColor Cyan

    while (-not $script:Stopping) {

        foreach ($service in $script:RunningServices) {

            try {

                $service.Process.Refresh()

                if (
                    $service.Process.HasExited -and
                    -not $service.ExitReported
                ) {

                    $service.ExitReported = $true

                    $exitCode = $service.Process.ExitCode

                    if ($exitCode -eq 0) {
                        Write-Warn (
                            "$($service.Name) exited with code 0"
                        )
                    }
                    else {
                        Write-Fail (
                            "$($service.Name) exited with code $exitCode"
                        )
                    }

                    Write-Host (
                        "  Error log: $($service.StderrLog)"
                    ) -ForegroundColor Yellow
                }
            }
            catch {}
        }

        Start-Sleep -Seconds 1
    }
}


# ============================================================
# Main
# ============================================================

try {

    Write-Section "CP Bot - local backend launcher"

    Initialize-Logs
    Test-SystemRequirements

    if ($SkipSetup) {

        Write-Host ""
        Write-Warn "Skipping dependency and Prisma setup (-SkipSetup)."
    }
    else {

        Invoke-BackendSetup
    }

    Test-ServicePorts

    Write-Section "Starting backend services"

    foreach ($service in $Services) {
        Start-BackendService $service | Out-Null
    }

    Test-InitialServiceState

    Write-Section "CP Bot backend launched successfully"

    Write-Host "Gateway:  http://localhost:4000"
    Write-Host "Logs:     $LogDir"

    Write-Host ""

    foreach ($service in $script:RunningServices) {

        Write-Host (
            "{0,-20} stdout: {1}.log" -f `
            $service.Name,
            $service.Key
        )
    }

    Write-Host ""
    Write-Host "Useful commands:" -ForegroundColor Cyan

    Write-Host ""
    Write-Host "Follow Auth errors:"
    Write-Host '  Get-Content .\logs\auth-error.log -Wait'

    Write-Host ""
    Write-Host "Follow Problem Service errors:"
    Write-Host '  Get-Content .\logs\problem-error.log -Wait'

    Write-Host ""
    Write-Host "Follow Testcase Service errors:"
    Write-Host '  Get-Content .\logs\testcase-error.log -Wait'

    Write-Host ""
    Write-Host "Follow Gateway errors:"
    Write-Host '  Get-Content .\logs\gateway-error.log -Wait'

    Write-Host ""

    Watch-BackendServices
}
catch {

    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Red
    Write-Host " BACKEND STARTUP FAILED" -ForegroundColor Red
    Write-Host ("=" * 60) -ForegroundColor Red

    Write-Host ""
    Write-Host "Message:" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Red

    Write-Host ""
    Write-Host "Location:" -ForegroundColor Yellow
    Write-Host $_.InvocationInfo.PositionMessage

    Write-Host ""
    Write-Host "Full error:" -ForegroundColor Yellow
    Write-Host ($_ | Out-String)

    Stop-AllBackendServices

    exit 1
}
finally {

    Stop-AllBackendServices
}