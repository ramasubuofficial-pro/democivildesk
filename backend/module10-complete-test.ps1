param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$Email = "erp.dvn@gmail.com",
    [string]$Password = "CivilPro@12345"
)

$ErrorActionPreference = "Stop"
$ResultDir = Join-Path $PSScriptRoot "api-test-results"
$ResultFile = Join-Path $ResultDir "module10-complete-test-results.txt"
New-Item -ItemType Directory -Force -Path $ResultDir | Out-Null
$script:Step = 0
$script:ResultLog = New-Object System.Collections.Generic.List[string]
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Write-Line([string]$Text) { [void]$script:ResultLog.Add($Text); Write-Host $Text }
function Pass([string]$Name) { $script:Step++; Write-Line ("PASS {0:D2} - {1}" -f $script:Step,$Name) }
function Fail([string]$Name,[string]$Message) { $script:Step++; Write-Line ("FAIL {0:D2} - {1}: {2}" -f $script:Step,$Name,$Message); $script:ResultLog | Set-Content -Encoding UTF8 $ResultFile; throw $Message }
function Invoke-Api([string]$Method,[string]$Path,$Body=$null) {
    $requestArgs=@{Uri="$BaseUrl$Path";Method=$Method;WebSession=$session;Headers=@{Accept="application/json"};UseBasicParsing=$true}
    if ($null -ne $Body) { $requestArgs.ContentType="application/json"; $requestArgs.Body=($Body | ConvertTo-Json -Depth 12) }
    try { $raw=Invoke-WebRequest @requestArgs; if([string]::IsNullOrWhiteSpace($raw.Content)){return $null}; return $raw.Content|ConvertFrom-Json }
    catch { $detail=$_.Exception.Message; if($_.ErrorDetails.Message){$detail+=" | "+$_.ErrorDetails.Message}; throw $detail }
}
function Must([string]$Name,[scriptblock]$Call) {
    try { $response=& $Call; if(($null -eq $response)-or($response.success -ne $true)){throw "API success response was not returned."}; Pass $Name; return $response }
    catch { Fail $Name $_.Exception.Message }
}
function Items($Value) { if($null -eq $Value){return @()}; return @($Value) }

$started=Get-Date
Write-Line "Module 10 - Standalone Approvals Complete API Test"
Write-Line ("Started: "+$started.ToString("yyyy-MM-dd HH:mm:ss"))
Write-Line ""

$login=Must "Login" {Invoke-Api POST "/api/auth/login" @{email=$Email;password=$Password}}
$me=Must "Authenticated user" {Invoke-Api GET "/api/auth/me"}
$summaryBefore=Must "Approval summary" {Invoke-Api GET "/api/approvals/summary"}
$inboxBefore=Must "Consolidated pending approval inbox" {Invoke-Api GET "/api/approvals"}
$historyBefore=Must "Consolidated approval history" {Invoke-Api GET "/api/approvals/history"}
$expenseMasters=Must "Expense masters for dynamic test data" {Invoke-Api GET "/api/expenses/masters"}
$projects=Must "Accessible projects" {Invoke-Api GET "/api/projects"}
$project=Items $projects.data.projects | Select-Object -First 1
if(!$project){Fail "Dynamic project selection" "No accessible project exists."}
$projectId=[int]$project.id; Pass "Dynamic project selection"
$sites=Must "Accessible project sites" {Invoke-Api GET ("/api/sites?project_id="+$projectId)}
$site=Items $sites.data.sites | Where-Object {[int]$_.project_id -eq $projectId} | Select-Object -First 1
$siteId=if($site){[int]$site.id}else{$null}; Pass "Dynamic site selection"
$category=Items $expenseMasters.data.masters.expense_categories | Where-Object {[int]$_.is_active -eq 1} | Select-Object -First 1
if(!$category){Fail "Dynamic expense category selection" "No active expense category exists."}
$categoryId=[int]$category.id; Pass "Dynamic expense category selection"

$stamp=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds(); $today=(Get-Date).ToString("yyyy-MM-dd")
$requestBody=@{project_id=$projectId;request_no="APR10_$stamp";request_date=$today;required_date=$today;purpose="Module 10 standalone approval test"}
if($siteId){$requestBody.site_id=$siteId}
$created=Must "Create fresh approval test request" {Invoke-Api POST "/api/expenses/requests" $requestBody}
$requestId=[int]$created.data.expense_request.id
$item=Must "Add request item" {Invoke-Api POST ("/api/expenses/requests/"+$requestId+"/items") @{expense_category_id=$categoryId;description="Module 10 approval line";quantity=1;estimated_rate=750;notes="Standalone approval test"}}
$submitted=Must "Submit request to approval centre" {Invoke-Api POST ("/api/expenses/requests/"+$requestId+"/submit") @{remarks="Submitted for Module 10 test"}}
$filtered=Must "Filter inbox by module and project" {Invoke-Api GET ("/api/approvals?module=EXPENSE_REQUEST&project_id="+$projectId+"&search=APR10_")}
$pending=@(Items $filtered.data.approvals | Where-Object {$_.module -eq "EXPENSE_REQUEST" -and [int]$_.id -eq $requestId})
if($pending.Count -ne 1){Fail "Exact submitted record visible in inbox" "The fresh request was not found exactly once in the approval inbox."}
if(-not (@($pending[0].allowed_actions) -contains "APPROVE")){Fail "Exact submitted record visible in inbox" "APPROVE is not allowed for the submitted request."}
Pass "Exact submitted record visible in inbox"
$detail=Must "View exact approval item" {Invoke-Api GET ("/api/approvals/EXPENSE_REQUEST/"+$requestId)}
$approved=Must "Approve through standalone approval endpoint" {Invoke-Api POST ("/api/approvals/EXPENSE_REQUEST/"+$requestId+"/approve") @{remarks="Approved through Module 10 approval centre"}}
$requestAfter=Must "Verify delegated module status" {Invoke-Api GET ("/api/expenses/requests/"+$requestId)}
$statusId=[int]$requestAfter.data.expense_request.status_id
$approvedStatus=Items $expenseMasters.data.masters.request_statuses | Where-Object {$_.status_code -eq "APPROVED"} | Select-Object -First 1
if((!$approvedStatus)-or($statusId -ne [int]$approvedStatus.id)){Fail "Approved record removed from pending inbox" "The request did not reach APPROVED status."}
$inboxAfter=Must "Reload approval inbox after action" {Invoke-Api GET "/api/approvals?module=EXPENSE_REQUEST"}
$stillPending=@(Items $inboxAfter.data.approvals | Where-Object {[int]$_.id -eq $requestId})
if($stillPending.Count -ne 0){Fail "Approved record removed from pending inbox" "The approved request is still shown as pending."}; Pass "Approved record removed from pending inbox"
$notifications=Must "Load exact approval notifications" {Invoke-Api GET "/api/notifications"}
$matching=@(Items $notifications.data.notifications | Where-Object {$_.source_module -eq "EXPENSE" -and $_.source_table -eq "expense_requests" -and [int]$_.source_record_id -eq $requestId -and $_.event_code -eq "EXPENSE_REQUEST_APPROVE"})
if($matching.Count -eq 0){Fail "Approval notification and delivered email" "No approval notification exists for the exact request."}
$sent=@($matching | Where-Object {[int]$_.email_sent -eq 1})
if($sent.Count -eq 0){$errors=@($matching|ForEach-Object{[string]$_.email_error}|Where-Object{-not [string]::IsNullOrWhiteSpace($_)}|Select-Object -Unique);$message=if($errors.Count){$errors -join " | "}else{"email_sent is not 1 and no email_error is recorded."};Fail "Approval notification and delivered email" $message}
Pass "Approval notification and delivered email"
$historyAfter=Must "Approval action available in consolidated history" {Invoke-Api GET ("/api/approvals/history?date_from="+$today+"&date_to="+$today)}
$historyMatch=@(Items $historyAfter.data.history | Where-Object {$_.source_table -eq "expense_requests" -and [int]$_.source_record_id -eq $requestId})
if($historyMatch.Count -eq 0){Fail "Exact record found in approval history" "The exact approved request was not found in consolidated history."}; Pass "Exact record found in approval history"
$logout=Must "Logout" {Invoke-Api POST "/api/auth/logout" @{}}
Write-Line ""
Write-Line ("ALL MODULE 10 TESTS PASSED: "+$script:Step+"/"+$script:Step)
Write-Line ("Completed: "+(Get-Date).ToString("yyyy-MM-dd HH:mm:ss"))
$script:ResultLog | Set-Content -Encoding UTF8 $ResultFile
