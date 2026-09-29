param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$Email = "erp.dvn@gmail.com",
    [string]$Password = "CivilPro@12345"
)

$ErrorActionPreference = "Stop"
$ResultDirectory = Join-Path $PSScriptRoot "api-test-results"
$ResultFile = Join-Path $ResultDirectory "module12-complete-test-results.txt"
New-Item -ItemType Directory -Force -Path $ResultDirectory | Out-Null
$script:ResultLog = [System.Collections.Generic.List[string]]::new()
$script:Step = 0

function Add-Result([string]$Text) { [void]$script:ResultLog.Add($Text); Write-Host $Text }
function Pass([string]$Name) { $script:Step++; Add-Result ("PASS {0:D2} - {1}" -f $script:Step,$Name) }
function Fail([string]$Name,[string]$Details) { $script:Step++; Add-Result ("FAIL {0:D2} - {1}: {2}" -f $script:Step,$Name,$Details); throw $Details }
function Assert([bool]$Condition,[string]$Name,[string]$Details) { if($Condition){ Pass $Name }else{ Fail $Name $Details } }
function Api([string]$Method,[string]$Path,$Body=$null) {
    $args=@{Uri=($BaseUrl.TrimEnd('/')+$Path);Method=$Method;WebSession=$script:Session;ContentType='application/json';Headers=@{Accept='application/json'}}
    if($null -ne $Body){$args.Body=($Body|ConvertTo-Json -Depth 20 -Compress)}
    try{return Invoke-RestMethod @args}catch{ $details=$_.Exception.Message; if($_.ErrorDetails.Message){$details+=" | "+$_.ErrorDetails.Message}; throw $details }
}

Add-Result "Module 12 - Notifications, Audit & Final Testing"
Add-Result ("Started: "+(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Add-Result ""

try {
    $script:Session=New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $login=Api POST '/api/auth/login' @{email=$Email;password=$Password}
    Assert ($login.success -eq $true) 'Login' 'Login failed.'
    $me=Api GET '/api/auth/me'
    Assert ($me.success -eq $true) 'Authenticated user' 'Authenticated user endpoint failed.'

    $masters=Api GET '/api/system-admin/masters'
    Assert (($masters.data.masters.activity_statuses|Measure-Object).Count -ge 3) 'System administration masters' 'Activity status masters are incomplete.'
    Assert (($masters.data.masters.notification_events|Measure-Object).Count -gt 0) 'Notification event masters' 'No active notification events found.'

    $integrity=Api GET '/api/system-admin/integrity'
    Assert ($integrity.data.integrity.healthy -eq $true) 'System integrity' ('Integrity failed: '+($integrity.data.integrity|ConvertTo-Json -Compress))
    Assert ([int]$integrity.data.integrity.orphan_notifications -eq 0) 'Notification foreign-key integrity' 'Orphan notification records exist.'

    $summary=Api GET '/api/system-admin/notifications/summary'
    Assert ($summary.success -eq $true) 'Notification health summary' 'Notification summary failed.'
    Assert ($null -ne $summary.data.notification_summary.totals.total) 'Notification delivery totals' 'Notification totals are missing.'
    $allNotifications=Api GET '/api/system-admin/notifications'
    Assert ($allNotifications.success -eq $true) 'Notification administration list' 'Notification administration list failed.'
    $sentNotifications=Api GET '/api/system-admin/notifications?email_status=sent'
    $sentBad=@($sentNotifications.data.notifications|Where-Object{[int]$_.email_sent -ne 1})
    Assert ($sentBad.Count -eq 0) 'Sent-email filter' 'Sent-email filter returned unsent records.'
    $failedNotifications=Api GET '/api/system-admin/notifications?email_status=failed'
    $failedBad=@($failedNotifications.data.notifications|Where-Object{[int]$_.email_sent -ne 0 -or [string]::IsNullOrWhiteSpace([string]$_.email_error)})
    Assert ($failedBad.Count -eq 0) 'Failed-email visibility' 'Failed-email filter returned invalid records.'

    $token='M12_'+(Get-Date -Format 'yyyyMMddHHmmss')+'_'+(Get-Random -Minimum 100 -Maximum 999)
    $audit=Api POST '/api/system-admin/audit-logs' @{module_code='MODULE12';action_code='FINAL_TEST';entity_type='SYSTEM_CHECK';description=("Module 12 final test "+$token);status='SUCCESS';new_values=@{test_token=$token;verified=$true}}
    $auditId=[int]$audit.data.audit_log.id
    Assert ($auditId -gt 0) 'Create controlled audit event' 'Audit event ID was not returned.'
    $auditList=Api GET '/api/system-admin/audit-logs?module_code=MODULE12&action_code=FINAL_TEST&status=SUCCESS'
    $exact=@($auditList.data.audit_logs|Where-Object{[int]$_.id -eq $auditId})
    Assert ($exact.Count -eq 1) 'Filter exact audit event' 'New audit event not found in filtered trail.'
    $auditDetail=Api GET ("/api/system-admin/audit-logs/"+$auditId)
    Assert ($auditDetail.data.audit_log.new_values.test_token -eq $token) 'Audit before/after JSON detail' 'Audit JSON values were not preserved.'

    $loginHistory=Api GET '/api/system-admin/login-history'
    Assert (($loginHistory.data.login_history|Measure-Object).Count -gt 0) 'Login security history' 'No login history was returned.'
    $successfulLogins=Api GET '/api/system-admin/login-history?success=1'
    $loginBad=@($successfulLogins.data.login_history|Where-Object{[int]$_.success -ne 1})
    Assert ($loginBad.Count -eq 0) 'Successful-login filter' 'Login success filter returned failed attempts.'

    $inbox=Api GET '/api/notifications'
    Assert ($inbox.success -eq $true) 'User notification inbox' 'Notification inbox failed.'
    if(($inbox.data.notifications|Measure-Object).Count -gt 0){
        $notificationId=[int]$inbox.data.notifications[0].id
        $read=Api PATCH ("/api/notifications/"+$notificationId+"/read")
        Assert ([int]$read.data.notification.is_read -eq 1) 'Mark notification read' 'Notification was not marked read.'
    } else { Pass 'Mark notification read - no existing recipient notification' }
    $readAll=Api PATCH '/api/notifications/read-all'
    Assert ($readAll.success -eq $true) 'Mark all notifications read' 'Mark-all-read failed.'

    $finalIntegrity=Api GET '/api/system-admin/integrity'
    Assert ($finalIntegrity.data.integrity.healthy -eq $true) 'Final system integrity recheck' 'Final integrity recheck failed.'
    $logout=Api POST '/api/auth/logout'
    Assert ($logout.success -eq $true) 'Logout' 'Logout failed.'
    Add-Result ""
    Add-Result ("COMPLETED: {0} tests passed." -f $script:Step)
} catch {
    Add-Result ""
    Add-Result ("STOPPED: "+$_.Exception.Message)
    $script:ResultLog | Set-Content -Path $ResultFile -Encoding UTF8
    Write-Host ("Result: "+$ResultFile)
    exit 1
}

$script:ResultLog | Set-Content -Path $ResultFile -Encoding UTF8
Write-Host ("Result: "+$ResultFile)
