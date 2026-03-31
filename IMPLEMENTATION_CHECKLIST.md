# Production Hardening Checklist (Repo-Specific)

## Priority 0 (This Week)

### Gateway
- [ ] Add request-id middleware and propagate `x-request-id`
- [ ] Enforce strict CORS origin allowlist from env
- [ ] Split rate-limit policies by route group (auth, read, write)
- [ ] Add standardized response envelope for proxied errors
- [ ] Add `/ready` endpoint in addition to `/health`

### User Service
- [ ] Implement refresh token issue/rotation/revocation
- [ ] Move access/refresh tokens to secure httpOnly cookies
- [ ] Add login/signup request schema validation (Zod)
- [ ] Add brute-force protection for login endpoint

### Movie Service
- [ ] Add Zod validation for movie/showtime write routes
- [ ] Add index checks for movie/showtime query paths
- [ ] Add cache invalidation hooks on movie/showtime writes

### Booking Service
- [ ] Add idempotency key support to booking confirm and cancel
- [ ] Harden lock expiration cleanup worker
- [ ] Add race-condition test for 20+ concurrent same-seat attempts
- [ ] Ensure all booking transitions use strict finite state machine

### Payment Service
- [ ] Add provider webhook signature verification guard
- [ ] Add idempotency on webhook processing by event ID
- [ ] Add payment retry classification (transient vs terminal)

### Notification Service
- [ ] Add dedupe on event processing by event ID
- [ ] Add retry with DLQ strategy

## Priority 1 (Next 2 Weeks)

### Security and config
- [ ] Add environment schema validation at process start for every service
- [ ] Move secrets to external secret store for non-local envs
- [ ] Add dependency and container vulnerability scans in CI

### Observability
- [ ] Add structured logger package and standard fields
- [ ] Add Prometheus metrics endpoint in each service
- [ ] Add Sentry integration for gateway + all services
- [ ] Add Grafana dashboards for latency/error/booking/payment

### Performance
- [ ] Add Redis caching for catalog read endpoints
- [ ] Add paginated APIs for bookings/notifications/movies
- [ ] Add Mongo indexes and explain-plan verification scripts

## Priority 2 (Weeks 3-6)

### Frontend
- [ ] Add protected/admin route wrappers in React app
- [ ] Add axios interceptors + silent refresh token flow
- [ ] Add global error boundary and skeleton states
- [ ] Add optimistic UI + rollback on seat lock failures

### Real-time
- [ ] Add Socket.io channel per show for seat updates
- [ ] Emit lock/book/release events from booking-service
- [ ] Reconcile websocket events with authoritative API state

### Admin and analytics
- [ ] Add theatre CRUD and show scheduling pages
- [ ] Add booking/revenue analytics widgets
- [ ] Add audit trail for admin mutations

## CI/CD

- [ ] PR pipeline: lint + unit + integration + build + security scan
- [ ] Main pipeline: deploy staging + smoke tests
- [ ] Manual approval to production
- [ ] Canary rollout and automatic rollback on SLO breach

## Definition of Done (Production)

- [ ] No double booking in stress test
- [ ] P95 and error budgets meet SLO for 14 days
- [ ] Secrets and key rotation policy implemented
- [ ] Monitoring, alerts, and runbooks available
- [ ] Backup/restore drill passed
