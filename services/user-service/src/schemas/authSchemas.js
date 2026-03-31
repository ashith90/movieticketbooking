const { z } = require("zod");

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  phone: z.string().min(7).max(20).optional(),
  city: z.string().min(2).max(80).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const refreshSchema = z
  .object({
    refreshToken: z.string().min(10).optional(),
  })
  .optional();

module.exports = {
  signupSchema,
  loginSchema,
  refreshSchema,
};
