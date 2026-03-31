# Movie Booking Microservices (Node.js + Express + MongoDB)

Initial scaffold includes:
- API Gateway
- User Service
- Booking Service (with Redis-based seat locks)
- Movie Service
- Payment Service
- Notification Service (Kafka consumer)
- MongoDB, Redis, Kafka (via Docker Compose)

## Architecture (current)
- Gateway routes `/api/v1/users/*` -> User Service
- Gateway routes `/api/v1/auth/*` -> User Service auth
- Gateway routes `/api/v1/bookings/*` -> Booking Service
- Gateway routes `/api/v1/catalog/*` -> Movie Service
- Gateway routes `/api/v1/payments/*` -> Payment Service
- Gateway routes `/api/v1/notifications/*` -> Notification Service
- Booking Service uses MongoDB for booking and seat state
- Booking Service uses Redis locks with TTL to reduce double-booking races
- Booking and Payment services publish domain events from Outbox tables
- Notification service consumes booking and payment events from Kafka

## Quick Start

1. From project root:
```bash
docker compose up --build
```

2. Seed movie catalog and note printed showtime IDs:
```bash
docker compose exec movie-service npm run seed
```

3. Seed booking seat inventory for one of those showtimes:
```bash
docker compose exec booking-service sh -c "SHOWTIME_ID=<paste-showtime-id> npm run seed:seats"
```

4. Health checks:
```bash
curl http://localhost:4000/api/v1/health
curl http://localhost:5001/health
curl http://localhost:5002/health
curl http://localhost:5003/health
curl http://localhost:5004/health
curl http://localhost:5005/health
```

## Web App Demo (Gateway UI)
- Open `http://localhost:4000`
- Sign up or login
- Select a showtime
- Select seats
- Click `Lock + Book + Pay` to run booking plus payment success simulation
- View booking status updates and cancel from `My Bookings`

Note: the UI calls gateway APIs under `/api/v1/*` and uses local storage for demo auth token persistence.

## Key Endpoints

### User Service (through gateway)
- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/login`
- `GET /api/v1/users/me` (Authorization: Bearer <token>)
- `PUT /api/v1/users/me`

### Movie Service (through gateway)
- `GET /api/v1/catalog/cities`
- `GET /api/v1/catalog/movies`
- `GET /api/v1/catalog/theaters?cityId=<cityId>`
- `GET /api/v1/catalog/showtimes?cityName=<cityName>&from=<ISO>&to=<ISO>`
- `GET /api/v1/catalog/showtimes/:showtimeId/seats`

### Booking Service (through gateway)
- `POST /api/v1/bookings/locks` (Authorization: Bearer <token>)
- `POST /api/v1/bookings` (Authorization: Bearer <token>)
- `POST /api/v1/bookings/:bookingId/confirm` (Authorization: Bearer <token>)
- `POST /api/v1/bookings/:bookingId/cancel` (Authorization: Bearer <token>)
- `GET /api/v1/bookings/me` (Authorization: Bearer <token>)

### Payment Service (through gateway)
- `POST /api/v1/payments/intents` (Authorization: Bearer <token>)
- `GET /api/v1/payments/:paymentId` (Authorization: Bearer <token>)
- `POST /api/v1/payments/webhook` (provider callback)

### Notification Service (through gateway)
- `GET /api/v1/notifications/logs` (Authorization: Bearer <token>)

## Concurrency Notes
- Redis `SET NX EX` per seat lock key provides short reservation lock.
- Mongo seat documents track `AVAILABLE`, `LOCKED`, `BOOKED` states.
- Booking creation validates lock ownership and lock expiry.

## Event Flow
- Payment webhook updates payment state.
- Payment service writes outbox event, then publisher sends to Kafka topic `payment.events`.
- Booking service consumes payment events as saga steps:
	- `PAYMENT_SUCCEEDED` -> confirm booking and mark seats as `BOOKED`
	- `PAYMENT_FAILED` -> cancel booking and release locked seats
- Booking cancellation path:
	- User calls `POST /bookings/:bookingId/cancel`
	- Booking emits `BOOKING_CANCEL_REQUESTED`
	- Payment consumes it, marks payment `REFUNDED`, emits `PAYMENT_REFUNDED`
	- Booking consumes `PAYMENT_REFUNDED`, marks booking `CANCELLED`, releases seats
- Booking confirmation/cancellation writes outbox events to Kafka topic `booking.events`.
- Notification service consumer subscribes to both topics and records delivery logs.

## Next Implementation Steps
- Add cancellation and refund events into saga flow
- Add Mongo transactions around seat state and booking writes
- Replace mock payment provider with Stripe or Razorpay adapter

## Optional Local Seed (without Docker)
- In `services/movie-service`: `npm run seed`
- In `services/booking-service`: `SHOWTIME_ID=<showtime-id> npm run seed:seats`

## Automated End-to-End Flow Test
Run this PowerShell script after services are up and data is seeded:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\e2e-flow.ps1
```

Debug logs are written to:
- `.\e2e-debug.log`

You can override log location:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\e2e-flow.ps1 -LogPath .\my-e2e.log
```

It validates this sequence:
- Signup and login token usage
- Browse showtimes and seat layout
- Seat lock and booking creation (auto-fallback across seat pairs if a pair is already locked)
- Payment webhook success -> booking confirmed via saga
- Booking cancellation -> refund saga -> booking cancelled
- Notification logs include `PAYMENT_REFUNDED` and `BOOKING_CANCELLED`

Resilience behavior in the script:
- Waits for gateway, user, booking, payment, and notification health endpoints before starting flow actions.
- Uses extended polling windows for saga confirmation/cancellation and notification log visibility.
- On failure, appends diagnostic snapshots to the same log file (service health, bookings, payment, and notification records when available).

To run multiple local attempts in one command:
```powershell
for ($i = 1; $i -le 3; $i++) { powershell -ExecutionPolicy Bypass -File .\scripts\e2e-flow.ps1 -LogPath ".\e2e-run-$i.log" }
```

## CI Pipeline
GitHub Actions workflow is available at:
- `.github/workflows/ci-e2e.yml`
- `.github/workflows/ci-pr-fast.yml`

It runs on push and pull requests, then:
- Starts full Docker Compose stack
- Waits for gateway health
- Seeds catalog and seat inventory
- Runs `scripts/e2e-flow.ps1` three consecutive times to reduce flaky pass risk
- Validates `E2E_EXIT:0` marker in each run log
- Uploads diagnostics artifacts on failure (compose logs, service health responses, showtimes response, and all E2E run logs)

Fast PR checks workflow:
- Runs JavaScript syntax checks (`node --check`) across the repository
- Runs Docker Compose smoke startup and gateway health validation
- Seeds catalog and seat inventory, then runs `scripts/e2e-flow.ps1` two consecutive times
- Validates `E2E_EXIT:0` marker in each fast-run log and uploads diagnostics on failure

## Branch Protection
Recommended branch protection rules are documented in:
- `.github/BRANCH_PROTECTION.md`
