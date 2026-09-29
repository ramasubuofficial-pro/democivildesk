param(
  [string]$BaseUrl = "http://localhost:8080",
  [string]$Email = "erp.dvn@gmail.com",
  [string]$Password = "CivilPro@12345",
  [string]$ResultFile = "api-test-results/module6-complete-test-results.txt"
)
$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'
$dir=Split-Path $ResultFile -Parent;if($dir){New-Item -ItemType Directory -Force $dir|Out-Null};Remove-Item $ResultFile -ErrorAction SilentlyContinue
$session=New-Object Microsoft.PowerShell.Commands.WebRequestSession;$n=0
function Log([string]$s){$s|Tee-Object -FilePath $ResultFile -Append}
function Call([string]$name,[string]$method,[string]$path,$body=$null){$script:n++;try{$p=@{Uri="$BaseUrl$path";Method=$method;WebSession=$session;ContentType='application/json'};if($null-ne$body){$p.Body=($body|ConvertTo-Json -Depth 10 -Compress)};$r=Invoke-RestMethod @p;if(-not$r.success){throw($r|ConvertTo-Json -Depth 10)};Log("PASS {0:D2} - {1}" -f $script:n,$name);return $r}catch{Log("FAIL {0:D2} - {1}`r`n{2}" -f $script:n,$name,$_.Exception.Message);throw}}
try{
 $login=Call 'Login' POST '/api/auth/login' @{email=$Email;password=$Password;remember=$false}
 Call 'Authenticated user' GET '/api/auth/me'|Out-Null
 $masters=(Call 'Material masters' GET '/api/materials/masters').data.masters
 $projects=(Call 'Projects' GET '/api/projects').data.projects;$project=$projects|Select-Object -First 1;if(!$project){throw'No accessible project exists.'}
 $sites=(Call 'Project sites' GET "/api/sites?project_id=$($project.id)").data.sites;$site=$sites|Select-Object -First 1;if(!$site){throw'No site exists for selected project.'}
 $uom=$masters.units|Select-Object -First 1;$storage=$masters.storage_types|Select-Object -First 1;$supplierStatus=$masters.supplier_statuses|Where-Object status_code -eq 'ACTIVE'|Select-Object -First 1;$priority=$masters.request_priorities|Where-Object priority_code -eq 'NORMAL'|Select-Object -First 1
 if(!$uom-or!$storage-or!$supplierStatus-or!$priority){throw'Required active Material master value is missing.'}
 $tag=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
 $cat=(Call 'Create category' POST '/api/materials/categories' @{category_code="CAT$tag";category_name="API Test Category $tag";storage_type_id=$storage.id;quality_check_required=$true;display_order=900;is_active=$true}).data.material_category
 Call 'List categories' GET '/api/materials/categories'|Out-Null;Call 'View category' GET "/api/materials/categories/$($cat.id)"|Out-Null
 $mat=(Call 'Create material' POST '/api/materials/catalogue' @{material_category_id=$cat.id;base_uom_id=$uom.id;material_code="MAT$tag";material_name="API Test Material $tag";gst_rate=18;standard_rate=100;minimum_stock_qty=5;reorder_qty=20;quality_check_required=$true;batch_tracking_required=$false;is_active=$true}).data.material
 Call 'List materials' GET '/api/materials/catalogue'|Out-Null;Call 'Update material' PATCH "/api/materials/catalogue/$($mat.id)" @{notes='Updated by complete API test'}|Out-Null
 $sup=(Call 'Create supplier' POST '/api/materials/suppliers' @{supplier_code="SUP$tag";supplier_name="API Test Supplier $tag";phone='9000000000';payment_terms_days=30;status_id=$supplierStatus.id}).data.material_supplier
 Call 'List suppliers' GET '/api/materials/suppliers'|Out-Null
 $req=(Call 'Create request' POST '/api/material-management/requests' @{project_id=$project.id;site_id=$site.id;request_no="MR$tag";request_date=(Get-Date -Format yyyy-MM-dd);priority_id=$priority.id;purpose='Complete API test'}).data.material_request
 $ri=(Call 'Add request item' POST "/api/material-management/requests/$($req.id)/items" @{material_id=$mat.id;uom_id=$uom.id;requested_qty=10;estimated_rate=100}).data.item
 Call 'View request with items' GET "/api/material-management/requests/$($req.id)"|Out-Null;Call 'Submit request' POST "/api/material-management/requests/$($req.id)/submit" @{}|Out-Null;Call 'Approve request' POST "/api/material-management/requests/$($req.id)/approve" @{remarks='Approved by API test'}|Out-Null
 $po=(Call 'Create purchase order' POST '/api/material-management/purchase-orders' @{project_id=$project.id;site_id=$site.id;supplier_id=$sup.id;po_no="PO$tag";po_date=(Get-Date -Format yyyy-MM-dd);freight_amount=50}).data.material_purchase_order
 $poi=(Call 'Add PO item' POST "/api/material-management/purchase-orders/$($po.id)/items" @{request_item_id=$ri.id;material_id=$mat.id;uom_id=$uom.id;ordered_qty=10;unit_rate=100;discount_percentage=0;gst_rate=18}).data.item
 Call 'View PO with calculated totals' GET "/api/material-management/purchase-orders/$($po.id)"|Out-Null;Call 'Submit PO' POST "/api/material-management/purchase-orders/$($po.id)/submit" @{}|Out-Null;Call 'Approve PO' POST "/api/material-management/purchase-orders/$($po.id)/approve" @{remarks='Approved by API test'}|Out-Null;Call 'Send PO' POST "/api/material-management/purchase-orders/$($po.id)/send" @{}|Out-Null
 $receipt=(Call 'Create receipt' POST '/api/material-management/receipts' @{project_id=$project.id;site_id=$site.id;purchase_order_id=$po.id;supplier_id=$sup.id;receipt_no="GRN$tag";receipt_date=(Get-Date -Format yyyy-MM-dd);supplier_challan_no="CH$tag"}).data.material_receipt
 $quality=$masters.quality_statuses|Where-Object quality_status_code -eq 'PASSED'|Select-Object -First 1
 $rii=(Call 'Add receipt item' POST "/api/material-management/receipts/$($receipt.id)/items" @{purchase_order_item_id=$poi.id;material_id=$mat.id;uom_id=$uom.id;received_qty=10;unit_rate=100;quality_status_id=$quality.id}).data.item
 Call 'Inspect receipt' POST "/api/material-management/receipts/$($receipt.id)/inspect" @{items=@(@{id=$rii.id;accepted_qty=10;rejected_qty=0;quality_status_id=$quality.id})}|Out-Null;Call 'Post receipt' POST "/api/material-management/receipts/$($receipt.id)/post" @{}|Out-Null
 Call 'Stock after receipt' GET "/api/material-management/stock?project_id=$($project.id)&site_id=$($site.id)&material_id=$($mat.id)"|Out-Null
 $issueType=$masters.transaction_types|Where-Object transaction_type_code -eq 'ISSUE'|Select-Object -First 1
 $tx=(Call 'Create stock issue' POST '/api/material-management/transactions' @{project_id=$project.id;transaction_no="ISS$tag";transaction_date=(Get-Date -Format yyyy-MM-dd);transaction_type_id=$issueType.id;from_site_id=$site.id;purpose='API test issue'}).data.material_transaction
 Call 'Add issue item' POST "/api/material-management/transactions/$($tx.id)/items" @{material_id=$mat.id;uom_id=$uom.id;quantity=2;unit_rate=100}|Out-Null;Call 'Submit stock issue' POST "/api/material-management/transactions/$($tx.id)/submit" @{}|Out-Null;Call 'Approve stock issue' POST "/api/material-management/transactions/$($tx.id)/approve" @{}|Out-Null;Call 'Post stock issue' POST "/api/material-management/transactions/$($tx.id)/post" @{}|Out-Null
 Call 'Stock after issue' GET "/api/material-management/stock?project_id=$($project.id)&site_id=$($site.id)&material_id=$($mat.id)"|Out-Null;Call 'Material ledger' GET "/api/material-management/ledger?project_id=$($project.id)&material_id=$($mat.id)"|Out-Null
 $script:n++;try{Invoke-WebRequest -Uri "$BaseUrl/api/material-management/stock/export?project_id=$($project.id)&site_id=$($site.id)" -WebSession $session -OutFile "$dir/material-stock-export.csv";Log("PASS {0:D2} - Stock CSV export" -f $script:n)}catch{Log("FAIL {0:D2} - Stock CSV export`r`n{1}" -f $script:n,$_.Exception.Message);throw}
 Call 'List requests' GET '/api/material-management/requests'|Out-Null;Call 'List purchase orders' GET '/api/material-management/purchase-orders'|Out-Null;Call 'List receipts' GET '/api/material-management/receipts'|Out-Null;Call 'List transactions' GET '/api/material-management/transactions'|Out-Null
 $notifications=(Call 'List notifications' GET '/api/notifications').data.notifications
 $materialNotifications=@($notifications|Where-Object {$_.source_module -like 'MATERIAL_*'})
 $script:n++;if($materialNotifications.Count -eq 0){Log("FAIL {0:D2} - Material in-app notifications were not created." -f $script:n);throw'Material in-app notifications were not created.'};Log("PASS {0:D2} - Material in-app notifications created ($($materialNotifications.Count) found)" -f $script:n)
 $emailResults=@($materialNotifications|Where-Object {$_.email_sent -eq 1 -or -not[string]::IsNullOrWhiteSpace([string]$_.email_error)})
 $script:n++;if($emailResults.Count -eq 0){Log("FAIL {0:D2} - Material notification email was not attempted." -f $script:n);throw'Material notification email was not attempted.'};Log("PASS {0:D2} - Material notification email result recorded" -f $script:n)
 Call 'Logout' POST '/api/auth/logout' @{}|Out-Null;Log("`r`nMODULE 6 COMPLETE TEST PASSED: $n/$n tests passed.")
}catch{Log("`r`nMODULE 6 COMPLETE TEST FAILED. Fix the first FAIL above; no false success was printed.");exit 1}
