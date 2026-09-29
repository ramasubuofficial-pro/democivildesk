param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$Email = "erp.dvn@gmail.com",
    [string]$Password = "CivilPro@12345"
)
$ErrorActionPreference = 'Stop'
$Result = Join-Path $PSScriptRoot 'api-test-results\module8-complete-test-results.txt'
New-Item -ItemType Directory -Force (Split-Path $Result) | Out-Null
Set-Content $Result ("Module 8 - Subcontract Management Complete API Test`r`nStarted: " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + "`r`n")
$script:N=0; $script:Session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
function Pass([string]$m){$script:N++;$x=('PASS {0:D2} - {1}' -f $script:N,$m);Add-Content $Result $x;Write-Host $x -ForegroundColor Green}
function Fail([string]$m,[object]$e){$script:N++;$x=('FAIL {0:D2} - {1}: {2}' -f $script:N,$m,$e);Add-Content $Result $x;Write-Host $x -ForegroundColor Red;exit 1}
function Api([string]$Method,[string]$Path,[object]$Body=$null){$p=@{Method=$Method;Uri=($BaseUrl.TrimEnd('/')+$Path);WebSession=$script:Session;ContentType='application/json'};if($null-ne$Body){$p.Body=($Body|ConvertTo-Json -Depth 12 -Compress)};Invoke-RestMethod @p}
function Test([string]$Name,[scriptblock]$Run){try{$v=&$Run;if($null-eq$v-or($v.PSObject.Properties.Name-contains'success'-and-not$v.success)){throw ($v.message|Out-String)};Pass $Name;return $v}catch{Fail $Name $_.Exception.Message}}
$login=Test 'Login' {Api POST '/api/auth/login' @{email=$Email;password=$Password;remember=$false}}
Test 'Authenticated user' {Api GET '/api/auth/me'}|Out-Null
$masters=Test 'Subcontract masters' {Api GET '/api/subcontracts/masters'}
$projects=Test 'Accessible projects' {Api GET '/api/projects'}
$p=$null;$bh=$null;$b=$null
foreach($candidateProject in @($projects.data.projects|Where-Object{$_.id})){
    $candidateHeaders=Api GET ("/api/project-boqs?project_id="+$candidateProject.id)
    foreach($candidateHeader in @($candidateHeaders.data.project_boqs|Where-Object{$_.id})){
        $candidateItems=Api GET ("/api/project-boqs/"+$candidateHeader.id+"/items")
        $candidateItem=@($candidateItems.data.boq_items|Where-Object{$_.id -and $_.site_id -and $_.work_zone_id})[0]
        if($candidateItem){$p=$candidateProject;$bh=$candidateHeader;$b=$candidateItem;break}
    }
    if($b){break}
}
if(!$p){Fail 'Dynamic project selection' 'No accessible project with a site- and zone-linked BOQ item'}else{Pass 'Dynamic project selection'}
$sites=Api GET ("/api/sites?project_id="+$p.id);$s=@($sites.data.sites|Where-Object{[int]$_.id-eq[int]$b.site_id})[0];if(!$s){Fail 'Dynamic site selection' ("BOQ item site "+$b.site_id+" is unavailable")}else{Pass 'Dynamic site selection'}
$zones=Api GET ("/api/site-zones?site_id="+$s.id);$z=@($zones.data.zones|Where-Object{[int]$_.id-eq[int]$b.work_zone_id})[0];if(!$z){Fail 'Dynamic zone selection' ("BOQ item zone "+$b.work_zone_id+" is unavailable")}else{Pass 'Dynamic zone selection'}
if(!$bh){Fail 'Dynamic BOQ header selection' 'No BOQ header containing a usable item'}else{Pass 'Dynamic BOQ header selection'}
if(!$b){Fail 'Dynamic BOQ selection' 'No site- and zone-linked BOQ item'}else{Pass 'Dynamic BOQ selection'}
$uom=$b.uom_id;if(!$uom){$uom=@($masters.data.masters.units)[0].id}
$stamp=[DateTimeOffset]::Now.ToUnixTimeSeconds();$ct=@($masters.data.masters.contractor_types)[0];$cs=@($masters.data.masters.contractor_statuses|Where-Object{$_.status_code-eq'ACTIVE'})[0]
$contractor=Test 'Create subcontractor' {Api POST '/api/subcontracts/contractors' @{contractor_code="SC_$stamp";contractor_name="Module 8 Contractor $stamp";contractor_type_id=$ct.id;status_id=$cs.id;email=$Email}}
$cid=$contractor.data.subcontractor.id
Test 'List subcontractors' {Api GET '/api/subcontracts/contractors'}|Out-Null
Test 'View subcontractor' {Api GET "/api/subcontracts/contractors/$cid"}|Out-Null
Test 'Update subcontractor' {Api PATCH "/api/subcontracts/contractors/$cid" @{notes='Module 8 complete test'}}|Out-Null
$doc=Test 'Create subcontractor document' {Api POST "/api/subcontracts/contractors/$cid/documents" @{document_name='Test compliance document';file_name='test.pdf';file_path='uploads/test.pdf'}};$did=$doc.data.document.id
Test 'Verify subcontractor document' {Api POST "/api/subcontracts/contractors/$cid/documents/$did/verify" @{status_code='VERIFIED'}}|Out-Null
$wo=Test 'Create work order' {Api POST '/api/subcontracts/work-orders' @{project_id=$p.id;site_id=$s.id;work_zone_id=$z.id;contractor_id=$cid;work_order_no="SWO_$stamp";work_order_date=(Get-Date -Format yyyy-MM-dd);scope_of_work='Module 8 API test work'}};$wid=$wo.data.work_order.id
$item=Test 'Add work order item' {Api POST "/api/subcontracts/work-orders/$wid/items" @{boq_item_id=$b.id;uom_id=$uom;item_code="ITEM_$stamp";description='API test BOQ work';ordered_quantity=10;rate=1000;tax_percent=18}};$wi=$item.data.item.id
Test 'View calculated work order' {Api GET "/api/subcontracts/work-orders/$wid"}|Out-Null
Test 'Submit work order' {Api POST "/api/subcontracts/work-orders/$wid/submit" @{}}|Out-Null
Test 'Approve work order' {Api POST "/api/subcontracts/work-orders/$wid/approve" @{}}|Out-Null
Test 'Activate work order' {Api POST "/api/subcontracts/work-orders/$wid/activate" @{}}|Out-Null
$m=Test 'Create measurement' {Api POST '/api/subcontracts/measurements' @{project_id=$p.id;work_order_id=$wid;site_id=$s.id;work_zone_id=$z.id;measurement_no="MB_$stamp";measurement_date=(Get-Date -Format yyyy-MM-dd)}};$mid=$m.data.measurement.id
Test 'Add measurement line' {Api POST "/api/subcontracts/measurements/$mid/items" @{work_order_item_id=$wi;description='Measured work';measured_quantity=2;accepted_quantity=2;rate=1000}}|Out-Null
Test 'Submit measurement' {Api POST "/api/subcontracts/measurements/$mid/submit" @{}}|Out-Null
Test 'Verify measurement' {Api POST "/api/subcontracts/measurements/$mid/verify" @{}}|Out-Null
Test 'Approve measurement' {Api POST "/api/subcontracts/measurements/$mid/approve" @{}}|Out-Null
$bill=Test 'Create RA bill' {Api POST '/api/subcontracts/ra-bills' @{project_id=$p.id;work_order_id=$wid;contractor_id=$cid;ra_bill_no="RA_$stamp";bill_date=(Get-Date -Format yyyy-MM-dd)}};$bid=$bill.data.ra_bill.id
Test 'Add RA bill item' {Api POST "/api/subcontracts/ra-bills/$bid/items" @{work_order_item_id=$wi;description='Certified work';current_quantity=2;rate=1000}}|Out-Null
Test 'Submit RA bill' {Api POST "/api/subcontracts/ra-bills/$bid/submit" @{}}|Out-Null
Test 'Verify RA bill' {Api POST "/api/subcontracts/ra-bills/$bid/verify" @{}}|Out-Null
Test 'Approve RA bill' {Api POST "/api/subcontracts/ra-bills/$bid/approve" @{}}|Out-Null
Test 'Certify RA bill' {Api POST "/api/subcontracts/ra-bills/$bid/certify" @{}}|Out-Null
$pm=@($masters.data.masters.payment_modes)[0]
$pay=Test 'Create payment' {Api POST '/api/subcontracts/payments' @{project_id=$p.id;ra_bill_id=$bid;contractor_id=$cid;payment_no="PAY_$stamp";payment_date=(Get-Date -Format yyyy-MM-dd);payment_mode_id=$pm.id;amount=1000}};$payid=$pay.data.payment.id
Test 'Submit payment' {Api POST "/api/subcontracts/payments/$payid/submit" @{}}|Out-Null
Test 'Approve payment' {Api POST "/api/subcontracts/payments/$payid/approve" @{}}|Out-Null
Test 'Mark payment paid' {Api POST "/api/subcontracts/payments/$payid/mark-paid" @{}}|Out-Null
Test 'Module 5 and Module 7 supported integrations' {Api GET "/api/subcontracts/work-orders/$wid/integrations"}|Out-Null
$notes=Test 'Applicable in-app notifications' {Api GET '/api/notifications'}
$related=@($notes.data.notifications|Where-Object{$_.source_record_id-in@($wid,$mid,$bid,$payid)-and$_.source_module-like'SUBCONTRACT*'});if(!$related){Fail 'Notification records' 'No Module 8 notifications found'}else{Pass 'Notification records'}
$attempt=@($related|Where-Object{$_.email_sent-eq1-or![string]::IsNullOrWhiteSpace($_.email_error)});if(!$attempt){Fail 'Email delivery or attempt records' 'No email result recorded'}else{Pass 'Email delivery or attempt records'}
Test 'Logout' {Api POST '/api/auth/logout' @{}}|Out-Null
Add-Content $Result ("`r`nALL MODULE 8 TESTS PASSED: $script:N/$script:N`r`nCompleted: "+(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Write-Host "ALL MODULE 8 TESTS PASSED: $script:N/$script:N" -ForegroundColor Cyan
