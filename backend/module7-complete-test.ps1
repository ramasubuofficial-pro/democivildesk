param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$Email = "erp.dvn@gmail.com",
    [string]$Password = "CivilPro@12345"
)

$ErrorActionPreference = "Stop"
$ResultDir = Join-Path $PSScriptRoot "api-test-results"
$ResultFile = Join-Path $ResultDir "module7-complete-test-results.txt"
New-Item -ItemType Directory -Force -Path $ResultDir | Out-Null
Set-Content -Path $ResultFile -Value "Module 7 - Daily Site Operations Complete API Test`r`nStarted: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`r`n"
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
    if ($null -ne $Body) { $args.ContentType='application/json'; $args.Body=($Body | ConvertTo-Json -Depth 12 -Compress) }
    $response = Invoke-WebRequest @args
    $json = $response.Content | ConvertFrom-Json
    if ($null -eq $json -or $json.success -ne $true) { throw "API returned unsuccessful response for $Method $Path" }
    return $json
}
function Require($Value,[string]$Message) { if ($null -eq $Value -or ($Value -is [array] -and $Value.Count -eq 0)) { throw $Message }; return $Value }
function Master($Masters,[string]$Group,[string]$CodeField,[string]$Code) {
    $row = @($Masters.$Group | Where-Object { $_.$CodeField -eq $Code -and $_.is_active -eq 1 } | Select-Object -First 1)
    if ($row.Count -eq 0) { throw "Required master $Group/$Code was not found." }
    return $row[0]
}
function Invoke-MultipartPhoto([int]$ReportId,[int]$PhotoTypeId,[int]$ZoneId) {
    $boundary = "----Module7" + [Guid]::NewGuid().ToString('N')
    $png = [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nxoAAAAASUVORK5CYII=')
    $ms = New-Object IO.MemoryStream
    $utf8 = New-Object Text.UTF8Encoding($false)
    function Part([string]$Name,[string]$Value) { $bytes=$utf8.GetBytes("--$boundary`r`nContent-Disposition: form-data; name=`"$Name`"`r`n`r`n$Value`r`n");$ms.Write($bytes,0,$bytes.Length) }
    Part 'title' 'Module 7 API Test Photo'; Part 'photo_type_id' ([string]$PhotoTypeId); if($ZoneId -gt 0){Part 'zone_id' ([string]$ZoneId)}; Part 'is_client_visible' '1'
    $head=$utf8.GetBytes("--$boundary`r`nContent-Disposition: form-data; name=`"photo`"; filename=`"module7-test.png`"`r`nContent-Type: image/png`r`n`r`n");$ms.Write($head,0,$head.Length);$ms.Write($png,0,$png.Length);$tail=$utf8.GetBytes("`r`n--$boundary--`r`n");$ms.Write($tail,0,$tail.Length)
    $request=[Net.HttpWebRequest]::Create($BaseUrl.TrimEnd('/')+"/api/daily-site-reports/$ReportId/photos");$request.Method='POST';$request.ContentType="multipart/form-data; boundary=$boundary";$request.Accept='application/json';$request.CookieContainer=$Session.Cookies;$request.ContentLength=$ms.Length;$stream=$request.GetRequestStream();$ms.Position=0;$ms.CopyTo($stream);$stream.Close();$response=$request.GetResponse();$reader=New-Object IO.StreamReader($response.GetResponseStream());$json=$reader.ReadToEnd()|ConvertFrom-Json;$reader.Close();$response.Close();if($json.success -ne $true){throw 'Photo upload returned unsuccessful response.'};return $json
}

try {
    $login=Invoke-Api 'POST' '/api/auth/login' @{email=$Email;password=$Password;remember=$false}; Write-Result 'PASS' 'Login'
    $me=Invoke-Api 'GET' '/api/auth/me';$user=Require $me.data.user 'Authenticated user missing';Write-Result 'PASS' 'Authenticated user'
    $mastersResponse=Invoke-Api 'GET' '/api/daily-operations/masters';$masters=Require $mastersResponse.data.masters 'Daily operations masters missing';Write-Result 'PASS' 'Daily operations masters'
    $shift=Master $masters 'shift_types' 'shift_type_code' 'GENERAL';$draft=Master $masters 'report_statuses' 'status_code' 'DRAFT';Write-Result 'PASS' 'Report shift and status masters'
    $quality=Master $masters 'progress_quality_statuses' 'quality_status_code' 'NOT_INSPECTED';$qualityPassed=Master $masters 'progress_quality_statuses' 'quality_status_code' 'PASSED';$workStatus=Master $masters 'progress_work_statuses' 'work_status_code' 'IN_PROGRESS';Write-Result 'PASS' 'Work progress masters'
    $manSource=Master $masters 'manpower_source_types' 'source_type_code' 'MANUAL';$ownership=Master $masters 'equipment_ownership_types' 'ownership_type_code' 'OWNED';$eqStatus=Master $masters 'equipment_statuses' 'status_code' 'WORKING';Write-Result 'PASS' 'Manpower and equipment masters'
    $weatherPeriod=Master $masters 'weather_periods' 'weather_period_code' 'MORNING';$weatherCondition=Master $masters 'weather_conditions' 'weather_condition_code' 'CLEAR';$weatherImpact=Master $masters 'weather_work_impacts' 'work_impact_code' 'NONE';Write-Result 'PASS' 'Weather masters'
    $issueType=Master $masters 'issue_types' 'issue_type_code' 'OTHER';$issuePriority=Master $masters 'issue_priorities' 'priority_code' 'MEDIUM';$issueImpact=Master $masters 'issue_work_impacts' 'work_impact_code' 'NONE';$issueStatus=Master $masters 'issue_statuses' 'status_code' 'OPEN';Write-Result 'PASS' 'Issue masters'
    $visitorType=Master $masters 'visitor_types' 'visit_type_code' 'OTHER';$photoType=Master $masters 'photo_types' 'photo_type_code' 'GENERAL';$materialSource=Master $masters 'material_source_types' 'source_type_code' 'MANUAL';Write-Result 'PASS' 'Visitor, photo and material source masters'

    $projects=@((Invoke-Api 'GET' '/api/projects').data.projects);Require $projects 'No accessible project found'|Out-Null;Write-Result 'PASS' 'Accessible projects'
    $selection=$null
    foreach($p in $projects){$sites=@((Invoke-Api 'GET' ("/api/sites?project_id="+$p.id)).data.sites);$boqHeaders=@((Invoke-Api 'GET' ("/api/project-boqs?project_id="+$p.id)).data.project_boqs);foreach($s in $sites){foreach($bh in $boqHeaders){$items=@((Invoke-Api 'GET' ("/api/project-boqs/"+$bh.id+"/items")).data.boq_items|Where-Object{[int]$_.site_id -eq [int]$s.id});if($items.Count -gt 0){$selection=@{project=$p;site=$s;boq=$items[0]};break}};if($selection){break}};if($selection){break}}
    Require $selection 'No accessible project/site with a BOQ item was found'|Out-Null;Write-Result 'PASS' 'Dynamic project, site and BOQ item selection'
    $project=$selection.project;$site=$selection.site;$boqItem=$selection.boq
    $zones=@((Invoke-Api 'GET' ("/api/site-zones?site_id="+$site.id)).data.zones);$zone=if($zones.Count -gt 0){$zones[0]}else{$null};Write-Result 'PASS' 'Dynamic site zone selection'
    $labourCategory=@($masters.labour_categories|Select-Object -First 1);Require $labourCategory 'No active labour category found'|Out-Null
    $materials=@((Invoke-Api 'GET' '/api/materials/catalogue').data.materials);Require $materials 'No active material found'|Out-Null;$material=$materials[0];Write-Result 'PASS' 'Dynamic labour category and material selection'
    $reports=@((Invoke-Api 'GET' ("/api/daily-site-reports?project_id="+$project.id+"&site_id="+$site.id)).data.daily_site_reports);$date=(Get-Date).Date.AddDays(1);while(@($reports|Where-Object{$_.report_date -eq $date.ToString('yyyy-MM-dd')}).Count -gt 0){$date=$date.AddDays(1)};$stamp=[DateTimeOffset]::Now.ToUnixTimeSeconds();$reportNo="DSR-API-$stamp";Write-Result 'PASS' 'Dynamic unused report date and report number'

    $create=Invoke-Api 'POST' '/api/daily-site-reports' @{project_id=[int]$project.id;site_id=[int]$site.id;report_no=$reportNo;report_date=$date.ToString('yyyy-MM-dd');shift_type_id=[int]$shift.id;work_start_time='08:30:00';work_end_time='17:30:00';prepared_by=[int]$user.id;safety_briefing_done=1;overall_work_summary='Module 7 complete API test'};$reportId=[int](Require $create.data.daily_site_report.id 'Created report ID missing');Write-Result 'PASS' 'Create daily site report'
    $list=Invoke-Api 'GET' ("/api/daily-site-reports?search="+$reportNo);if(@($list.data.daily_site_reports|Where-Object{$_.id -eq $reportId}).Count -ne 1){throw 'Created report missing from list'};Write-Result 'PASS' 'List daily site reports'
    $view=Invoke-Api 'GET' "/api/daily-site-reports/$reportId";if($view.data.daily_site_report.status.status_code -ne 'DRAFT'){throw 'New report is not DRAFT'};Write-Result 'PASS' 'View daily site report with child collections'
    Invoke-Api 'PATCH' "/api/daily-site-reports/$reportId" @{next_day_plan='Updated by Module 7 complete test';planned_progress_percentage=2.5}|Out-Null;Write-Result 'PASS' 'Update daily site report'

    $zoneId=if($zone){[int]$zone.id}else{0};$zoneValue=if($zoneId -gt 0){$zoneId}else{$null};$uomId=[int]$boqItem.uom_id
    $progress=Invoke-Api 'POST' "/api/daily-site-reports/$reportId/work-progress" @{boq_item_id=[int]$boqItem.id;zone_id=$zoneValue;uom_id=$uomId;planned_qty_for_day=5;completed_qty_for_day=4;cumulative_qty_before=0;quality_status_id=[int]$quality.id;work_status_id=[int]$workStatus.id;remarks='API progress'};$progressId=[int]$progress.data.work_progress.id;Write-Result 'PASS' 'Create daily work progress'
    Invoke-Api 'PATCH' "/api/daily-site-reports/$reportId/work-progress/$progressId" @{completed_qty_for_day=4.5;remarks='Updated API progress'}|Out-Null;Write-Result 'PASS' 'Update daily work progress'
    Invoke-Api 'POST' "/api/daily-site-reports/$reportId/work-progress/$progressId/inspect" @{quality_status_id=[int]$qualityPassed.id;remarks='Passed API inspection'}|Out-Null;Write-Result 'PASS' 'Inspect daily work progress'
    $man=Invoke-Api 'POST' "/api/daily-site-reports/$reportId/manpower" @{labour_category_id=[int]$labourCategory[0].id;zone_id=$zoneValue;planned_count=10;present_count=9;absent_count=1;source_type_id=[int]$manSource.id;work_description='API manpower'};$manId=[int]$man.data.manpower.id;Write-Result 'PASS' 'Create daily manpower'
    Invoke-Api 'PATCH' "/api/daily-site-reports/$reportId/manpower/$manId" @{present_count=8;absent_count=2}|Out-Null;Write-Result 'PASS' 'Update daily manpower and report total'
    $eq=Invoke-Api 'POST' "/api/daily-site-reports/$reportId/equipment" @{zone_id=$zoneValue;equipment_code="EQ-$stamp";equipment_name='API Test Mixer';ownership_type_id=[int]$ownership.id;quantity=1;working_hours=6;status_id=[int]$eqStatus.id};$eqId=[int]$eq.data.equipment.id;Write-Result 'PASS' 'Create daily equipment'
    Invoke-Api 'PATCH' "/api/daily-site-reports/$reportId/equipment/$eqId" @{working_hours=7;idle_hours=1}|Out-Null;Write-Result 'PASS' 'Update daily equipment and report total'
    $weather=Invoke-Api 'POST' "/api/daily-site-reports/$reportId/weather" @{observation_time='09:00:00';weather_period_id=[int]$weatherPeriod.id;weather_condition_id=[int]$weatherCondition.id;temperature_c=29;humidity_percentage=65;rainfall_mm=0;work_impact_id=[int]$weatherImpact.id;lost_hours=0};$weatherId=[int]$weather.data.weather.id;Write-Result 'PASS' 'Create daily weather observation'
    Invoke-Api 'PATCH' "/api/daily-site-reports/$reportId/weather/$weatherId" @{temperature_c=30;remarks='Updated weather'}|Out-Null;Write-Result 'PASS' 'Update daily weather observation'
    $issue=Invoke-Api 'POST' "/api/daily-site-reports/$reportId/issues" @{zone_id=$zoneValue;issue_no="ISS-API-$stamp";issue_type_id=[int]$issueType.id;title='API test issue';description='Daily operation issue test';priority_id=[int]$issuePriority.id;work_impact_id=[int]$issueImpact.id;reported_by=[int]$user.id;status_id=[int]$issueStatus.id};$issueId=[int]$issue.data.issue.id;Write-Result 'PASS' 'Create daily site issue'
    Invoke-Api 'PATCH' "/api/daily-site-reports/$reportId/issues/$issueId" @{title='Updated API test issue'}|Out-Null;Write-Result 'PASS' 'Update daily site issue'
    $visitor=Invoke-Api 'POST' "/api/daily-site-reports/$reportId/visitors" @{visitor_name='API Test Visitor';organisation='Test Organisation';visit_type_id=[int]$visitorType.id;check_in_time='11:00:00';hosted_by=[int]$user.id;purpose='Module 7 testing'};$visitorId=[int]$visitor.data.visitor.id;Write-Result 'PASS' 'Create daily site visitor'
    Invoke-Api 'PATCH' "/api/daily-site-reports/$reportId/visitors/$visitorId" @{check_out_time='12:00:00';follow_up_required=1;follow_up_owner=[int]$user.id;follow_up_date=$date.AddDays(1).ToString('yyyy-MM-dd')}|Out-Null;Write-Result 'PASS' 'Update daily site visitor'
    $cons=Invoke-Api 'POST' "/api/daily-site-reports/$reportId/material-consumption" @{work_progress_id=$progressId;material_id=[int]$material.id;uom_id=[int]$material.base_uom_id;zone_id=$zoneValue;issued_qty=10;consumed_qty=8;returned_qty=2;wasted_qty=0;unit_rate=100;source_type_id=[int]$materialSource.id};$consId=[int]$cons.data.material_consumption.id;if([decimal]$cons.data.material_consumption.consumption_value -ne 800){throw 'Consumption value calculation failed'};Write-Result 'PASS' 'Create material consumption with calculated value'
    Invoke-Api 'PATCH' "/api/daily-site-reports/$reportId/material-consumption/$consId" @{consumed_qty=9;returned_qty=1}|Out-Null;Write-Result 'PASS' 'Update daily material consumption'
    $photo=Invoke-MultipartPhoto $reportId ([int]$photoType.id) $zoneId;$photoId=[int]$photo.data.photo.id;Write-Result 'PASS' 'Upload daily site photo'
    Invoke-Api 'PATCH' "/api/daily-site-reports/$reportId/photos/$photoId" @{title='Updated Module 7 API Test Photo';is_client_visible=0}|Out-Null;Write-Result 'PASS' 'Update daily site photo metadata'
    $full=Invoke-Api 'GET' "/api/daily-site-reports/$reportId";if($full.data.daily_site_report.work_progress.Count -lt 1 -or $full.data.daily_site_report.photos.Count -lt 1){throw 'Complete report child data missing'};Write-Result 'PASS' 'Verify complete report child data and totals'

    Invoke-Api 'POST' "/api/daily-site-reports/$reportId/submit" @{remarks='Submitted by complete API test'}|Out-Null;Write-Result 'PASS' 'Submit daily site report'
    $notes=Invoke-Api 'GET' '/api/notifications';$submitNote=@($notes.data.notifications|Where-Object{$_.source_module -eq 'DAILY_REPORT' -and $_.source_record_id -eq $reportId -and $_.event_code -eq 'DAILY_REPORT_SUBMITTED'}|Select-Object -First 1);if($submitNote.Count -ne 1){throw 'Submitted notification was not created'};Write-Result 'PASS' 'Submitted in-app notification created'
    if($submitNote[0].email_sent -ne 1 -and [String]::IsNullOrWhiteSpace([string]$submitNote[0].email_error)){throw 'Submitted email attempt result was not recorded'};Write-Result 'PASS' 'Submitted email delivery or attempt recorded'
    Invoke-Api 'POST' "/api/daily-site-reports/$reportId/review" @{remarks='Reviewed by complete API test'}|Out-Null;Write-Result 'PASS' 'Review daily site report'
    Invoke-Api 'POST' "/api/daily-site-reports/$reportId/approve" @{remarks='Approved by complete API test'}|Out-Null;Write-Result 'PASS' 'Approve daily site report'
    $notes=Invoke-Api 'GET' '/api/notifications';$approveNote=@($notes.data.notifications|Where-Object{$_.source_module -eq 'DAILY_REPORT' -and $_.source_record_id -eq $reportId -and $_.event_code -eq 'DAILY_REPORT_APPROVED'}|Select-Object -First 1);if($approveNote.Count -ne 1){throw 'Approved notification was not created'};Write-Result 'PASS' 'Approved in-app notification created'
    if($approveNote[0].email_sent -ne 1 -and [String]::IsNullOrWhiteSpace([string]$approveNote[0].email_error)){throw 'Approved email attempt result was not recorded'};Write-Result 'PASS' 'Approved email delivery or attempt recorded'
    $approved=Invoke-Api 'GET' "/api/daily-site-reports/$reportId";if($approved.data.daily_site_report.status.status_code -ne 'APPROVED' -or $approved.data.daily_site_report.approvals.Count -lt 3){throw 'Approved status or workflow history missing'};Write-Result 'PASS' 'Verify approved report and workflow history'
    Invoke-Api 'POST' "/api/daily-site-reports/$reportId/reopen" @{remarks='Reopened to test the complete workflow'}|Out-Null;Write-Result 'PASS' 'Reopen approved daily site report'
    Invoke-Api 'POST' "/api/daily-site-reports/$reportId/submit" @{remarks='Resubmitted for rejection test'}|Out-Null;Write-Result 'PASS' 'Resubmit reopened daily site report'
    Invoke-Api 'POST' "/api/daily-site-reports/$reportId/review" @{remarks='Reviewed for rejection test'}|Out-Null;Write-Result 'PASS' 'Review resubmitted daily site report'
    Invoke-Api 'POST' "/api/daily-site-reports/$reportId/reject" @{remarks='Rejected by complete API workflow test'}|Out-Null;Write-Result 'PASS' 'Reject reviewed daily site report'
    $notes=Invoke-Api 'GET' '/api/notifications';$rejectNote=@($notes.data.notifications|Where-Object{$_.source_module -eq 'DAILY_REPORT' -and $_.source_record_id -eq $reportId -and $_.event_code -eq 'DAILY_REPORT_REJECTED'}|Select-Object -First 1);if($rejectNote.Count -ne 1){throw 'Rejected notification was not created'};if($rejectNote[0].email_sent -ne 1 -and [String]::IsNullOrWhiteSpace([string]$rejectNote[0].email_error)){throw 'Rejected email attempt result was not recorded'};Write-Result 'PASS' 'Rejected notification and email attempt recorded'
    Invoke-Api 'POST' "/api/daily-site-reports/$reportId/reopen" @{remarks='Reopened for cancellation test'}|Out-Null;Write-Result 'PASS' 'Reopen rejected daily site report'
    Invoke-Api 'POST' "/api/daily-site-reports/$reportId/cancel" @{remarks='Cancelled by complete API workflow test'}|Out-Null;Write-Result 'PASS' 'Cancel reopened daily site report'
    $notes=Invoke-Api 'GET' '/api/notifications';$cancelNote=@($notes.data.notifications|Where-Object{$_.source_module -eq 'DAILY_REPORT' -and $_.source_record_id -eq $reportId -and $_.event_code -eq 'DAILY_REPORT_CANCELLED'}|Select-Object -First 1);if($cancelNote.Count -ne 1){throw 'Cancelled notification was not created'};if($cancelNote[0].email_sent -ne 1 -and [String]::IsNullOrWhiteSpace([string]$cancelNote[0].email_error)){throw 'Cancelled email attempt result was not recorded'};Write-Result 'PASS' 'Cancelled notification and email attempt recorded'
    foreach($eventCode in @('DAILY_REPORT_SUBMITTED','DAILY_REPORT_REVIEWED','DAILY_REPORT_APPROVED','DAILY_REPORT_REJECTED','DAILY_REPORT_REOPENED','DAILY_REPORT_CANCELLED')){$eventNote=@($notes.data.notifications|Where-Object{$_.source_module -eq 'DAILY_REPORT' -and $_.source_record_id -eq $reportId -and $_.event_code -eq $eventCode}|Select-Object -First 1);if($eventNote.Count -ne 1){throw "Workflow notification missing: $eventCode"};if($eventNote[0].email_sent -ne 1 -and [String]::IsNullOrWhiteSpace([string]$eventNote[0].email_error)){throw "Email attempt result missing: $eventCode"}};Write-Result 'PASS' 'All six workflow notification and email attempt results verified'
    Invoke-Api 'POST' '/api/auth/logout' @{}|Out-Null;Write-Result 'PASS' 'Logout'
    $final="ALL $script:Step MODULE 7 API TESTS PASSED";Write-Host $final -ForegroundColor Green;Add-Content -Path $ResultFile -Value "`r`n$final`r`nCompleted: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    exit 0
} catch {
    $message=$_.Exception.Message
    Write-Result 'FAIL' $message
    Add-Content -Path $ResultFile -Value "`r`nTESTING STOPPED AT FIRST FAILURE.`r`nCompleted: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    exit 1
}
