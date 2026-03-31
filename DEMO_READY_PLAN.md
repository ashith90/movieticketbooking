# Cinema Pulse Demo-Ready Plan (1K Users Scale)

## Goal
Ship a stable mini-project demo that can handle classroom/interview usage and moderate load bursts, without enterprise complexity.

## What is already done
- Admin role model and admin-only capabilities are implemented.
- Movie CRUD and showtime CRUD are available from Admin UI.
- Gateway and user-service hardening baseline is added:
  - Strict CORS allowlist
  - Rate limiting
  - Request IDs
  - Readiness endpoints
  - Access + refresh token flow (backward compatible)

## Scope to claim in demo
Use this claim safely:
- "Built as a microservices-based MERN-style movie booking platform with secure auth, role-based admin, seat locking workflow, and payment saga simulation."
- "Designed and tested for mini-project scale (around 1K active users/day), with production-ready foundations."

Do not claim:
- 100K/day production traffic
- full HA/DR SRE maturity

## 10-Minute demo setup
1. Start stack:
- docker compose up -d --build

2. Seed catalog:
- docker compose exec movie-service npm run seed

3. Open app:
- http://localhost:4000

4. Login as admin:
- admin@demo.local
- Admin#12345

5. Show demo flow:
- Browse movies
- Create a booking flow
- Admin tab: add/edit/delete movie
- Admin tab: add/edit/delete showtime
- Notifications and booking status updates

## Stability checklist before presentation
- Verify health:
  - GET http://localhost:4000/api/v1/health
  - GET http://localhost:5001/health
  - GET http://localhost:5002/health
  - GET http://localhost:5003/health
  - GET http://localhost:5004/health
  - GET http://localhost:5005/health
- Keep one browser tab for admin and one for user to show role separation.
- Re-seed catalog if data was reset.

## 1K-user realistic readiness items (minimum)
- Keep current rate limits enabled.
- Keep JWT and refresh token flow enabled.
- Keep secure env values (no demo secrets in public repo).
- Add one synthetic load test run before demo (optional):
  - k6 or Artillery against catalog reads and booking lock endpoint.

## Presentation storyline (recommended)
1. Problem: avoid double booking and support real-time booking lifecycle.
2. Architecture: gateway + services + Mongo + Redis + Kafka.
3. Security: JWT auth, role-based access, validation, rate limiting.
4. Reliability: lock-book-pay saga and event-driven updates.
5. Admin power: movie/show management.
6. Future roadmap: payment gateway + observability + CI/CD canary rollout.

## Quick fallback if internet/Mongo DNS issues appear
- Restart only affected services:
  - docker compose up -d --build user-service gateway
- Then verify:
  - GET http://localhost:4000/ready
  - GET http://localhost:5001/ready

## Resume points (if continuing later)
- Add booking-service idempotency keys for confirm/cancel.
- Add payment webhook signature verification.
- Add Prometheus metrics and Grafana dashboard.
