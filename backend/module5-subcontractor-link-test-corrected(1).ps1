param(
    [string]$BaseUrl = $(if ($env:CIVIL_API_URL) { $env:CIVIL_API_URL } else { "http://localhost/civil-site-management/public/api" }),
    [string]$Email = $(if ($env:CIVIL_API_EMAIL) { $env:CIVIL_API_EMAIL } else { "erp.dvn@gmail.com" }),
    [string]$Password = $(if ($env:CIVIL_API_PASSWORD) { $env:CIVIL_API_PASSWORD } else { "CivilPro@12345" })
)

$ErrorActionPreference = "Stop"
$BaseUrl = $BaseUrl.TrimEnd('/')
$ResultDir = Join-Path $PSScriptRoot "api-test-results"
$ResultFile = Join-Path $ResultDir "module5-subcontractor-link-test-results.txt"
New-Item -ItemType Directory -Force -Path $ResultDir | Out-Null
Set-Content -Path $ResultFile -Encoding UTF8 -Value "Module 5 Labour-Subcontractor Link API Test`r`nStarted: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`r`nBase URL: $BaseUrl`r`n"

$script:TestNo = 0
$script:Session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Pass([string]$Message) {
    $script:TestNo++
    $line = "PASS {0:D2} - {1}" -f $script:TestNo, $Message
    Write-Host $line -ForegroundColor Green
    Add-Content -Path $ResultFile -Encoding UTF8 -Value $line
}

function Fail([string]$Message, $Detail) {
    $script:TestNo++
    $line = "FAIL {0:D2} - {1}" -f $script:TestNo, $Message
    Write-Host $line -ForegroundColor Red
    Add-Content -Path $ResultFile -Encoding UTF8 -Value $line
    if ($null -ne $Detail) {
        $detailText = $Detail | Out-String
        Write-Host $detailText -ForegroundColor Yellow
        Add-Content -Path $ResultFile -Encoding UTF8 -Value $detailText
    }
    Write-Host "Stopped at first failure. Result: $ResultFile" -ForegroundColor Red
    exit 1
}

function Api([string]$Method, [string]$Path, $Body = $null) {
    $request = @{
        Method      = $Method
        Uri         = "$BaseUrl/$Path"
        Headers     = @{ Accept = "application/json" }
        WebSession  = $script:Session
        ContentType = "application/json"
    }
    if ($null -ne $Body) {
        $request.Body = $Body | ConvertTo-Json -Depth 15 -Compress
    }
    try {
        return Invoke-RestMethod @request
    } catch {
        $detail = $_.Exception.Message
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            $detail = "$detail`r`n$($_.ErrorDetails.Message)"
        }
        throw $detail
    }
}

try {
    $login = Api "POST" "auth/login" @{ email = $Email; password = $Password; remember = $false }
    if (-not $login.success) { Fail "Login" $login }
    Pass "Login"

    $me = Api "GET" "auth/me"
    if (-not $me.success) { Fail "Authenticated user" $me }
    Pass "Authenticated user"

    $masters = Api "GET" "labour/masters"
    $subcontractors = @($masters.data.masters.subcontractors)
    if (-not $masters.success -or $subcontractors.Count -eq 0) {
        Fail "Labour masters expose active subcontractors" $masters
    }
    Pass "Labour masters expose active subcontractors"

    $contractorResponse = Api "GET" "labour/contractors"
    $contractors = @($contractorResponse.data.labour_contractors)
    if (-not $contractorResponse.success -or $contractors.Count -eq 0) {
        Fail "List labour contractors" $contractorResponse
    }
    if (-not ($contractors[0].PSObject.Properties.Name -contains "subcontractor_id")) {
        Fail "Labour contractor API contains subcontractor_id" $contractors[0]
    }
    Pass "List labour contractors with subcontractor_id"

    $script:TemporaryContractorId = $null
    $linked = @($contractors | Where-Object { $null -ne $_.subcontractor_id -and [int64]$_.subcontractor_id -gt 0 })
    if ($linked.Count -gt 0) {
        $selected = $linked[0]
        Pass "Find existing linked labour contractor dynamically"
    } else {
        $usedSubcontractorIds = @($contractors | Where-Object { $null -ne $_.subcontractor_id } | ForEach-Object { [int64]$_.subcontractor_id })
        $availableSubcontractors = @($subcontractors | Where-Object { $usedSubcontractorIds -notcontains [int64]$_.id })
        if ($availableSubcontractors.Count -eq 0) {
            Fail "Find subcontractor available for temporary API test" "No active unlinked subcontractor is available."
        }
        $statusRows = @($masters.data.masters.'contractor-statuses')
        $activeStatus = @($statusRows | Where-Object { $_.status_code -eq 'ACTIVE' -or $_.is_active -eq 1 } | Select-Object -First 1)
        if ($activeStatus.Count -eq 0) { Fail "Find labour contractor status" $masters }
        $stamp = Get-Date -Format 'yyyyMMddHHmmss'
        $created = Api "POST" "labour/contractors" @{
            subcontractor_id = [int64]$availableSubcontractors[0].id
            contractor_code = "M5LINK_$stamp"
            contractor_name = "Module 5 Link API Test $stamp"
            status_id = [int64]$activeStatus[0].id
            notes = "Temporary API regression-test record; safe to delete."
        }
        if (-not $created.success -or -not $created.data.labour_contractor.id) { Fail "Create temporary linked labour contractor" $created }
        $selected = $created.data.labour_contractor
        $script:TemporaryContractorId = [int64]$selected.id
        Pass "Create temporary linked labour contractor"
    }
    $subcontractorId = [int64]$selected.subcontractor_id

    $validSubcontractor = @($subcontractors | Where-Object { [int64]$_.id -eq $subcontractorId })
    if ($validSubcontractor.Count -eq 0) {
        Fail "Mapped subcontractor is active and company-accessible" $selected
    }
    Pass "Mapped subcontractor is active and company-accessible"

    $single = Api "GET" ("labour/contractors/{0}" -f $selected.id)
    $singleContractor = $single.data.labour_contractor
    if (-not $single.success -or [int64]$singleContractor.subcontractor_id -ne $subcontractorId -or [string]::IsNullOrWhiteSpace([string]$singleContractor.subcontractor_name)) {
        Fail "View labour contractor with subcontractor details" $single
    }
    Pass "View labour contractor with subcontractor details"

    $filteredContractorsResponse = Api "GET" ("labour/contractors?subcontractor_id={0}" -f $subcontractorId)
    $filteredContractors = @($filteredContractorsResponse.data.labour_contractors)
    if (-not $filteredContractorsResponse.success -or $filteredContractors.Count -eq 0) {
        Fail "Filter labour contractors by subcontractor" $filteredContractorsResponse
    }
    foreach ($row in $filteredContractors) {
        if ([int64]$row.subcontractor_id -ne $subcontractorId) { Fail "Filter labour contractors by subcontractor" $row }
    }
    Pass "Filter labour contractors by subcontractor"

    $workerResponse = Api "GET" ("labour/workers?subcontractor_id={0}" -f $subcontractorId)
    $workers = @($workerResponse.data.labour_workers)
    if (-not $workerResponse.success) { Fail "Filter workers by subcontractor" $workerResponse }
    foreach ($row in $workers) {
        if ([int64]$row.subcontractor_id -ne $subcontractorId -or [string]::IsNullOrWhiteSpace([string]$row.subcontractor_name)) {
            Fail "Worker exposes the correct subcontractor" $row
        }
    }
    Pass "Filter workers and expose subcontractor details"

    $assignmentResponse = Api "GET" ("labour/assignments?subcontractor_id={0}" -f $subcontractorId)
    $assignments = @($assignmentResponse.data.labour_assignments)
    if (-not $assignmentResponse.success) { Fail "Filter assignments by subcontractor" $assignmentResponse }
    foreach ($row in $assignments) {
        if ([int64]$row.subcontractor_id -ne $subcontractorId -or [string]::IsNullOrWhiteSpace([string]$row.subcontractor_name)) {
            Fail "Assignment exposes the correct subcontractor" $row
        }
    }
    Pass "Filter assignments and expose subcontractor details"

    $attendanceResponse = Api "GET" ("labour-attendance?subcontractor_id={0}" -f $subcontractorId)
    $batches = @($attendanceResponse.data.attendance_batches)
    if (-not $attendanceResponse.success) { Fail "Filter attendance by subcontractor" $attendanceResponse }
    Pass "Filter attendance batches by subcontractor"

    foreach ($batchRow in $batches) {
        $batchResponse = Api "GET" ("labour-attendance/{0}" -f $batchRow.id)
        if (-not $batchResponse.success) { Fail "View filtered attendance batch" $batchResponse }
        $matchingEntries = @($batchResponse.data.attendance_batch.entries | Where-Object { [int64]$_.subcontractor_id -eq $subcontractorId })
        if ($matchingEntries.Count -eq 0) { Fail "Filtered attendance contains matching subcontractor entry" $batchResponse }
        foreach ($entry in $matchingEntries) {
            if ([string]::IsNullOrWhiteSpace([string]$entry.subcontractor_name)) {
                Fail "Attendance entry exposes subcontractor details" $entry
            }
        }
    }
    Pass "Attendance entries expose subcontractor details"

    if ($null -ne $script:TemporaryContractorId) {
        $deleted = Api "DELETE" ("labour/contractors/{0}" -f $script:TemporaryContractorId)
        if (-not $deleted.success) { Fail "Delete temporary linked labour contractor" $deleted }
        Pass "Delete temporary linked labour contractor"
        $script:TemporaryContractorId = $null
    }

    $logout = Api "POST" "auth/logout"
    if (-not $logout.success) { Fail "Logout" $logout }
    Pass "Logout"

    $final = "SUCCESS - All $script:TestNo Module 5 labour-subcontractor link tests passed."
    Write-Host $final -ForegroundColor Green
    Add-Content -Path $ResultFile -Encoding UTF8 -Value $final
    Write-Host "Result: $ResultFile" -ForegroundColor Cyan
} catch {
    Fail "Unexpected API test error" $_
}
