param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$Email = "erp.dvn@gmail.com",
    [string]$Password = "CivilPro@12345"
)

$ErrorActionPreference = "Stop"
$ResultDir = Join-Path $PSScriptRoot "api-test-results"
$ResultFile = Join-Path $ResultDir "module5-complete-test-results.txt"
New-Item -ItemType Directory -Force -Path $ResultDir | Out-Null
Set-Content -Path $ResultFile -Value "Module 5 - Labour and Attendance Subcontractor Link API Test`r`nStarted: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`r`n"
$script:Step = 0
$Session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Write-Result([string]$State,[string]$Text) {
    $script:Step++
    $line = "{0} {1:D2} - {2}" -f $State,$script:Step,$Text
    Write-Host $line
    Add-Content -Path $ResultFile -Value $line
}

function Invoke-Api([string]$Method,[string]$Path,$Body=$null) {
    $args = @{ Method=$Method; Uri=($BaseUrl.TrimEnd('/')+$Path); WebSession=$Session; UseBasicParsing=$true; Headers=@{Accept='application/json'} }
    if ($null -ne $Body) {
        $args.ContentType='application/json'
        $args.Body=($Body | ConvertTo-Json -Depth 12 -Compress)
    }
    $response = Invoke-WebRequest @args
    $json = $response.Content | ConvertFrom-Json
    if ($null -eq $json -or $json.success -ne $true) { throw "API returned unsuccessful response for $Method $Path" }
    return $json
}

function Require($Value,[string]$Message) {
    if ($null -eq $Value -or ($Value -is [array] -and $Value.Count -eq 0)) { throw $Message }
    return $Value
}

try {
    Invoke-Api 'POST' '/api/auth/login' @{email=$Email;password=$Password;remember=$false} | Out-Null
    Write-Result 'PASS' 'Login'

    $me=Invoke-Api 'GET' '/api/auth/me'
    Require $me.data.user 'Authenticated user missing' | Out-Null
    Write-Result 'PASS' 'Authenticated user'

    $mastersResponse=Invoke-Api 'GET' '/api/labour/masters'
    $masters=Require $mastersResponse.data.masters 'Labour masters missing'
    Write-Result 'PASS' 'Labour masters'

    $subcontractors=@($masters.subcontractors)
    Require $subcontractors 'No active subcontractor is available through Labour masters' | Out-Null
    $subcontractor=$subcontractors[0]
    if (-not $subcontractor.id -or [string]::IsNullOrWhiteSpace([string]$subcontractor.contractor_name)) { throw 'Subcontractor master fields are missing' }
    Write-Result 'PASS' 'Subcontractors available in Labour masters'

    $contractorResponse=Invoke-Api 'GET' '/api/labour/contractors'
    $contractors=@($contractorResponse.data.labour_contractors)
    Require $contractors 'No labour contractor found' | Out-Null
    if (-not ($contractors[0].PSObject.Properties.Name -contains 'subcontractor_id')) { throw 'Labour contractor response does not contain subcontractor_id' }
    Write-Result 'PASS' 'Labour contractors contain subcontractor link field'

    $contractor=$contractors[0]
    $single=Invoke-Api 'GET' ("/api/labour/contractors/{0}" -f $contractor.id)
    if (-not ($single.data.labour_contractor.PSObject.Properties.Name -contains 'subcontractor_id')) { throw 'Labour contractor detail does not contain subcontractor_id' }
    Write-Result 'PASS' 'View labour contractor with subcontractor link field'

    $subcontractorId=[int]$subcontractor.id
    $filteredContractors=Invoke-Api 'GET' ("/api/labour/contractors?subcontractor_id={0}" -f $subcontractorId)
    foreach($row in @($filteredContractors.data.labour_contractors)) {
        if ([int]$row.subcontractor_id -ne $subcontractorId) { throw 'Labour contractor subcontractor filter returned an incorrect record' }
    }
    Write-Result 'PASS' 'Filter labour contractors by subcontractor'

    $workersResponse=Invoke-Api 'GET' ("/api/labour/workers?subcontractor_id={0}" -f $subcontractorId)
    foreach($row in @($workersResponse.data.labour_workers)) {
        if ([int]$row.subcontractor_id -ne $subcontractorId) { throw 'Worker subcontractor filter returned an incorrect record' }
        if ([string]::IsNullOrWhiteSpace([string]$row.subcontractor_name)) { throw 'Worker subcontractor name is missing' }
    }
    Write-Result 'PASS' 'Filter labour workers by subcontractor'

    $assignmentsResponse=Invoke-Api 'GET' ("/api/labour/assignments?subcontractor_id={0}" -f $subcontractorId)
    foreach($row in @($assignmentsResponse.data.labour_assignments)) {
        if ([int]$row.subcontractor_id -ne $subcontractorId) { throw 'Assignment subcontractor filter returned an incorrect record' }
        if ([string]::IsNullOrWhiteSpace([string]$row.subcontractor_name)) { throw 'Assignment subcontractor name is missing' }
    }
    Write-Result 'PASS' 'Filter labour assignments by subcontractor'

    $attendanceResponse=Invoke-Api 'GET' ("/api/labour-attendance?subcontractor_id={0}" -f $subcontractorId)
    if (-not ($attendanceResponse.data.PSObject.Properties.Name -contains 'attendance_batches')) { throw 'Attendance batch collection is missing' }
    Write-Result 'PASS' 'Filter labour attendance by subcontractor'

    Invoke-Api 'POST' '/api/auth/logout' @{} | Out-Null
    Write-Result 'PASS' 'Logout'

    $final="ALL $script:Step MODULE 5 SUBCONTRACTOR LINK API TESTS PASSED"
    Write-Host $final -ForegroundColor Green
    Add-Content -Path $ResultFile -Value "`r`n$final`r`nCompleted: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    exit 0
} catch {
    $message=$_.Exception.Message
    Write-Result 'FAIL' $message
    Add-Content -Path $ResultFile -Value "`r`nTESTING STOPPED AT FIRST FAILURE.`r`nCompleted: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    exit 1
}
