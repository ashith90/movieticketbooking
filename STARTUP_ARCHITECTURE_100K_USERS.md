# Cinema Pulse Startup Architecture (100K Users/Day)

## 1) Target and Capacity Model

### Traffic assumptions
- Daily active users: 100,000
- Peak concurrency: 6% of DAU active in peak window = 6,000 concurrent users
- Peak read:write ratio: 85:15
- Peak requests per second at gateway: 800-1,200 RPS (reads dominate)
- Peak booking attempts: 40-80 booking attempts/sec during high-demand windows

### SLOs
- API availability: 99.9%
- P95 latency:
  - Catalog APIs: < 250ms
  - Booking lock APIs: < 350ms
  - Payment confirm APIs: < 500ms
- Booking correctness: zero double-booking (hard requirement)

## 2) Recommended Production Topology

### Edge and delivery
- Cloudflare CDN + WAF in front of frontend and API domain
- Frontend static assets on Vercel (or CloudFront + S3 if AWS-only)
- API domain routed to Kubernetes Ingress (or managed load balancer)

### Core platform
- Container orchestration: Kubernetes (EKS/GKE/AKS)
- API gateway: existing gateway service, horizontally scaled
- Services:
  - user-service
  - movie-service
  - booking-service
  - payment-service
  - notification-service
- Event bus: Kafka (managed preferred)
- Cache/locking: Redis (managed, replication enabled)
- Database:
  - MongoDB Atlas (M30+ initially, autoscaling enabled)
  - Dedicated clusters for prod and staging

### Data ownership
- user-service owns users/auth profile data
- movie-service owns catalog/theatre/show metadata
- booking-service owns seat inventory state and booking lifecycle
- payment-service owns payment lifecycle and provider reconciliation
- notification-service owns delivery logs and outbound communications

## 3) Service Scaling Strategy

### Stateless services (horizontal autoscaling)
- gateway: 4-12 replicas, CPU-based HPA + request-based target
- user-service: 2-8 replicas
- movie-service: 3-10 replicas
- booking-service: 4-16 replicas (critical path)
- payment-service: 3-10 replicas
- notification-service: 2-8 replicas

### Baseline resource sizing (starting point)
- gateway: 300m CPU / 512Mi RAM per pod
- user-service: 250m / 384Mi
- movie-service: 300m / 512Mi
- booking-service: 500m / 1Gi
- payment-service: 350m / 768Mi
- notification-service: 250m / 512Mi

### Autoscaling triggers
- CPU > 65%
- Memory > 75%
- Booking queue lag threshold (Kafka consumer lag)
- Custom metric: seat-lock latency P95 threshold

## 4) Critical Booking Consistency Design

### Seat locking flow (authoritative path)
1. Client requests lock for selected seats
2. booking-service acquires Redis distributed locks (per showId + seatId) with TTL
3. booking-service writes PENDING booking in Mongo with lock expiration timestamp
4. Client starts payment
5. Payment webhook success triggers booking confirmation event
6. booking-service atomically transitions seats to BOOKED and booking to CONFIRMED
7. On timeout/failure, booking-service releases lock and marks booking CANCELLED

### Double-booking prevention controls
- Redis lock key format: lock:show:{showId}:seat:{seatId}
- Lock TTL: 5-8 minutes
- Mongo unique compound index on seat inventory documents: (showId, seatId)
- Idempotency key on booking confirmation and payment callback
- Strict state machine transitions; reject illegal state jumps

## 5) Security Hardening (Production Baseline)

### API security
- Helmet enabled everywhere
- Strict CORS allowlist by environment
- Rate limiting by route class:
  - auth endpoints: strict
  - catalog reads: moderate
  - booking/payment writes: strict + burst control
- Input validation (Zod/Joi) on all mutation endpoints
- Mongo injection sanitization + XSS sanitization
- Request size limits and timeout guards

### Auth and session
- Access token (short TTL: 15m)
- Refresh token (long TTL: 30d) with rotation and revoke support
- Store tokens in secure httpOnly cookies (SameSite=None, Secure in prod)
- Role-based route guards (admin/user)

### Secrets
- No secrets in repo
- Use cloud secrets manager (AWS Secrets Manager/GCP Secret Manager/Vault)
- Rotate JWT and provider keys periodically

## 6) Performance and Caching

### Read-path caching
- Cache popular catalog endpoints in Redis (TTL 30-120s)
- Cache theatre/showtime aggregates by city/movie filters
- Invalidate cache on admin updates (movie/show write paths)

### Database optimization
- Add/verify indexes:
  - shows: (movieId, startTime), (theatreId, startTime), (cityName, startTime)
  - bookings: (userId, createdAt), (status, createdAt)
  - payments: (bookingId), (status, createdAt)
- Use projections and pagination for list APIs
- Avoid expensive unbounded queries from gateway

### Frontend optimization
- Route-based code splitting
- Lazy load admin modules
- Skeleton UIs for all slow pages
- CDN caching headers for static assets

## 7) Event-Driven Reliability

### Outbox pattern
- Keep outbox publisher in booking/payment services
- Persist events in local DB transaction with business state changes
- Publisher retries with backoff and dead-letter strategy

### Kafka standards
- Versioned event contracts
- Idempotent consumers (dedupe by eventId)
- DLQ topic and replay tooling
- Monitor consumer lag and processing latency

## 8) Observability and Operations

### Logging
- Structured JSON logs (service, requestId, userId, route, status, latencyMs)
- Centralized log aggregation (ELK/OpenSearch/Datadog)

### Metrics
- Prometheus + Grafana dashboards
- Core dashboards:
  - API latency/error rates
  - booking lock success/failure
  - payment success/failure
  - Kafka lag
  - Mongo/Redis health

### Tracing
- OpenTelemetry for distributed traces across gateway + services

### Error tracking
- Sentry for all backend services and frontend

## 9) CI/CD Pipeline (Production Grade)

### Branching model
- main: production
- develop: staging
- feature/*: PR environments optional

### Pipeline stages
1. Lint + static analysis
2. Unit tests
3. Integration tests
4. Build images
5. Security scan (SCA + container scan)
6. Deploy to staging
7. Smoke tests + synthetic booking flow
8. Manual approval
9. Progressive prod rollout (canary/blue-green)
10. Post-deploy health checks and auto rollback rules

## 10) Deployment Blueprint

### Environments
- dev: docker-compose local
- staging: small Kubernetes cluster mirroring prod topology
- prod: managed Kubernetes + managed Mongo/Redis/Kafka

### Domain and TLS
- app.cinemapulse.com -> frontend
- api.cinemapulse.com -> gateway ingress
- TLS via managed certs
- HSTS enabled

### Rollback strategy
- Keep previous 2 image tags hot
- Health-check based rollback automation
- DB migrations backward compatible (expand-and-contract)

## 11) Data and Compliance

- Automated daily backups for MongoDB with retention policy
- PITR enabled for production cluster
- Audit logs for admin actions and critical booking/payment transitions
- PII minimization and encryption-at-rest/in-transit

## 12) 12-Week Implementation Plan (Execution)

### Weeks 1-2: Security and standards
- Enforce environment schema validation in every service
- Unify JWT secrets and token settings across services
- Add centralized error envelope and request correlation IDs
- Add strict CORS/rate limits by endpoint type

### Weeks 3-4: Booking correctness
- Harden seat lock TTL + cleanup workers
- Add idempotency keys for booking confirm/payment callbacks
- Add race-condition integration tests for concurrent seat booking

### Weeks 5-6: Performance and cache
- Introduce Redis caching for high-read catalog routes
- Add pagination/projections and index tuning
- Add load tests (k6) for catalog and booking APIs

### Weeks 7-8: Observability and resilience
- Integrate Prometheus/Grafana and Sentry
- Add OpenTelemetry traces across service calls
- Create SLO dashboards and alert policies

### Weeks 9-10: Deployment maturity
- Staging/prod CI/CD with canary rollout
- Secret manager integration and key rotation workflow
- Backup/restore drills and incident playbooks

### Weeks 11-12: Growth features
- Email and SMS confirmations
- QR/PDF ticketing
- Recommendation and search/filter enhancements

## 13) Immediate Next Changes for This Repository

1. Add a shared response envelope and error classes to all services
2. Add request validation middleware (Zod) on all write routes
3. Add refresh token rotation and secure cookie auth flow at gateway/user-service
4. Add Redis-backed seat lock guard rails and idempotency on booking confirm
5. Add Prometheus metrics endpoint and standard health/readiness checks
6. Add GitHub Actions pipeline with test/build/security/deploy stages

## 14) Startup Cost Controls

- Start with managed services at right-sized tiers, then autoscale
- Cache aggressively on catalog reads to reduce DB load
- Use short-lived preview environments only for large PRs
- Track cost per booking and cost per DAU as core business metrics

## 15) Exit Criteria: "Production Ready for 100K/day"

- No double-booking in concurrency stress tests
- P95 latency and error budgets within SLO for 14 consecutive days
- Successful blue-green/canary deploy + rollback drills
- Monitoring, alerting, runbooks, and on-call process in place
- Security baseline passed (headers, auth, token rotation, validation, rate limits)
