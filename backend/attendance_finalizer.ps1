# REMS Attendance Heartbeat Script
# Purpose: Automatically enforces the Global Attendance Policy 
#          by running the finalizer command in a loop.

Write-Host "--- REMS Attendance Finalizer Service Started ---" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop this service."

while ($true) {
    $now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$now] Checking policies & auto-checking out sessions..." -ForegroundColor Gray
    
    try {
        python manage.py finalize_attendance
    } catch {
        Write-Host "Error running finalizer: $_" -ForegroundColor Red
    }
    
    # Wait for 60 seconds before next check
    Start-Sleep -Seconds 60
}
