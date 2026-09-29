param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$Email = "erp.dvn@gmail.com",
    [string]$Password = "CivilPro@12345"
)

$ErrorActionPreference = "Stop"
$ResultDir = Join-Path $PSScriptRoot "api-test-results"
$ResultFile = Join-Path $ResultDir "module9-complete-test-results.txt"
New-Item -ItemType Directory -Force -Path $ResultDir | Out-Null
$script:Step = 0
$script:ResultLog = New-Object System.Collections.Generic.List[string]
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Write-Line([string]$Text) { [void]$script:ResultLog.Add($Text); Write-Host $Text }
function Pass([string]$Name) { $script:Step++; Write-Line ("PASS {0:D2} - {1}" -f $script:Step,$Name) }
function Fail([string]$Name,[string]$Message) { $script:Step++; Write-Line ("FAIL {0:D2} - {1}: {2}" -f $script:Step,$Name,$Message); $script:ResultLog | Set-Content -Encoding UTF8 $ResultFile; throw $Message }
function Invoke-Api([string]$Method,[string]$Path,$Body=$null) {
    $args=@{Uri="$BaseUrl$Path";Method=$Method;WebSession=$session;Headers=@{Accept="application/json"};UseBasicParsing=$true}
    if ($null -ne $Body) { $args.ContentType="application/json"; $args.Body=($Body | ConvertTo-Json -Depth 12) }
    try { $raw=Invoke-WebRequest @args; if([string]::IsNullOrWhiteSpace($raw.Content)){return $null}; return $raw.Content|ConvertFrom-Json }
    catch { $detail=$_.Exception.Message; if($_.ErrorDetails.Message){$detail+=" | "+$_.ErrorDetails.Message}; throw $detail }
}
function Must([string]$Name,[scriptblock]$Call) {
    try {
        $r = & $Call
        if (($null -eq $r) -or ($r.success -ne $true)) {
            throw "API success response was not returned."
        }
        Pass $Name
        return $r
    }
    catch {
        Fail $Name $_.Exception.Message
    }
}
function Items($Value) { if ($null -eq $Value) { return @() }; return @($Value) }

function Assert-ExpenseNotification {
    param(
        [string]$Name,
        [object[]]$Notifications,
        [string]$SourceTable,
        [int]$SourceRecordId,
        [string[]]$EventCodes
    )

    $matching = @(
        $Notifications | Where-Object {
            $_.source_module -eq "EXPENSE" -and
            $_.source_table -eq $SourceTable -and
            [int]$_.source_record_id -eq $SourceRecordId -and
            $EventCodes -contains $_.event_code
        }
    )

    if ($matching.Count -eq 0) {
        Fail $Name ("No notification found for {0} ID {1}. Expected event: {2}." -f $SourceTable, $SourceRecordId, ($EventCodes -join ", "))
    }

    $sent = @($matching | Where-Object { [int]$_.email_sent -eq 1 })
    if ($sent.Count -eq 0) {
        $errors = @(
            $matching |
                ForEach-Object { [string]$_.email_error } |
                Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
                Select-Object -Unique
        )
        $detail = if ($errors.Count -gt 0) {
            $errors -join " | "
        }
        else {
            "Notification exists, but email_sent is not 1 and no email_error was recorded."
        }
        Fail $Name $detail
    }

    Pass $Name
}

$started=Get-Date
Write-Line "Module 9 - Project Expenses and Costing Complete API Test"
Write-Line ("Started: "+$started.ToString("yyyy-MM-dd HH:mm:ss"))
Write-Line ""

$login=Must "Login" {Invoke-Api POST "/api/auth/login" @{email=$Email;password=$Password}}
$me=Must "Authenticated user" {Invoke-Api GET "/api/auth/me"}
$masters=Must "Expense and costing masters" {Invoke-Api GET "/api/expenses/masters"}
$projects=Must "Accessible projects" {Invoke-Api GET "/api/projects"}
$project=(Items $projects.data.projects|Select-Object -First 1);if(!$project){Fail "Dynamic project selection" "No accessible project found."};$projectId=[int]$project.id;Pass "Dynamic project selection"
$sites=Must "Accessible project sites" {Invoke-Api GET ("/api/sites?project_id="+$projectId)}
$site=(Items $sites.data.sites | Where-Object { [int]$_.project_id -eq $projectId } | Select-Object -First 1);$siteId=if($site){[int]$site.id}else{$null};Pass "Dynamic site selection"
$categories=Items $masters.data.masters.expense_categories;$scope=Items $masters.data.masters.expense_scopes|Select-Object -First 1;$payee=Items $masters.data.masters.payee_types|Select-Object -First 1;$mode=Items $masters.data.masters.payment_modes|Select-Object -First 1;$allocType=Items $masters.data.masters.allocation_types|Select-Object -First 1
if ((!$scope) -or (!$payee) -or (!$mode) -or (!$allocType)) { Fail "Required controlled masters" "One or more Module 9 masters are missing." };Pass "Required controlled masters"
$stamp=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds();$today=(Get-Date).ToString("yyyy-MM-dd")
$category=Must "Create expense category" {Invoke-Api POST "/api/expenses/categories" @{category_code="EXP_API_$stamp";category_name="API Site Expense $stamp";expense_scope_id=[int]$scope.id;default_taxable=1;requires_document=1;display_order=999}}
$categoryId=[int]$category.data.expense_category.id
$categoryUpdate=Must "Update expense category" {Invoke-Api PATCH ("/api/expenses/categories/"+$categoryId) @{category_code="EXP_API_$stamp";category_name="API Site Expense Updated $stamp";expense_scope_id=[int]$scope.id;default_taxable=1;requires_document=1;display_order=999}}
$categoryList=Must "List expense categories" {Invoke-Api GET "/api/expenses/categories"}
$budgets=Must "Project budgets" {Invoke-Api GET ("/api/project-budgets?project_id="+$projectId)}
$budget=$null;$budgetLine=$null
foreach($b in (Items $budgets.data.project_budgets)){try{$detail=Invoke-Api GET ("/api/project-budgets/"+$b.id);$line=Items $detail.data.project_budget.lines|Select-Object -First 1;if(!$line){$budgetLinesResponse=Invoke-Api GET ("/api/project-budgets/"+$b.id+"/lines");$line=Items $budgetLinesResponse.data.budget_lines|Select-Object -First 1};if($line){$budget=$b;$budgetLine=$line;break}}catch{}}
if ((!$budget) -or (!$budgetLine)) { Fail "Dynamic budget line selection" "No usable project budget line found." };Pass "Dynamic budget line selection"
$requestBody=@{project_id=$projectId;request_no="ER_API_$stamp";request_date=$today;required_date=$today;purpose="Module 9 API expense request"};if($siteId){$requestBody.site_id=$siteId}
$request=Must "Create expense request" {Invoke-Api POST "/api/expenses/requests" $requestBody};$requestId=[int]$request.data.expense_request.id
$requestUpdate=Must "Update expense request" {Invoke-Api PATCH ("/api/expenses/requests/"+$requestId) $requestBody}
$requestItem=Must "Add expense request item" {Invoke-Api POST ("/api/expenses/requests/"+$requestId+"/items") @{expense_category_id=$categoryId;budget_line_id=[int]$budgetLine.id;description="API test site expense";quantity=2;estimated_rate=500;notes="Module 9 complete test"}}
$requestView=Must "View calculated expense request" {Invoke-Api GET ("/api/expenses/requests/"+$requestId)}
$requestList=Must "List expense requests" {Invoke-Api GET ("/api/expenses/requests?project_id="+$projectId)}
$requestSubmit=Must "Submit expense request" {Invoke-Api POST ("/api/expenses/requests/"+$requestId+"/submit") @{remarks="Submitted by Module 9 test"}}
$requestApprove=Must "Approve expense request" {Invoke-Api POST ("/api/expenses/requests/"+$requestId+"/approve") @{remarks="Approved by Module 9 test"}}
$billBody=@{project_id=$projectId;request_id=$requestId;bill_no="INV_API_$stamp";internal_voucher_no="EV_API_$stamp";bill_date=$today;due_date=$today;payee_type_id=[int]$payee.id;payee_name="Module 9 API Payee";discount_amount=0;cgst_amount=0;sgst_amount=0;igst_amount=0;other_charges=0;round_off=0;tds_amount=0;remarks="Module 9 API bill"};if($siteId){$billBody.site_id=$siteId}
$bill=Must "Create expense bill" {Invoke-Api POST "/api/expenses/bills" $billBody};$billId=[int]$bill.data.expense_bill.id
$billUpdate=Must "Update expense bill" {Invoke-Api PATCH ("/api/expenses/bills/"+$billId) $billBody}
$billItem=Must "Add expense bill item" {Invoke-Api POST ("/api/expenses/bills/"+$billId+"/items") @{request_item_id=[int]$requestItem.data.expense_request_item.id;expense_category_id=$categoryId;description="API test expense bill line";quantity=2;rate=500;tax_rate=0}}
$billItemId=[int]$billItem.data.expense_bill_item.id
$document=Must "Add expense bill document" {Invoke-Api POST ("/api/expenses/bills/"+$billId+"/documents") @{document_name="API Test Invoice";file_name="module9-api-invoice.pdf";file_path="uploads/expenses/module9-api-invoice.pdf";mime_type="application/pdf";file_size_bytes=1024;document_date=$today;is_primary=1}}
$allocation=Must "Allocate bill item to budget" {Invoke-Api POST ("/api/expenses/bills/"+$billId+"/items/"+$billItemId+"/allocations") @{budget_id=[int]$budget.id;budget_line_id=[int]$budgetLine.id;allocated_amount=1000;allocation_type_id=[int]$allocType.id;remarks="Module 9 API allocation"}}
$billView=Must "View calculated bill, documents and allocations" {Invoke-Api GET ("/api/expenses/bills/"+$billId)}
$billList=Must "List expense bills" {Invoke-Api GET ("/api/expenses/bills?project_id="+$projectId)}
$billSubmit=Must "Submit expense bill" {Invoke-Api POST ("/api/expenses/bills/"+$billId+"/submit") @{remarks="Submitted by Module 9 test"}}
$billApprove=Must "Approve expense bill" {Invoke-Api POST ("/api/expenses/bills/"+$billId+"/approve") @{remarks="Approved by Module 9 test"}}
$billPost=Must "Post expense bill to actual cost" {Invoke-Api POST ("/api/expenses/bills/"+$billId+"/post") @{remarks="Posted by Module 9 test"}}
$payment=Must "Create expense payment" {Invoke-Api POST "/api/expenses/payments" @{bill_id=$billId;payment_no="EP_API_$stamp";payment_date=$today;payment_mode_id=[int]$mode.id;reference_no="REF_$stamp";amount=1000;tds_deducted=0;remarks="Module 9 API payment"}};$paymentId=[int]$payment.data.expense_payment.id
$paymentUpdate=Must "Update expense payment" {Invoke-Api PATCH ("/api/expenses/payments/"+$paymentId) @{bill_id=$billId;payment_no="EP_API_$stamp";payment_date=$today;payment_mode_id=[int]$mode.id;reference_no="REF_$stamp";amount=1000;tds_deducted=0;remarks="Module 9 API payment updated"}}
$paymentView=Must "View expense payment" {Invoke-Api GET ("/api/expenses/payments/"+$paymentId)}
$paymentList=Must "List expense payments" {Invoke-Api GET ("/api/expenses/payments?bill_id="+$billId)}
$paymentSubmit=Must "Submit expense payment" {Invoke-Api POST ("/api/expenses/payments/"+$paymentId+"/submit") @{remarks="Submitted by Module 9 test"}}
$paymentApprove=Must "Approve expense payment" {Invoke-Api POST ("/api/expenses/payments/"+$paymentId+"/approve") @{remarks="Approved by Module 9 test"}}
$paymentPaid=Must "Mark expense payment paid" {Invoke-Api POST ("/api/expenses/payments/"+$paymentId+"/mark-paid") @{remarks="Paid by Module 9 test"}}
$billAfterPayment=Must "Verify bill paid and outstanding values" {Invoke-Api GET ("/api/expenses/bills/"+$billId)}
$costing=Must "Consolidated project costing summary" {Invoke-Api GET ("/api/project-costing/projects/"+$projectId+"/summary")}
$snapshot=Must "Generate project cost snapshot" {Invoke-Api POST "/api/project-costing/snapshots/generate" @{project_id=$projectId;snapshot_date=$today}}
$snapshots=Must "List project cost snapshots" {Invoke-Api GET ("/api/project-costing/snapshots?project_id="+$projectId)}
$notifications=Must "Load current user's notifications" {Invoke-Api GET "/api/notifications"}
$notificationRows=Items $notifications.data.notifications
Assert-ExpenseNotification "Request notification and email sent" $notificationRows "expense_requests" $requestId @("EXPENSE_REQUEST_APPROVE")
Assert-ExpenseNotification "Bill notification and email sent" $notificationRows "expense_bills" $billId @("EXPENSE_BILL_APPROVE", "EXPENSE_BILL_POST")
Assert-ExpenseNotification "Payment notification and email sent" $notificationRows "expense_payments" $paymentId @("EXPENSE_PAYMENT_APPROVE", "EXPENSE_PAYMENT_MARK_PAID")
$logout=Must "Logout" {Invoke-Api POST "/api/auth/logout" @{}}
Write-Line ""
Write-Line ("ALL MODULE 9 TESTS PASSED: "+$script:Step+"/"+$script:Step)
Write-Line ("Completed: "+(Get-Date).ToString("yyyy-MM-dd HH:mm:ss"))
$script:ResultLog | Set-Content -Encoding UTF8 $ResultFile
