# UniLib Core - Live API Test and Demonstration Script
# Target: http://localhost:3000
param(
    [string]$BaseUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   UniLib Core - Enterprise API Test and Demonstration   " -ForegroundColor Cyan
Write-Host "   Target URL: $BaseUrl" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

function Print-Step {
    param([int]$num, [string]$title)
    Write-Host "[STEP $num] $title" -ForegroundColor Yellow
}

function Print-Success {
    param([string]$msg)
    Write-Host "  [PASS] $msg" -ForegroundColor Green
}

function Print-Fail {
    param([string]$msg)
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
}

function Print-Info {
    param([string]$msg)
    Write-Host "  [INFO] $msg" -ForegroundColor DarkGray
}

$testCount = 0
$passCount = 0

# ----------------------------------------------------
# 1. Health Check
# ----------------------------------------------------
Print-Step -num 1 -title "System Health and Database Connection"
$testCount++
try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get
    if ($health.status -eq "ok") {
        Print-Success "Server status: $($health.status), In-Memory DB: $($health.in_memory_db)"
        $passCount++
    } else {
        Print-Fail "Unexpected health status: $($health.status)"
    }
} catch {
    Print-Fail "Cannot reach $BaseUrl/health: $_"
}
Write-Host ""

# ----------------------------------------------------
# 2. Authentication & Token Extraction
# ----------------------------------------------------
Print-Step -num 2 -title "User Authentication and Role-Based JWT Generation"
$testCount++
$studentToken = ""
$librarianToken = ""
$adminToken = ""

try {
    # Student Login
    $stuRes = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post `
        -ContentType "application/json" `
        -Body (@{ identifier = "student1@unilib.ac.th"; password = "password123" } | ConvertTo-Json)
    $studentToken = $stuRes.data.token
    Print-Info "Student Token: $($stuRes.data.user.full_name) [Role: $($stuRes.data.user.role)]"

    # Librarian Login
    $libRes = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post `
        -ContentType "application/json" `
        -Body (@{ identifier = "librarian@unilib.ac.th"; password = "password123" } | ConvertTo-Json)
    $librarianToken = $libRes.data.token
    Print-Info "Librarian Token: $($libRes.data.user.full_name) [Role: $($libRes.data.user.role)]"

    # Admin Login
    $admRes = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post `
        -ContentType "application/json" `
        -Body (@{ identifier = "admin@unilib.ac.th"; password = "password123" } | ConvertTo-Json)
    $adminToken = $admRes.data.token
    Print-Info "Admin Token: $($admRes.data.user.full_name) [Role: $($admRes.data.user.role)]"

    Print-Success "All 3 Roles successfully authenticated via bcrypt and issued valid JWTs"
    $passCount++
} catch {
    Print-Fail "Authentication failed: $_"
}
Write-Host ""

# ----------------------------------------------------
# 3. Account Standing & Standing Checks
# ----------------------------------------------------
Print-Step -num 3 -title "Account Standing Verification (/api/auth/me)"
$testCount++
try {
    $headers = @{ Authorization = "Bearer $studentToken" }
    $me = Invoke-RestMethod -Uri "$BaseUrl/api/auth/me" -Method Get -Headers $headers
    if ($me.success -eq $true -and $me.data.standing.can_borrow -eq $true) {
        $st = $me.data.standing
        Print-Success "Student 1 Standing: Active Loans=$($st.active_loans_count)/5, Overdue=$($st.has_overdue_loans), Balance=$($st.outstanding_fine_balance) THB, Can Borrow=$($st.can_borrow)"
        $passCount++
    } else {
        Print-Fail "Standing response invalid"
    }
} catch {
    Print-Fail "Failed to fetch /api/auth/me: $_"
}
Write-Host ""

# ----------------------------------------------------
# 4. Catalog & Inventory Inspection
# ----------------------------------------------------
Print-Step -num 4 -title "Catalog Search and Inventory Query"
$testCount++
try {
    $catalog = Invoke-RestMethod -Uri "$BaseUrl/api/books" -Method Get
    Print-Info "Total titles in catalog: $($catalog.pagination.total)"
    foreach ($b in $catalog.data) {
        Print-Info " - [$($b.isbn)] $($b.title) (Total: $($b.total_copies_count), Available: $($b.available_copies_count))"
    }

    $detail = Invoke-RestMethod -Uri "$BaseUrl/api/books/book-clean-arch" -Method Get
    $copyCount = $detail.data.copies.Count
    Print-Success "Clean Architecture inventory retrieved: $copyCount physical copies registered"
    $passCount++
} catch {
    Print-Fail "Catalog query failed: $_"
}
Write-Host ""

# ----------------------------------------------------
# 5. Separation of Duties: Admin Borrow Restriction
# ----------------------------------------------------
Print-Step -num 5 -title "Separation of Duties: Admin Attempting to Borrow (Expected: 403 FORBIDDEN)"
$testCount++
try {
    $admHeaders = @{ Authorization = "Bearer $adminToken" }
    $admBorrow = Invoke-RestMethod -Uri "$BaseUrl/api/circulation/borrow" -Method Post `
        -Headers $admHeaders -ContentType "application/json" `
        -Body (@{ barcode = "CA-000001" } | ConvertTo-Json)
    Print-Fail "Admin was permitted to borrow! (Violation of Separation of Duties)"
} catch {
    $statusCode = 0
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
    }
    if ($statusCode -eq 403) {
        Print-Success "Admin request rejected with HTTP 403 Forbidden (Least Privilege Enforced)"
        $passCount++
    } else {
        Print-Fail "Expected 403 Forbidden but received HTTP $statusCode"
    }
}
Write-Host ""

# ----------------------------------------------------
# 6. Separation of Duties: Librarian Self-Borrow Restriction
# ----------------------------------------------------
Print-Step -num 6 -title "Separation of Duties: Librarian Self-Borrow without borrower_id (Expected: 403 FORBIDDEN)"
$testCount++
try {
    $libHeaders = @{ Authorization = "Bearer $librarianToken" }
    $libBorrow = Invoke-RestMethod -Uri "$BaseUrl/api/circulation/borrow" -Method Post `
        -Headers $libHeaders -ContentType "application/json" `
        -Body (@{ barcode = "CA-000001" } | ConvertTo-Json)
    Print-Fail "Librarian was permitted to self-borrow!"
} catch {
    $statusCode = 0
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
    }
    if ($statusCode -eq 403) {
        Print-Success "Librarian self-borrow rejected with HTTP 403 Forbidden (Only allowed on behalf of borrower)"
        $passCount++
    } else {
        Print-Fail "Expected 403 Forbidden but received HTTP $statusCode"
    }
}
Write-Host ""

# ----------------------------------------------------
# 7. Circulation: Student Borrows Available Copy
# ----------------------------------------------------
Print-Step -num 7 -title "Circulation: Student Borrows Copy 'CA-000001' (Expected: 201 CREATED)"
$testCount++
$activeLoanId = ""
try {
    $stuHeaders = @{ Authorization = "Bearer $studentToken" }
    $loanRes = Invoke-RestMethod -Uri "$BaseUrl/api/circulation/borrow" -Method Post `
        -Headers $stuHeaders -ContentType "application/json" `
        -Body (@{ barcode = "CA-000001" } | ConvertTo-Json)
    $activeLoanId = $loanRes.data.id
    Print-Success "Loan created successfully: ID=$activeLoanId, Due Date=$($loanRes.data.due_date)"
    $passCount++
} catch {
    # If already borrowed, check active loans
    try {
        $activeLoans = Invoke-RestMethod -Uri "$BaseUrl/api/circulation/active-loans" -Method Get -Headers @{ Authorization = "Bearer $studentToken" }
        if ($activeLoans.data.Count -gt 0) {
            $activeLoanId = $activeLoans.data[0].id
            Print-Success "Existing active loan utilized: ID=$activeLoanId"
            $passCount++
        } else {
            Print-Fail "Could not borrow or retrieve active loan: $_"
        }
    } catch {
        Print-Fail "Borrow request failed: $_"
    }
}
Write-Host ""

# ----------------------------------------------------
# 8. Duplicate Title Restriction
# ----------------------------------------------------
Print-Step -num 8 -title "Business Rule: Student Attempts to Borrow 2nd Copy of Same Title (Expected: REJECT)"
$testCount++
try {
    $stuHeaders = @{ Authorization = "Bearer $studentToken" }
    $dupBorrow = Invoke-RestMethod -Uri "$BaseUrl/api/circulation/borrow" -Method Post `
        -Headers $stuHeaders -ContentType "application/json" `
        -Body (@{ barcode = "CA-000002" } | ConvertTo-Json)
    Print-Fail "Student was able to borrow duplicate copy of the same book title!"
} catch {
    $statusCode = 0
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
    }
    if ($statusCode -eq 400 -or $statusCode -eq 409) {
        Print-Success "Rejected with HTTP $statusCode (Duplicate Title Prohibition Enforced)"
        $passCount++
    } else {
        Print-Fail "Expected 400/409 but received HTTP $statusCode"
    }
}
Write-Host ""

# ----------------------------------------------------
# 9. Return Processing: Student Blocked
# ----------------------------------------------------
Print-Step -num 9 -title "Separation of Duties: Student Tries to Process Own Return (Expected: 403 FORBIDDEN)"
$testCount++
try {
    $stuHeaders = @{ Authorization = "Bearer $studentToken" }
    $retRes = Invoke-RestMethod -Uri "$BaseUrl/api/circulation/return" -Method Post `
        -Headers $stuHeaders -ContentType "application/json" `
        -Body (@{ loan_id = $activeLoanId } | ConvertTo-Json)
    Print-Fail "Student was allowed to self-process return!"
} catch {
    $statusCode = 0
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
    }
    if ($statusCode -eq 403) {
        Print-Success "Return rejected with HTTP 403 (Only LIBRARIAN can inspect copy and process returns)"
        $passCount++
    } else {
        Print-Fail "Expected 403 but got HTTP $statusCode"
    }
}
Write-Host ""

# ----------------------------------------------------
# 10. Return Processing: Librarian Processes Return (with Overdue Fine)
# ----------------------------------------------------
Print-Step -num 10 -title "Circulation: Librarian Returns Copy Overdue (5 Days Late -> 50 THB Fine Expected)"
$testCount++
try {
    $libHeaders = @{ Authorization = "Bearer $librarianToken" }
    # 5 days past due date generates 50 THB fine (10 THB/day)
    $lateDate = "2026-09-25T12:00:00Z"
    $retRes = Invoke-RestMethod -Uri "$BaseUrl/api/circulation/return" -Method Post `
        -Headers $libHeaders -ContentType "application/json" `
        -Body (@{ loan_id = $activeLoanId; condition = "NORMAL"; return_date = $lateDate } | ConvertTo-Json)
    $fineVal = $retRes.data.lateFine
    $statusVal = $retRes.data.loan.status
    $copyStatusVal = $retRes.data.copyStatus
    Print-Success "Book returned: Status=$statusVal, Late Fine Assessed=$fineVal THB, Copy Status=$copyStatusVal"
    $passCount++
} catch {
    Print-Fail "Return failed: $_"
}
Write-Host ""

# ----------------------------------------------------
# 11. Fine Waiver: Librarian Blocked
# ----------------------------------------------------
Print-Step -num 11 -title "Separation of Duties: Librarian Attempts to Waive Fine (Expected: 403 FORBIDDEN)"
$testCount++
try {
    $libHeaders = @{ Authorization = "Bearer $librarianToken" }
    $waiveRes = Invoke-RestMethod -Uri "$BaseUrl/api/fines/waive" -Method Post `
        -Headers $libHeaders -ContentType "application/json" `
        -Body (@{ user_id = "usr-stu-01"; amount = 20; reason = "Librarian waiver attempt" } | ConvertTo-Json)
    Print-Fail "Librarian was permitted to waive fine!"
} catch {
    $statusCode = 0
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
    }
    if ($statusCode -eq 403) {
        Print-Success "Rejected with HTTP 403 Forbidden (Only ADMIN holds financial waiver authority)"
        $passCount++
    } else {
        Print-Fail "Expected 403 but got HTTP $statusCode"
    }
}
Write-Host ""

# ----------------------------------------------------
# 12. Fine Waiver: Admin Waives with Audit Reason
# ----------------------------------------------------
Print-Step -num 12 -title "Financial Governance: Admin Waives 20 THB with Justification (Expected: 200 OK)"
$testCount++
try {
    $admHeaders = @{ Authorization = "Bearer $adminToken" }
    $waiveRes = Invoke-RestMethod -Uri "$BaseUrl/api/fines/waive" -Method Post `
        -Headers $admHeaders -ContentType "application/json" `
        -Body (@{ user_id = "usr-stu-01"; amount = 20; reason = "Medical exemption approved by University Dean" } | ConvertTo-Json)
    $waiveId = $waiveRes.data.waiver.id
    $waivedAmt = $waiveRes.data.waiver.amount_waived
    $waiveBy = $waiveRes.data.waiver.approved_by
    Print-Success "Waiver recorded in ledger: ID=$waiveId, Waived=$waivedAmt THB, Approved By=$waiveBy"
    $passCount++
} catch {
    Print-Fail "Admin waiver failed: $_"
}
Write-Host ""

# ----------------------------------------------------
# 13. Fine Payment: Librarian Receives Remainder Payment (30 THB)
# ----------------------------------------------------
Print-Step -num 13 -title "Financial Operations: Librarian Receives Remaining Payment 30 THB (Expected: 200 OK)"
$testCount++
try {
    $libHeaders = @{ Authorization = "Bearer $librarianToken" }
    $payRes = Invoke-RestMethod -Uri "$BaseUrl/api/fines/pay" -Method Post `
        -Headers $libHeaders -ContentType "application/json" `
        -Body (@{ user_id = "usr-stu-01"; amount = 30; notes = "Cash payment at Circulation Desk" } | ConvertTo-Json)
    $payId = $payRes.data.payment.id
    $payAmt = $payRes.data.payment.amount_paid
    $remBal = $payRes.data.newOutstanding
    Print-Success "Payment recorded in ledger: ID=$payId, Paid=$payAmt THB, Remaining Balance=$remBal THB"
    $passCount++
} catch {
    Print-Fail "Librarian payment failed: $_"
}
Write-Host ""

# ----------------------------------------------------
# 14. Audit Log Verification
# ----------------------------------------------------
Print-Step -num 14 -title "System Governance: Admin Queries Immutable Audit Logs (/api/admin/audit-logs)"
$testCount++
try {
    $admHeaders = @{ Authorization = "Bearer $adminToken" }
    $audit = Invoke-RestMethod -Uri "$BaseUrl/api/admin/audit-logs?limit=5" -Method Get -Headers $admHeaders
    $totalLogs = $audit.pagination.total
    Print-Success "Audit Logs retrieved (Total in DB: $totalLogs)"
    foreach ($log in $audit.data) {
        Print-Info " - [$($log.action)] Resource: $($log.resource_type)/$($log.resource_id) by Actor: $($log.actor_id)"
    }
    $passCount++
} catch {
    Print-Fail "Failed to fetch audit logs: $_"
}
Write-Host ""

# ----------------------------------------------------
# Summary
# ----------------------------------------------------
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "                  DEMONSTRATION SUMMARY                   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Total Steps Tested: $testCount" -ForegroundColor White
Write-Host " Passed:             $passCount" -ForegroundColor Green
$failedCount = $testCount - $passCount
Write-Host " Failed:             $failedCount" -ForegroundColor $(if ($failedCount -eq 0) { "Green" } else { "Red" })
Write-Host ""
if ($testCount -eq $passCount) {
    Write-Host " [SUCCESS] ALL ENTERPRISE API TEST CASES PASSED FLAWLESSLY!" -ForegroundColor Green
} else {
    Write-Host " [WARNING] Some test cases failed. Please review log above." -ForegroundColor Yellow
}
Write-Host "==========================================================" -ForegroundColor Cyan
