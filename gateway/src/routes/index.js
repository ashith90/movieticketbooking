const express = require("express");
const { createProxyMiddleware, fixRequestBody } = require("http-proxy-middleware");
const { optionalAuth, requireAuth } = require("../middlewares/auth");

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "api-gateway" });
});

router.use(
  "/auth",
  createProxyMiddleware({
    target: process.env.USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/auth${path}`,
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.requestId) {
          proxyReq.setHeader("x-request-id", req.requestId);
        }
        fixRequestBody(proxyReq, req);
      },
    },
  })
);

router.use(
  "/users",
  requireAuth,
  createProxyMiddleware({
    target: process.env.USER_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/users${path}`,
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.requestId) {
          proxyReq.setHeader("x-request-id", req.requestId);
        }
        if (req.user?.userId) {
          proxyReq.setHeader("x-user-id", req.user.userId);
        }
        fixRequestBody(proxyReq, req);
      },
    },
  })
);

router.use(
  "/bookings",
  requireAuth,
  createProxyMiddleware({
    target: process.env.BOOKING_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/bookings${path}`,
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.requestId) {
          proxyReq.setHeader("x-request-id", req.requestId);
        }
        if (req.user?.userId) {
          proxyReq.setHeader("x-user-id", req.user.userId);
        }
        fixRequestBody(proxyReq, req);
      },
    },
  })
);

router.use(
  "/catalog/movies",
  requireAuth,
  createProxyMiddleware({
    target: process.env.MOVIE_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/catalog/movies${path}`,
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.requestId) {
          proxyReq.setHeader("x-request-id", req.requestId);
        }
        fixRequestBody(proxyReq, req);
      },
    },
  })
);

router.use(
  "/catalog",
  optionalAuth,
  createProxyMiddleware({
    target: process.env.MOVIE_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/catalog${path}`,
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.requestId) {
          proxyReq.setHeader("x-request-id", req.requestId);
        }
        fixRequestBody(proxyReq, req);
      },
    },
  })
);

router.use(
  "/payments/webhook",
  createProxyMiddleware({
    target: process.env.PAYMENT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: () => "/payments/webhook",
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.requestId) {
          proxyReq.setHeader("x-request-id", req.requestId);
        }
        fixRequestBody(proxyReq, req);
      },
    },
  })
);

router.use(
  "/payments",
  requireAuth,
  createProxyMiddleware({
    target: process.env.PAYMENT_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/payments${path}`,
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.requestId) {
          proxyReq.setHeader("x-request-id", req.requestId);
        }
        if (req.user?.userId) {
          proxyReq.setHeader("x-user-id", req.user.userId);
        }
        fixRequestBody(proxyReq, req);
      },
    },
  })
);

router.use(
  "/notifications",
  requireAuth,
  createProxyMiddleware({
    target: process.env.NOTIFICATION_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: (path) => `/notifications${path}`,
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.requestId) {
          proxyReq.setHeader("x-request-id", req.requestId);
        }
        if (req.user?.userId) {
          proxyReq.setHeader("x-user-id", req.user.userId);
        }
        fixRequestBody(proxyReq, req);
      },
    },
  })
);

module.exports = router;
