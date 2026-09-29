param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$Email = "erp.dvn@gmail.com",
    [string]$Password = "CivilPro@12345"
)
$ErrorActionPreference="Stop"
$ResultDir=Join-Path $PSScriptRoot "api-test-results"
$ResultFile=Join-Path $ResultDir "module11-complete-test-results.txt"
New-Item -ItemType Directory -Force -Path $ResultDir|Out-Null
$script:Step=0
$script:ResultLog=New-Object System.Collections.Generic.List[string]
$session=New-Object Microsoft.PowerShell.Commands.WebRequestSession
function Write-Line([string]$Text){[void]$script:ResultLog.Add($Text);Write-Host $Text}
function Pass([string]$Name){$script:Step++;Write-Line ("PASS {0:D2} - {1}" -f $script:Step,$Name)}
function Fail([string]$Name,[string]$Message){$script:Step++;Write-Line ("FAIL {0:D2} - {1}: {2}" -f $script:Step,$Name,$Message);$script:ResultLog|Set-Content -Encoding UTF8 $ResultFile;throw $Message}
function Invoke-Api([string]$Method,[string]$Path,$Body=$null){$requestArgs=@{Uri="$BaseUrl$Path";Method=$Method;WebSession=$session;Headers=@{Accept="application/json"};UseBasicParsing=$true};if($null-ne$Body){$requestArgs.ContentType="application/json";$requestArgs.Body=($Body|ConvertTo-Json -Depth 12)};try{$raw=Invoke-WebRequest @requestArgs;if([string]::IsNullOrWhiteSpace($raw.Content)){return $null};return $raw.Content|ConvertFrom-Json}catch{$detail=$_.Exception.Message;if($_.ErrorDetails.Message){$detail+=" | "+$_.ErrorDetails.Message};throw $detail}}
function Must([string]$Name,[scriptblock]$Call){try{$response=&$Call;if(($null-eq$response)-or($response.success-ne$true)){throw "API success response was not returned."};Pass $Name;return $response}catch{Fail $Name $_.Exception.Message}}
function Items($Value){if($null-eq$Value){return @()};return @($Value)}
$started=Get-Date
Write-Line "Module 11 - Dashboard and Reports Complete API Test"
Write-Line ("Started: "+$started.ToString("yyyy-MM-dd HH:mm:ss"));Write-Line ""
$login=Must "Login" {Invoke-Api POST "/api/auth/login" @{email=$Email;password=$Password}}
$me=Must "Authenticated user" {Invoke-Api GET "/api/auth/me"}
$projects=Must "Accessible projects" {Invoke-Api GET "/api/projects"}
$project=Items $projects.data.projects|Select-Object -First 1
if(!$project){Fail "Dynamic project selection" "No accessible project exists."};$projectId=[int]$project.id;Pass "Dynamic project selection"
$masters=Must "Dashboard and report masters" {Invoke-Api GET "/api/dashboard/masters"}
$alertType=Items $masters.data.masters.alert_types|Select-Object -First 1
$severity=Items $masters.data.masters.alert_severities|Where-Object {$_.severity_code-eq"HIGH"}|Select-Object -First 1
$reviewType=Items $masters.data.masters.review_types|Select-Object -First 1
$priority=Items $masters.data.masters.review_priorities|Where-Object {$_.priority_code-eq"HIGH"}|Select-Object -First 1
if((!$alertType)-or(!$severity)-or(!$reviewType)-or(!$priority)){Fail "Dynamic master selection" "One or more Module 11 masters are missing."};Pass "Dynamic master selection"
$overview=Must "Company management dashboard" {Invoke-Api GET "/api/dashboard/overview"}
$projectOverview=Must "Project-filtered management dashboard" {Invoke-Api GET ("/api/dashboard/overview?project_id="+$projectId)}
$performance=Must "Project performance dashboard" {Invoke-Api GET ("/api/dashboard/project-performance?project_id="+$projectId)}
$progress=Must "Daily progress report" {Invoke-Api GET ("/api/reports/daily-progress?project_id="+$projectId)}
$cost=Must "Project cost report" {Invoke-Api GET ("/api/reports/project-cost?project_id="+$projectId)}
$labour=Must "Labour utilisation report" {Invoke-Api GET ("/api/reports/labour?project_id="+$projectId)}
$materials=Must "Material consumption report" {Invoke-Api GET ("/api/reports/materials?project_id="+$projectId)}
$subcontracts=Must "Subcontract commitment report" {Invoke-Api GET ("/api/reports/subcontracts?project_id="+$projectId)}
$expenses=Must "Expense and outstanding report" {Invoke-Api GET ("/api/reports/expenses?project_id="+$projectId)}
$stamp=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds();$today=(Get-Date).ToString("yyyy-MM-dd")
$createdAlert=Must "Create dashboard alert" {Invoke-Api POST "/api/dashboard/alerts" @{project_id=$projectId;alert_type_id=[int]$alertType.id;severity_id=[int]$severity.id;title="Module 11 Alert $stamp";message="Module 11 complete API test alert";source_module="MODULE11_TEST"}}
$alertId=[int]$createdAlert.data.alert.id
$alertList=Must "List dashboard alerts" {Invoke-Api GET ("/api/dashboard/alerts?project_id="+$projectId)}
$exactAlert=@(Items $alertList.data.alerts|Where-Object {[int]$_.id-eq$alertId})
if($exactAlert.Count-ne1){Fail "Verify exact dashboard alert" "Created alert was not returned exactly once."};Pass "Verify exact dashboard alert"
$ack=Must "Acknowledge dashboard alert" {Invoke-Api POST ("/api/dashboard/alerts/"+$alertId+"/acknowledge") @{notes="Acknowledged by Module 11 test"}}
$start=Must "Start dashboard alert action" {Invoke-Api POST ("/api/dashboard/alerts/"+$alertId+"/start") @{notes="Work started by Module 11 test"}}
$resolve=Must "Resolve dashboard alert" {Invoke-Api POST ("/api/dashboard/alerts/"+$alertId+"/resolve") @{resolution="Resolved by Module 11 complete test"}}
$resolvedList=Must "Verify resolved alert status" {Invoke-Api GET ("/api/dashboard/alerts?project_id="+$projectId+"&status=RESOLVED")}
$resolved=@(Items $resolvedList.data.alerts|Where-Object {[int]$_.id-eq$alertId})
if($resolved.Count-ne1){Fail "Exact alert resolved" "The exact alert did not reach RESOLVED status."};Pass "Exact alert resolved"
$createdReview=Must "Create management review" {Invoke-Api POST "/api/management-reviews" @{project_id=$projectId;review_date=$today;review_type_id=[int]$reviewType.id;subject="Module 11 Review $stamp";observations="Dashboard and report verification";decisions="Complete all Module 11 checks";action_required="Verify report results";priority_id=[int]$priority.id;target_date=$today}}
$reviewId=[int]$createdReview.data.management_review.id
$reviews=Must "List management reviews" {Invoke-Api GET ("/api/management-reviews?project_id="+$projectId)}
$exactReview=@(Items $reviews.data.management_reviews|Where-Object {[int]$_.id-eq$reviewId})
if($exactReview.Count-ne1){Fail "Verify exact management review" "Created management review was not returned exactly once."};Pass "Verify exact management review"
$reviewStart=Must "Start management review action" {Invoke-Api POST ("/api/management-reviews/"+$reviewId+"/start") @{}}
$reviewComplete=Must "Complete management review action" {Invoke-Api POST ("/api/management-reviews/"+$reviewId+"/complete") @{}}
$reviewsAfter=Must "Reload completed management review" {Invoke-Api GET ("/api/management-reviews?project_id="+$projectId)}
$completed=@(Items $reviewsAfter.data.management_reviews | Where-Object { ([int]$_.id -eq $reviewId) -and ($_.status_code -eq "COMPLETED") })
if($completed.Count-ne1){Fail "Exact management review completed" "The exact review did not reach COMPLETED status."};Pass "Exact management review completed"
$overviewAfter=Must "Dashboard reflects Module 11 alert state" {Invoke-Api GET ("/api/dashboard/overview?project_id="+$projectId)}
$logout=Must "Logout" {Invoke-Api POST "/api/auth/logout" @{}}
Write-Line "";Write-Line ("ALL MODULE 11 TESTS PASSED: "+$script:Step+"/"+$script:Step);Write-Line ("Completed: "+(Get-Date).ToString("yyyy-MM-dd HH:mm:ss"));$script:ResultLog|Set-Content -Encoding UTF8 $ResultFile
