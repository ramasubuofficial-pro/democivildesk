@echo off
REM MODULE 5 - ONE SHOT WINDOWS CMD TEST
REM Run this file from the project root. Do not paste its contents into CMD.
REM Set the real super-admin login below before running.

setlocal EnableExtensions EnableDelayedExpansion
set "BASE_URL=http://localhost:8080"
set "LOGIN_EMAIL=erp.dvn@gmail.com"
set "LOGIN_PASSWORD=CivilPro@12345"
set "OUT=api-test-results"
set "REPORT=!OUT!\module5-complete-test-results.txt"
set "TESTNO=!RANDOM!!RANDOM!"
for /f "delims=" %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set "TESTDATE=%%I"
if not exist "!OUT!" mkdir "!OUT!"
type nul > "!REPORT!"
echo MODULE 5 COMPLETE API TEST>"!REPORT!"
echo TESTNO=!TESTNO! TESTDATE=!TESTDATE!>>"!REPORT!"

echo [01] LOGIN
curl -s -c "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{\"email\":\"!LOGIN_EMAIL!\",\"password\":\"!LOGIN_PASSWORD!\"}" -o "!OUT!\01-login.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/auth/login" > "!OUT!\status.txt"
echo.>>"!REPORT!" & echo [01] LOGIN>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\01-login.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [02] AUTH USER
curl -s -b "!OUT!\cookies.txt" -o "!OUT!\02-me.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/auth/me" > "!OUT!\status.txt"
echo.>>"!REPORT!" & echo [02] AUTH USER>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\02-me.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [03] LABOUR MASTERS
curl -s -b "!OUT!\cookies.txt" -o "!OUT!\03-masters.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour/masters" > "!OUT!\status.txt"
echo.>>"!REPORT!" & echo [03] LABOUR MASTERS>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\03-masters.json">>"!REPORT!" & echo.>>"!REPORT!"
for /f "delims=" %%I in ('powershell -NoProfile -Command "$j=Get-Content '!OUT!\03-masters.json' -Raw ^| ConvertFrom-Json; ($j.data.masters.'category-skill-levels' ^| Select-Object -First 1).id"') do set "SKILL_ID=%%I"
for /f "delims=" %%I in ('powershell -NoProfile -Command "$j=Get-Content '!OUT!\03-masters.json' -Raw ^| ConvertFrom-Json; ($j.data.masters.'category-wage-bases' ^| Where-Object wage_basis_code -eq 'DAILY' ^| Select-Object -First 1).id"') do set "CATEGORY_WAGE_ID=%%I"
for /f "delims=" %%I in ('powershell -NoProfile -Command "$j=Get-Content '!OUT!\03-masters.json' -Raw ^| ConvertFrom-Json; ($j.data.masters.'contractor-statuses' ^| Where-Object status_code -eq 'ACTIVE' ^| Select-Object -First 1).id"') do set "CONTRACTOR_STATUS_ID=%%I"
for /f "delims=" %%I in ('powershell -NoProfile -Command "$j=Get-Content '!OUT!\03-masters.json' -Raw ^| ConvertFrom-Json; ($j.data.masters.'employment-sources' ^| Select-Object -First 1).id"') do set "EMPLOYMENT_SOURCE_ID=%%I"
for /f "delims=" %%I in ('powershell -NoProfile -Command "$j=Get-Content '!OUT!\03-masters.json' -Raw ^| ConvertFrom-Json; ($j.data.masters.genders ^| Select-Object -First 1).id"') do set "GENDER_ID=%%I"
for /f "delims=" %%I in ('powershell -NoProfile -Command "$j=Get-Content '!OUT!\03-masters.json' -Raw ^| ConvertFrom-Json; ($j.data.masters.'worker-id-types' ^| Select-Object -First 1).id"') do set "ID_TYPE_ID=%%I"
for /f "delims=" %%I in ('powershell -NoProfile -Command "$j=Get-Content '!OUT!\03-masters.json' -Raw ^| ConvertFrom-Json; ($j.data.masters.'worker-wage-bases' ^| Where-Object wage_basis_code -eq 'DAILY' ^| Select-Object -First 1).id"') do set "WORKER_WAGE_ID=%%I"
for /f "delims=" %%I in ('powershell -NoProfile -Command "$j=Get-Content '!OUT!\03-masters.json' -Raw ^| ConvertFrom-Json; ($j.data.masters.'worker-statuses' ^| Where-Object status_code -eq 'ACTIVE' ^| Select-Object -First 1).id"') do set "WORKER_STATUS_ID=%%I"
for /f "delims=" %%I in ('powershell -NoProfile -Command "$j=Get-Content '!OUT!\03-masters.json' -Raw ^| ConvertFrom-Json; ($j.data.masters.'document-statuses' ^| Select-Object -First 1).id"') do set "DOCUMENT_STATUS_ID=%%I"
for /f "delims=" %%I in ('powershell -NoProfile -Command "$j=Get-Content '!OUT!\03-masters.json' -Raw ^| ConvertFrom-Json; ($j.data.masters.'assignment-wage-bases' ^| Where-Object wage_basis_code -eq 'DAILY' ^| Select-Object -First 1).id"') do set "ASSIGNMENT_WAGE_ID=%%I"
for /f "delims=" %%I in ('powershell -NoProfile -Command "$j=Get-Content '!OUT!\03-masters.json' -Raw ^| ConvertFrom-Json; ($j.data.masters.'assignment-statuses' ^| Where-Object status_code -eq 'ACTIVE' ^| Select-Object -First 1).id"') do set "ASSIGNMENT_STATUS_ID=%%I"
for /f "delims=" %%I in ('powershell -NoProfile -Command "$j=Get-Content '!OUT!\03-masters.json' -Raw ^| ConvertFrom-Json; ($j.data.masters.'attendance-statuses' ^| Where-Object attendance_status_code -eq 'PRESENT' ^| Select-Object -First 1).id"') do set "ATTENDANCE_STATUS_ID=%%I"
for /f "delims=" %%I in ('powershell -NoProfile -Command "$j=Get-Content '!OUT!\03-masters.json' -Raw ^| ConvertFrom-Json; ($j.data.masters.'attendance-sources' ^| Where-Object attendance_source_code -eq 'MANUAL' ^| Select-Object -First 1).id"') do set "ATTENDANCE_SOURCE_ID=%%I"
for /f "delims=" %%I in ('powershell -NoProfile -Command "$j=Get-Content '!OUT!\03-masters.json' -Raw ^| ConvertFrom-Json; ($j.data.masters.'payment-modes' ^| Where-Object payment_mode_code -eq 'CASH' ^| Select-Object -First 1).id"') do set "PAYMENT_MODE_ID=%%I"

echo [04] PROJECT AND SITE
curl -s -b "!OUT!\cookies.txt" -o "!OUT!\04-projects.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/projects" > "!OUT!\status.txt"
for /f "delims=" %%I in ('powershell -NoProfile -Command "$j=Get-Content '!OUT!\04-projects.json' -Raw ^| ConvertFrom-Json; ($j.data.projects ^| Select-Object -First 1).id"') do set "PROJECT_ID=%%I"
echo.>>"!REPORT!" & echo [04] PROJECTS PROJECT_ID=!PROJECT_ID!>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\04-projects.json">>"!REPORT!" & echo.>>"!REPORT!"
curl -s -b "!OUT!\cookies.txt" -o "!OUT!\05-sites.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/sites?project_id=!PROJECT_ID!" > "!OUT!\status.txt"
for /f "delims=" %%I in ('powershell -NoProfile -Command "$j=Get-Content '!OUT!\05-sites.json' -Raw ^| ConvertFrom-Json; ($j.data.sites ^| Select-Object -First 1).id"') do set "SITE_ID=%%I"
echo.>>"!REPORT!" & echo [05] SITES SITE_ID=!SITE_ID!>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\05-sites.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [06] CREATE CATEGORY
curl -s -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{\"category_code\":\"LCAT_!TESTNO!\",\"category_name\":\"API Test Labour !TESTNO!\",\"skill_level_id\":!SKILL_ID!,\"wage_basis_id\":!CATEGORY_WAGE_ID!,\"default_wage_rate\":1200,\"overtime_multiplier\":1.5,\"description\":\"Module 5 test\",\"display_order\":999,\"is_active\":1}" -o "!OUT!\06-category-create.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour/categories" > "!OUT!\status.txt"
for /f "delims=" %%I in ('powershell -NoProfile -Command "(Get-Content '!OUT!\06-category-create.json' -Raw ^| ConvertFrom-Json).data.labour_category.id"') do set "CATEGORY_ID=%%I"
echo.>>"!REPORT!" & echo [06] CREATE CATEGORY ID=!CATEGORY_ID!>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\06-category-create.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [07] UPDATE CATEGORY
curl -s -X PATCH -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{\"category_name\":\"API Test Labour Updated !TESTNO!\",\"default_wage_rate\":1250}" -o "!OUT!\07-category-update.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour/categories/!CATEGORY_ID!" > "!OUT!\status.txt"
echo.>>"!REPORT!" & echo [07] UPDATE CATEGORY>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\07-category-update.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [08] CREATE CONTRACTOR
curl -s -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{\"contractor_code\":\"LCTR_!TESTNO!\",\"contractor_name\":\"API Contractor !TESTNO!\",\"contact_person\":\"Test Manager\",\"phone\":\"9876543210\",\"email\":\"labour!TESTNO!@test.com\",\"payment_terms_days\":7,\"status_id\":!CONTRACTOR_STATUS_ID!}" -o "!OUT!\08-contractor-create.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour/contractors" > "!OUT!\status.txt"
for /f "delims=" %%I in ('powershell -NoProfile -Command "(Get-Content '!OUT!\08-contractor-create.json' -Raw ^| ConvertFrom-Json).data.labour_contractor.id"') do set "CONTRACTOR_ID=%%I"
echo.>>"!REPORT!" & echo [08] CREATE CONTRACTOR ID=!CONTRACTOR_ID!>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\08-contractor-create.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [09] CREATE WORKER
curl -s -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{\"labour_category_id\":!CATEGORY_ID!,\"contractor_id\":!CONTRACTOR_ID!,\"worker_code\":\"LWRK_!TESTNO!\",\"worker_name\":\"API Worker !TESTNO!\",\"employment_source_id\":!EMPLOYMENT_SOURCE_ID!,\"gender_id\":!GENDER_ID!,\"id_type_id\":!ID_TYPE_ID!,\"id_number_masked\":\"XXXX!TESTNO!\",\"date_joined\":\"!TESTDATE!\",\"wage_basis_id\":!WORKER_WAGE_ID!,\"base_wage_rate\":1200,\"overtime_rate_per_hour\":200,\"status_id\":!WORKER_STATUS_ID!}" -o "!OUT!\09-worker-create.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour/workers" > "!OUT!\status.txt"
for /f "delims=" %%I in ('powershell -NoProfile -Command "(Get-Content '!OUT!\09-worker-create.json' -Raw ^| ConvertFrom-Json).data.labour_worker.id"') do set "WORKER_ID=%%I"
echo.>>"!REPORT!" & echo [09] CREATE WORKER ID=!WORKER_ID!>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\09-worker-create.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [10] UPDATE WORKER
curl -s -X PATCH -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{\"phone\":\"9000000000\",\"notes\":\"Updated by Module 5 test\"}" -o "!OUT!\10-worker-update.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour/workers/!WORKER_ID!" > "!OUT!\status.txt"
echo.>>"!REPORT!" & echo [10] UPDATE WORKER>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\10-worker-update.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [11] CREATE DOCUMENT
curl -s -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{\"document_name\":\"API Identity Document\",\"document_number\":\"DOC-!TESTNO!\",\"file_path\":\"uploads/labour/test-document-!TESTNO!.pdf\",\"verification_status_id\":!DOCUMENT_STATUS_ID!,\"remarks\":\"Module 5 test document\"}" -o "!OUT!\11-document-create.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour/workers/!WORKER_ID!/documents" > "!OUT!\status.txt"
for /f "delims=" %%I in ('powershell -NoProfile -Command "(Get-Content '!OUT!\11-document-create.json' -Raw ^| ConvertFrom-Json).data.worker_document.id"') do set "DOCUMENT_ID=%%I"
echo.>>"!REPORT!" & echo [11] CREATE DOCUMENT ID=!DOCUMENT_ID!>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\11-document-create.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [12] VERIFY DOCUMENT
curl -s -X POST -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{\"verification_status_id\":!DOCUMENT_STATUS_ID!,\"remarks\":\"Verified by Module 5 test\"}" -o "!OUT!\12-document-verify.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour/workers/!WORKER_ID!/documents/!DOCUMENT_ID!/verify" > "!OUT!\status.txt"
echo.>>"!REPORT!" & echo [12] VERIFY DOCUMENT>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\12-document-verify.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [13] CREATE ASSIGNMENT
curl -s -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{\"project_id\":!PROJECT_ID!,\"site_id\":!SITE_ID!,\"worker_id\":!WORKER_ID!,\"labour_category_id\":!CATEGORY_ID!,\"assigned_from\":\"!TESTDATE!\",\"wage_basis_id\":!ASSIGNMENT_WAGE_ID!,\"agreed_wage_rate\":1200,\"overtime_rate\":200,\"shift_name\":\"GENERAL\",\"status_id\":!ASSIGNMENT_STATUS_ID!,\"remarks\":\"Module 5 test assignment\"}" -o "!OUT!\13-assignment-create.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour/assignments" > "!OUT!\status.txt"
for /f "delims=" %%I in ('powershell -NoProfile -Command "(Get-Content '!OUT!\13-assignment-create.json' -Raw ^| ConvertFrom-Json).data.labour_assignment.id"') do set "ASSIGNMENT_ID=%%I"
echo.>>"!REPORT!" & echo [13] CREATE ASSIGNMENT ID=!ASSIGNMENT_ID!>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\13-assignment-create.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [14] CREATE ATTENDANCE
curl -s -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{\"project_id\":!PROJECT_ID!,\"site_id\":!SITE_ID!,\"attendance_date\":\"!TESTDATE!\",\"shift_code\":\"T!TESTNO!\",\"remarks\":\"Module 5 attendance test\"}" -o "!OUT!\14-attendance-create.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour-attendance" > "!OUT!\status.txt"
for /f "delims=" %%I in ('powershell -NoProfile -Command "(Get-Content '!OUT!\14-attendance-create.json' -Raw ^| ConvertFrom-Json).data.attendance_batch.id"') do set "BATCH_ID=%%I"
echo.>>"!REPORT!" & echo [14] CREATE ATTENDANCE ID=!BATCH_ID!>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\14-attendance-create.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [15] CREATE ATTENDANCE ENTRY
curl -s -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{\"assignment_id\":!ASSIGNMENT_ID!,\"worker_id\":!WORKER_ID!,\"attendance_status_id\":!ATTENDANCE_STATUS_ID!,\"check_in_time\":\"08:00:00\",\"check_out_time\":\"18:00:00\",\"regular_hours\":8,\"overtime_hours\":2,\"attendance_source_id\":!ATTENDANCE_SOURCE_ID!,\"work_description\":\"Module 5 API test work\"}" -o "!OUT!\15-entry-create.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour-attendance/!BATCH_ID!/entries" > "!OUT!\status.txt"
for /f "delims=" %%I in ('powershell -NoProfile -Command "(Get-Content '!OUT!\15-entry-create.json' -Raw ^| ConvertFrom-Json).data.attendance_entry.id"') do set "ENTRY_ID=%%I"
echo.>>"!REPORT!" & echo [15] CREATE ENTRY ID=!ENTRY_ID!>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\15-entry-create.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [16] UPDATE ATTENDANCE ENTRY
curl -s -X PATCH -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{\"remarks\":\"Attendance entry updated\"}" -o "!OUT!\16-entry-update.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour-attendance/!BATCH_ID!/entries/!ENTRY_ID!" > "!OUT!\status.txt"
echo.>>"!REPORT!" & echo [16] UPDATE ENTRY>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\16-entry-update.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [17] SUBMIT ATTENDANCE
curl -s -X POST -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{\"remarks\":\"Submitted for test\"}" -o "!OUT!\17-attendance-submit.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour-attendance/!BATCH_ID!/submit" > "!OUT!\status.txt"
echo.>>"!REPORT!" & echo [17] SUBMIT ATTENDANCE>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\17-attendance-submit.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [18] REJECT ATTENDANCE
curl -s -X POST -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{\"remarks\":\"Reject lifecycle test\"}" -o "!OUT!\18-attendance-reject.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour-attendance/!BATCH_ID!/reject" > "!OUT!\status.txt"
echo.>>"!REPORT!" & echo [18] REJECT ATTENDANCE>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\18-attendance-reject.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [19] RESUBMIT ATTENDANCE
curl -s -X POST -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{\"remarks\":\"Corrected and resubmitted\"}" -o "!OUT!\19-attendance-resubmit.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour-attendance/!BATCH_ID!/submit" > "!OUT!\status.txt"
echo.>>"!REPORT!" & echo [19] RESUBMIT ATTENDANCE>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\19-attendance-resubmit.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [20] APPROVE AND LOCK ATTENDANCE
curl -s -X POST -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{}" -o "!OUT!\20-attendance-approve.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour-attendance/!BATCH_ID!/approve" > "!OUT!\status.txt"
echo.>>"!REPORT!" & echo [20] APPROVE ATTENDANCE>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\20-attendance-approve.json">>"!REPORT!" & echo.>>"!REPORT!"
curl -s -X POST -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{}" -o "!OUT!\21-attendance-lock.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour-attendance/!BATCH_ID!/lock" > "!OUT!\status.txt"
echo.>>"!REPORT!" & echo [21] LOCK ATTENDANCE>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\21-attendance-lock.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [22] CREATE WAGE PERIOD
curl -s -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{\"project_id\":!PROJECT_ID!,\"site_id\":!SITE_ID!,\"period_code\":\"WP_!TESTNO!\",\"period_start\":\"!TESTDATE!\",\"period_end\":\"!TESTDATE!\",\"contractor_id\":!CONTRACTOR_ID!,\"remarks\":\"Module 5 wage test\"}" -o "!OUT!\22-wage-create.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour-wages" > "!OUT!\status.txt"
for /f "delims=" %%I in ('powershell -NoProfile -Command "(Get-Content '!OUT!\22-wage-create.json' -Raw ^| ConvertFrom-Json).data.wage_period.id"') do set "WAGE_ID=%%I"
echo.>>"!REPORT!" & echo [22] CREATE WAGE ID=!WAGE_ID!>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\22-wage-create.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [23] CALCULATE WAGES
curl -s -X POST -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{}" -o "!OUT!\23-wage-calculate.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour-wages/!WAGE_ID!/calculate" > "!OUT!\status.txt"
for /f "delims=" %%I in ('powershell -NoProfile -Command "$j=Get-Content '!OUT!\23-wage-calculate.json' -Raw ^| ConvertFrom-Json; ($j.data.wage_period.lines ^| Select-Object -First 1).id"') do set "WAGE_LINE_ID=%%I"
echo.>>"!REPORT!" & echo [23] CALCULATE WAGES LINE_ID=!WAGE_LINE_ID!>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\23-wage-calculate.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [24] UPDATE WAGE LINE
curl -s -X PATCH -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{\"allowance_amount\":100,\"remarks\":\"API test allowance\"}" -o "!OUT!\24-wage-line-update.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour-wages/!WAGE_ID!/lines/!WAGE_LINE_ID!" > "!OUT!\status.txt"
for /f "delims=" %%I in ('powershell -NoProfile -Command "(Get-Content '!OUT!\24-wage-line-update.json' -Raw ^| ConvertFrom-Json).data.wage_line.net_amount"') do set "NET_AMOUNT=%%I"
echo.>>"!REPORT!" & echo [24] UPDATE WAGE LINE NET=!NET_AMOUNT!>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\24-wage-line-update.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [25] SUBMIT AND APPROVE WAGES
curl -s -X POST -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{}" -o "!OUT!\25-wage-submit.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour-wages/!WAGE_ID!/submit" > "!OUT!\status.txt"
echo.>>"!REPORT!" & echo [25] SUBMIT WAGES>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\25-wage-submit.json">>"!REPORT!" & echo.>>"!REPORT!"
curl -s -X POST -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{}" -o "!OUT!\26-wage-approve.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour-wages/!WAGE_ID!/approve" > "!OUT!\status.txt"
echo.>>"!REPORT!" & echo [26] APPROVE WAGES>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\26-wage-approve.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [27] CREATE PAYMENT
curl -s -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{\"wage_period_id\":!WAGE_ID!,\"wage_line_id\":!WAGE_LINE_ID!,\"worker_id\":!WORKER_ID!,\"payment_no\":\"PAY_!TESTNO!\",\"payment_date\":\"!TESTDATE!\",\"payment_mode_id\":!PAYMENT_MODE_ID!,\"amount\":!NET_AMOUNT!,\"recipient_name\":\"API Worker !TESTNO!\",\"remarks\":\"Module 5 payment test\"}" -o "!OUT!\27-payment-create.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour-payments" > "!OUT!\status.txt"
for /f "delims=" %%I in ('powershell -NoProfile -Command "(Get-Content '!OUT!\27-payment-create.json' -Raw ^| ConvertFrom-Json).data.labour_payment.id"') do set "PAYMENT_ID=%%I"
echo.>>"!REPORT!" & echo [27] CREATE PAYMENT ID=!PAYMENT_ID!>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\27-payment-create.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [28] PAYMENT LIFECYCLE
curl -s -X POST -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{}" -o "!OUT!\28-payment-submit.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour-payments/!PAYMENT_ID!/submit" > "!OUT!\status.txt"
echo.>>"!REPORT!" & echo [28] SUBMIT PAYMENT>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\28-payment-submit.json">>"!REPORT!" & echo.>>"!REPORT!"
curl -s -X POST -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{}" -o "!OUT!\29-payment-approve.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour-payments/!PAYMENT_ID!/approve" > "!OUT!\status.txt"
echo.>>"!REPORT!" & echo [29] APPROVE PAYMENT>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\29-payment-approve.json">>"!REPORT!" & echo.>>"!REPORT!"
curl -s -X POST -b "!OUT!\cookies.txt" -H "Content-Type: application/json" -d "{}" -o "!OUT!\30-payment-paid.json" -w "HTTP %%{http_code}" "!BASE_URL!/api/labour-payments/!PAYMENT_ID!/mark-paid" > "!OUT!\status.txt"
echo.>>"!REPORT!" & echo [30] MARK PAYMENT PAID>>"!REPORT!" & type "!OUT!\status.txt">>"!REPORT!" & echo.>>"!REPORT!" & type "!OUT!\30-payment-paid.json">>"!REPORT!" & echo.>>"!REPORT!"

echo [31] FINAL SHOW AND LIST CHECKS
curl -s -b "!OUT!\cookies.txt" "!BASE_URL!/api/labour/categories/!CATEGORY_ID!" -o "!OUT!\31-category-show.json"
curl -s -b "!OUT!\cookies.txt" "!BASE_URL!/api/labour/contractors/!CONTRACTOR_ID!" -o "!OUT!\32-contractor-show.json"
curl -s -b "!OUT!\cookies.txt" "!BASE_URL!/api/labour/workers/!WORKER_ID!" -o "!OUT!\33-worker-show.json"
curl -s -b "!OUT!\cookies.txt" "!BASE_URL!/api/labour/assignments/!ASSIGNMENT_ID!" -o "!OUT!\34-assignment-show.json"
curl -s -b "!OUT!\cookies.txt" "!BASE_URL!/api/labour-attendance/!BATCH_ID!" -o "!OUT!\35-attendance-show.json"
curl -s -b "!OUT!\cookies.txt" "!BASE_URL!/api/labour-wages/!WAGE_ID!" -o "!OUT!\36-wage-show.json"
curl -s -b "!OUT!\cookies.txt" "!BASE_URL!/api/labour-payments/!PAYMENT_ID!" -o "!OUT!\37-payment-show.json"
for %%F in (31-category-show.json 32-contractor-show.json 33-worker-show.json 34-assignment-show.json 35-attendance-show.json 36-wage-show.json 37-payment-show.json) do @(echo.>>"!REPORT!" & echo ===== %%F =====>>"!REPORT!" & type "!OUT!\%%F">>"!REPORT!" & echo.>>"!REPORT!")

echo.>>"!REPORT!"
echo MODULE 5 TEST COMPLETED>>"!REPORT!"
echo PROJECT_ID=!PROJECT_ID! SITE_ID=!SITE_ID!>>"!REPORT!"
echo CATEGORY_ID=!CATEGORY_ID! CONTRACTOR_ID=!CONTRACTOR_ID! WORKER_ID=!WORKER_ID!>>"!REPORT!"
echo DOCUMENT_ID=!DOCUMENT_ID! ASSIGNMENT_ID=!ASSIGNMENT_ID! BATCH_ID=!BATCH_ID!>>"!REPORT!"
echo WAGE_ID=!WAGE_ID! WAGE_LINE_ID=!WAGE_LINE_ID! PAYMENT_ID=!PAYMENT_ID!>>"!REPORT!"
echo Result file: !REPORT!
type "!REPORT!"
endlocal
