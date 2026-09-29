$ErrorActionPreference = "Stop"
$BaseUrl = if ($env:CIVIL_API_URL) { $env:CIVIL_API_URL.TrimEnd('/') } else { "http://civil-site-management.local/api" }
$Email = if ($env:CIVIL_API_EMAIL) { $env:CIVIL_API_EMAIL } else { "erp.dvn@gmail.com" }
$Password = if ($env:CIVIL_API_PASSWORD) { $env:CIVIL_API_PASSWORD } else { "CivilPro@12345" }
$ResultDir = Join-Path $PSScriptRoot "api-test-results"
$ResultFile = Join-Path $ResultDir "module5-subcontractor-link-test-results.txt"
New-Item -ItemType Directory -Force -Path $ResultDir | Out-Null
Set-Content -Path $ResultFile -Value "Module 5 Labour-Subcontractor Link Test`r`nStarted: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`r`n"
$script:TestNo = 0
$script:Session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Pass([string]$Message) {
    $script:TestNo++
    $line = "PASS {0:D2} - {1}" -f $script:TestNo, $Message
    Write-Host $line -ForegroundColor Green
    Add-Content -Path $ResultFile -Value $line
}

function Fail([string]$Message, $Detail) {
    $script:TestNo++
    $line = "FAIL {0:D2} - {1}" -f $script:TestNo, $Message
    Write-Host $line -ForegroundColor Red
    Add-Content -Path $ResultFile -Value $line
    if ($null -ne $Detail) { Add-Content -Path $ResultFile -Value ($Detail | Out-String) }
    exit 1
}

function Api([string]$Method, [string]$Path, $Body = $null) {
    $headers = @{ Accept = "application/json" }
    $args = @{ Method=$Method; Uri="$BaseUrl/$Path"; Headers=$headers; WebSession=$script:Session; ContentType="application/json" }
    if ($null -ne $Body) { $args.Body = ($Body | ConvertTo-Json -Depth 12) }
    try { return Invoke-RestMethod @args } catch { throw $_ }
}

try {
    $login = Api "POST" "auth/login" @{ email=$Email; password=$Password }
    if (-not $login.success) { Fail "Login" $login }
    Pass "Login"

    $masters = Api "GET" "labour/masters"
    $subs = @($masters.data.masters.subcontractors)
    if (-not $masters.success -or $null -eq $masters.data.masters.subcontractors) { Fail "Labour masters expose subcontractors" $masters }
    Pass "Labour masters expose subcontractors"

    $contractors = Api "GET" "labour/contractors"
    if (-not $contractors.success) { Fail "List labour contractors" $contractors }
    Pass "List labour contractors"

    $linked = @($contractors.data.labour_contractors | Where-Object { $_.subcontractor_id } | Select-Object -First 1)
    if ($linked.Count -eq 0) { Fail "Find mapped labour contractor" "Map at least one existing labour contractor using the supplied SQL instructions, then rerun." }
    $subId = [int]$linked[0].subcontractor_id
    Pass "Find mapped labour contractor"

    $contractor = Api "GET" ("labour/contractors/{0}" -f $linked[0].id)
    if ([int]$contractor.data.labour_contractor.subcontractor_id -ne $subId -or -not $contractor.data.labour_contractor.subcontractor_name) { Fail "View contractor with subcontractor" $contractor }
    Pass "View contractor with subcontractor"

    $workers = Api "GET" ("labour/workers?subcontractor_id={0}" -f $subId)
    if (-not $workers.success) { Fail "Filter workers by subcontractor" $workers }
    foreach ($worker in @($workers.data.labour_workers)) { if ([int]$worker.subcontractor_id -ne $subId) { Fail "Filter workers by subcontractor" $worker } }
    Pass "Filter workers by subcontractor"

    $assignments = Api "GET" ("labour/assignments?subcontractor_id={0}" -f $subId)
    if (-not $assignments.success) { Fail "Filter assignments by subcontractor" $assignments }
    foreach ($assignment in @($assignments.data.labour_assignments)) { if ([int]$assignment.subcontractor_id -ne $subId) { Fail "Filter assignments by subcontractor" $assignment } }
    Pass "Filter assignments by subcontractor"

    $attendance = Api "GET" ("labour-attendance?subcontractor_id={0}" -f $subId)
    if (-not $attendance.success) { Fail "Filter attendance batches by subcontractor" $attendance }
    Pass "Filter attendance batches by subcontractor"

    if (@($attendance.data.attendance_batches).Count -gt 0) {
        $batch = Api "GET" ("labour-attendance/{0}" -f $attendance.data.attendance_batches[0].id)
        foreach ($entry in @($batch.data.attendance_batch.entries | Where-Object { [int]$_.subcontractor_id -eq $subId })) {
            if (-not $entry.subcontractor_name) { Fail "Attendance entries expose subcontractor" $entry }
        }
        Pass "Attendance entries expose subcontractor"
    } else { Pass "Attendance filter valid (no matching historical batches)" }

    try { Api "POST" "auth/logout" | Out-Null } catch { }
    Pass "Logout"
    $final = "SUCCESS - All $script:TestNo Module 5 subcontractor-link tests passed."
    Write-Host $final -ForegroundColor Green
    Add-Content -Path $ResultFile -Value $final
} catch {
    Fail "Unexpected test error" $_
}
