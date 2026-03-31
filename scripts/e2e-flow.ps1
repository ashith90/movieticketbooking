param(
  [string]$GatewayUrl = "http://localhost:4000",
  [string]$UserServiceUrl = "http://localhost:5001",
  [string]$BookingServiceUrl = "http://localhost:5003",
  [string]$PaymentServiceUrl = "http://localhost:5004",
  [string]$NotificationServiceUrl = "http://localhost:5005",
  [string]$Password = "Pass@12345",
  [string]$LogPath = ".\\e2e-debug.log"
)

$ErrorActionPreference = "Stop"
$script:StepCounter = 0
$script:LogWriter = $null

if (Test-Path $LogPath) {
  Remove-Item $LogPath -Force
}

$script:LogWriter = New-Object System.IO.StreamWriter($LogPath, $true, [System.Text.Encoding]::UTF8)
$script:LogWriter.AutoFlush = $true

function Write-LogLine {
  param([string]$Message)

  if ($script:LogWriter -ne $null) {
    $script:LogWriter.WriteLine($Message)
  }
}

function Write-Step {
  param([string]$Message)

  $script:StepCounter += 1
  $line = "[STEP $($script:StepCounter)] $Message"
  Write-Host $line
  Write-LogLine $line
}

function Write-DebugLog {
  param([string]$Message)

  $line = "[DEBUG] $Message"
  Write-Host $line
  Write-LogLine $line
}

function Invoke-JsonApi {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Url,
    [hashtable]$Headers,
    $Body,
    [int]$MaxRetries = 5,
    [int]$RetryDelaySeconds = 2
  )

  $params = @{
    Method = $Method
    Uri = $Url
  }

  if ($Headers) {
    $params.Headers = $Headers
  }

  if ($null -ne $Body) {
    $params.ContentType = "application/json"
    $params.Body = ($Body | ConvertTo-Json -Depth 10)
  }

  for ($attempt = 1; $attempt -le $MaxRetries; $attempt++) {
    try {
      Write-DebugLog "HTTP $Method $Url (attempt $attempt/$MaxRetries)"
      return Invoke-RestMethod @params
    } catch {
      $statusCode = "N/A"
      if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
        $statusCode = [int]$_.Exception.Response.StatusCode
      }
      Write-DebugLog "Request failed: status=$statusCode message=$($_.Exception.Message)"
      if ($attempt -eq $MaxRetries) {
        throw
      }
      Start-Sleep -Seconds $RetryDelaySeconds
    }
  }
}

function Wait-ForGateway {
  param(
    [Parameter(Mandatory = $true)][string]$BaseUrl,
    [int]$MaxAttempts = 30,
    [int]$DelaySeconds = 2
  )

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    try {
      $health = Invoke-JsonApi -Method "GET" -Url "$BaseUrl/api/v1/health" -MaxRetries 1
      if ($health.status -eq "ok") {
        return
      }
      Start-Sleep -Seconds $DelaySeconds
    } catch {
      Start-Sleep -Seconds $DelaySeconds
    }
  }

  throw "Gateway health check failed after retries"
}

function Wait-ForServiceHealth {
  param(
    [Parameter(Mandatory = $true)][string]$HealthUrl,
    [Parameter(Mandatory = $true)][string]$ServiceName,
    [int]$MaxAttempts = 30,
    [int]$DelaySeconds = 2
  )

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    try {
      $health = Invoke-JsonApi -Method "GET" -Url $HealthUrl -MaxRetries 1
      if ($health.status -eq "ok") {
        return
      }
      Start-Sleep -Seconds $DelaySeconds
    } catch {
      Start-Sleep -Seconds $DelaySeconds
    }
  }

  throw "$ServiceName health check failed after retries"
}

function Wait-ForCondition {
  param(
    [Parameter(Mandatory = $true)][scriptblock]$Condition,
    [Parameter(Mandatory = $true)][string]$TimeoutMessage,
    [int]$MaxAttempts = 30,
    [int]$DelaySeconds = 2
  )

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    if (& $Condition) {
      return
    }
    Start-Sleep -Seconds $DelaySeconds
  }

  throw $TimeoutMessage
}

function Write-DiagnosticPayload {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    $Payload
  )

  try {
    if ($null -eq $Payload) {
      Write-LogLine "[DIAG] ${Label}: <null>"
      return
    }

    $json = $Payload | ConvertTo-Json -Depth 10 -Compress
    Write-LogLine "[DIAG] ${Label}: $json"
  } catch {
    Write-LogLine "[DIAG] ${Label}: <unserializable> $($_.Exception.Message)"
  }
}

function Write-FailureDiagnostics {
  param(
    [Parameter(Mandatory = $true)][string]$GatewayUrl,
    [Parameter(Mandatory = $true)][string]$UserServiceUrl,
    [Parameter(Mandatory = $true)][string]$BookingServiceUrl,
    [Parameter(Mandatory = $true)][string]$PaymentServiceUrl,
    [Parameter(Mandatory = $true)][string]$NotificationServiceUrl,
    [hashtable]$AuthHeaders,
    [string]$BookingId,
    [string]$PaymentId
  )

  Write-LogLine "[DIAG] Starting failure diagnostics"

  $healthEndpoints = @(
    @{ Label = "gateway.health"; Url = "$GatewayUrl/api/v1/health" },
    @{ Label = "user.health"; Url = "$UserServiceUrl/health" },
    @{ Label = "booking.health"; Url = "$BookingServiceUrl/health" },
    @{ Label = "payment.health"; Url = "$PaymentServiceUrl/health" },
    @{ Label = "notification.health"; Url = "$NotificationServiceUrl/health" }
  )

  foreach ($endpoint in $healthEndpoints) {
    try {
      $health = Invoke-JsonApi -Method "GET" -Url $endpoint.Url -MaxRetries 1
      Write-DiagnosticPayload -Label $endpoint.Label -Payload $health
    } catch {
      Write-LogLine "[DIAG] $($endpoint.Label): request failed - $($_.Exception.Message)"
    }
  }

  if ($AuthHeaders) {
    try {
      $myBookings = Invoke-JsonApi -Method "GET" -Url "$GatewayUrl/api/v1/bookings/me" -Headers $AuthHeaders -MaxRetries 1
      Write-DiagnosticPayload -Label "bookings.me" -Payload $myBookings

      if ($BookingId) {
        $bookingRecord = $myBookings | Where-Object { $_.bookingId -eq $BookingId } | Select-Object -First 1
        Write-DiagnosticPayload -Label "booking.target" -Payload $bookingRecord
      }
    } catch {
      Write-LogLine "[DIAG] bookings.me: request failed - $($_.Exception.Message)"
    }

    try {
      $notificationLogs = Invoke-JsonApi -Method "GET" -Url "$GatewayUrl/api/v1/notifications/logs" -Headers $AuthHeaders -MaxRetries 1
      if ($BookingId) {
        $notificationLogs = @($notificationLogs | Where-Object { $_.payload.bookingId -eq $BookingId })
      }
      Write-DiagnosticPayload -Label "notifications.logs" -Payload $notificationLogs
    } catch {
      Write-LogLine "[DIAG] notifications.logs: request failed - $($_.Exception.Message)"
    }

    if ($PaymentId) {
      try {
        $payment = Invoke-JsonApi -Method "GET" -Url "$GatewayUrl/api/v1/payments/$PaymentId" -Headers $AuthHeaders -MaxRetries 1
        Write-DiagnosticPayload -Label "payment.target" -Payload $payment
      } catch {
        Write-LogLine "[DIAG] payment.target: request failed - $($_.Exception.Message)"
      }
    }
  } else {
    Write-LogLine "[DIAG] auth headers unavailable; skipping booking/payment/notification diagnostic endpoints"
  }
}

try {
  $bookingId = $null
  $paymentId = $null
  $authHeaders = $null

  Write-Host "Starting e2e booking flow..."
  Write-LogLine "Starting e2e booking flow..."
  Write-DebugLog "GatewayUrl=$GatewayUrl UserServiceUrl=$UserServiceUrl BookingServiceUrl=$BookingServiceUrl PaymentServiceUrl=$PaymentServiceUrl NotificationServiceUrl=$NotificationServiceUrl"

  Write-Step "Wait for gateway health"
  Wait-ForGateway -BaseUrl $GatewayUrl

  Write-Step "Wait for user service health"
  Wait-ForServiceHealth -HealthUrl "$UserServiceUrl/health" -ServiceName "user-service"

  Write-Step "Wait for booking service health"
  Wait-ForServiceHealth -HealthUrl "$BookingServiceUrl/health" -ServiceName "booking-service"

  Write-Step "Wait for payment service health"
  Wait-ForServiceHealth -HealthUrl "$PaymentServiceUrl/health" -ServiceName "payment-service"

  Write-Step "Wait for notification service health"
  Wait-ForServiceHealth -HealthUrl "$NotificationServiceUrl/health" -ServiceName "notification-service"

  Write-Step "Create user via signup"
  $unique = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $email = "e2e_$unique@example.com"
  $name = "E2E User $unique"

  $signupBody = @{
    email = $email
    password = $Password
    name = $name
    city = "Bengaluru"
  }

  $signup = Invoke-JsonApi -Method "POST" -Url "$GatewayUrl/api/v1/auth/signup" -Body $signupBody
  $token = $signup.token
  if (-not $token) {
    throw "Signup failed: token not received"
  }
  Write-DebugLog "Signup succeeded for email=$email"

  $authHeaders = @{ Authorization = "Bearer $token" }

  Write-Step "Fetch showtimes"
  $from = [DateTime]::UtcNow.AddHours(-1).ToString("o")
  $to = [DateTime]::UtcNow.AddDays(1).ToString("o")
  $showtimes = Invoke-JsonApi -Method "GET" -Url "$GatewayUrl/api/v1/catalog/showtimes?from=$([uri]::EscapeDataString($from))&to=$([uri]::EscapeDataString($to))" -MaxRetries 10 -RetryDelaySeconds 2

  if (-not $showtimes -or $showtimes.Count -eq 0) {
    throw "No showtimes found. Run seed steps first: movie-service seed and booking seat seed."
  }

  $showtime = $showtimes[0]
  $showtimeId = $showtime._id
  Write-Host "Using showtime: $showtimeId"
  Write-LogLine "Using showtime: $showtimeId"

  Write-Step "Fetch seat layout"
  $seatsResponse = Invoke-JsonApi -Method "GET" -Url "$GatewayUrl/api/v1/catalog/showtimes/$showtimeId/seats"
  if (-not $seatsResponse.seatLayout -or $seatsResponse.seatLayout.Count -lt 2) {
    throw "Seat layout missing or insufficient"
  }

  $candidateSeatIds = @($seatsResponse.seatLayout | ForEach-Object { $_.seatId } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  if ($candidateSeatIds.Count -lt 2) {
    throw "Seat layout contains fewer than 2 selectable seats"
  }

  Write-DebugLog "Candidate seats found: $($candidateSeatIds.Count)"

  Write-Step "Verify booking service readiness"
  $null = Invoke-JsonApi -Method "GET" -Url "$GatewayUrl/api/v1/bookings/me" -Headers $authHeaders -MaxRetries 6 -RetryDelaySeconds 2

  Write-Step "Lock seats"
  $seatIds = $null
  $lockResult = $null

  for ($i = 0; $i -lt ($candidateSeatIds.Count - 1); $i++) {
    $seatAttempt = @($candidateSeatIds[$i], $candidateSeatIds[$i + 1])
    $lockBody = @{
      showtimeId = $showtimeId
      seatIds = $seatAttempt
    }

    try {
      $lockResult = Invoke-JsonApi -Method "POST" -Url "$GatewayUrl/api/v1/bookings/locks" -Headers $authHeaders -Body $lockBody -MaxRetries 1
      $seatIds = $seatAttempt
      break
    } catch {
      $statusCode = "N/A"
      if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
        $statusCode = [int]$_.Exception.Response.StatusCode
      }

      if ($statusCode -eq 409) {
        Write-DebugLog "Seat pair unavailable: $($seatAttempt -join ', ')"
        continue
      }

      throw
    }
  }

  if (-not $seatIds) {
    throw "Unable to lock any seat pair from catalog seat layout"
  }

  Write-Host "Selected seats: $($seatIds -join ', ')"
  Write-LogLine "Selected seats: $($seatIds -join ', ')"
  Write-Host "Seats lock response: $($lockResult.message)"
  Write-LogLine "Seats lock response: $($lockResult.message)"

  Write-Step "Create booking"
  $bookingIdempotencyKey = [guid]::NewGuid().ToString()
  $createBookingBody = @{
    showtimeId = $showtimeId
    seats = $seatIds
    amount = [int]$showtime.basePrice * $seatIds.Count
    idempotencyKey = $bookingIdempotencyKey
  }

  $booking = Invoke-JsonApi -Method "POST" -Url "$GatewayUrl/api/v1/bookings" -Headers $authHeaders -Body $createBookingBody
  $bookingId = $booking.bookingId
  if (-not $bookingId) {
    throw "Booking ID not returned"
  }
  Write-Host "Created booking: $bookingId"
  Write-LogLine "Created booking: $bookingId"

  Write-Step "Create payment intent"
  $paymentIdempotencyKey = [guid]::NewGuid().ToString()
  $paymentIntentBody = @{
    bookingId = $bookingId
    amount = $booking.amount
    currency = "INR"
    idempotencyKey = $paymentIdempotencyKey
  }

  $payment = Invoke-JsonApi -Method "POST" -Url "$GatewayUrl/api/v1/payments/intents" -Headers $authHeaders -Body $paymentIntentBody
  $paymentId = $payment.paymentId
  if (-not $paymentId) {
    throw "Payment ID not returned"
  }
  Write-Host "Created payment intent: $paymentId"
  Write-LogLine "Created payment intent: $paymentId"

  Write-Step "Send payment success webhook"
  $webhookBody = @{
    paymentId = $paymentId
    status = "SUCCEEDED"
  }

  $null = Invoke-JsonApi -Method "POST" -Url "$PaymentServiceUrl/payments/webhook" -Body $webhookBody
  Write-Host "Payment webhook success sent"
  Write-LogLine "Payment webhook success sent"

  Write-Step "Wait for booking confirmation"
  Wait-ForCondition -TimeoutMessage "Booking not confirmed by saga" -MaxAttempts 60 -DelaySeconds 2 -Condition {
    $myBookings = Invoke-JsonApi -Method "GET" -Url "$GatewayUrl/api/v1/bookings/me" -Headers $authHeaders -MaxRetries 1
    $confirmed = $myBookings | Where-Object { $_.bookingId -eq $bookingId } | Select-Object -First 1
    return ($confirmed -and $confirmed.status -eq "CONFIRMED")
  }

  Write-Host "Booking confirmed by saga"
  Write-LogLine "Booking confirmed by saga"

  Write-Step "Request booking cancellation"
  $cancel = Invoke-JsonApi -Method "POST" -Url "$GatewayUrl/api/v1/bookings/$bookingId/cancel" -Headers $authHeaders -MaxRetries 5 -RetryDelaySeconds 2
  Write-Host "Cancel response received"
  Write-LogLine "Cancel response received"

  Write-Step "Wait for booking cancelled status"
  Wait-ForCondition -TimeoutMessage "Booking not cancelled after refund saga" -MaxAttempts 60 -DelaySeconds 2 -Condition {
    $myBookingsAfterCancel = Invoke-JsonApi -Method "GET" -Url "$GatewayUrl/api/v1/bookings/me" -Headers $authHeaders -MaxRetries 1
    $cancelled = $myBookingsAfterCancel | Where-Object { $_.bookingId -eq $bookingId } | Select-Object -First 1
    return ($cancelled -and $cancelled.status -eq "CANCELLED")
  }

  Write-Host "Booking cancelled after refund saga"
  Write-LogLine "Booking cancelled after refund saga"

  Write-Step "Validate notification logs"
  Wait-ForCondition -TimeoutMessage "Notification logs missing cancellation or refund events" -MaxAttempts 90 -DelaySeconds 2 -Condition {
    $logs = Invoke-JsonApi -Method "GET" -Url "$GatewayUrl/api/v1/notifications/logs" -Headers $authHeaders -MaxRetries 1
    $bookingCancelledLog = $logs | Where-Object { $_.eventType -eq "BOOKING_CANCELLED" -and $_.payload.bookingId -eq $bookingId } | Select-Object -First 1
    $paymentRefundedLog = $logs | Where-Object { $_.eventType -eq "PAYMENT_REFUNDED" -and $_.payload.bookingId -eq $bookingId } | Select-Object -First 1
    return ($bookingCancelledLog -and $paymentRefundedLog)
  }

  Write-Host "E2E flow passed successfully"
  Write-Host "Booking ID: $bookingId"
  Write-Host "Payment ID: $paymentId"
  Write-LogLine "E2E flow passed successfully"
  Write-LogLine "Booking ID: $bookingId"
  Write-LogLine "Payment ID: $paymentId"
  Write-LogLine "E2E_EXIT:0"
}
catch {
  Write-LogLine "E2E_EXIT:1"
  Write-LogLine "ERROR: $($_.Exception.Message)"

  try {
    Write-FailureDiagnostics `
      -GatewayUrl $GatewayUrl `
      -UserServiceUrl $UserServiceUrl `
      -BookingServiceUrl $BookingServiceUrl `
      -PaymentServiceUrl $PaymentServiceUrl `
      -NotificationServiceUrl $NotificationServiceUrl `
      -AuthHeaders $authHeaders `
      -BookingId $bookingId `
      -PaymentId $paymentId
  } catch {
    Write-LogLine "[DIAG] Failed to collect diagnostics: $($_.Exception.Message)"
  }

  throw
}
finally {
  if ($script:LogWriter -ne $null) {
    $script:LogWriter.Dispose()
    $script:LogWriter = $null
  }
}
