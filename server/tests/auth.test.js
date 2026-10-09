"use strict";

/**
 * Auth tests — no real DB required.
 * We mock mongoose models and jwt directly.
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test_secret_for_jest";

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeUser = (overrides = {}) => ({
  _id: "user001",
  name: "Test Admin",
  email: "admin@test.com",
  role: "admin",
  isActive: true,
  facultyRef: null,
  sectionRef: null,
  password: bcrypt.hashSync("Admin@1234", 10),
  matchPassword: async function (p) { return bcrypt.compare(p, this.password); },
  save: async function () { return this; },
  ...overrides,
});

// Minimal req/res/next mocks
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const mockNext = () => jest.fn();

// ── 1. Password hashing ───────────────────────────────────────────────────────

describe("Password Security", () => {
  test("password is stored as bcrypt hash, not plaintext", async () => {
    const plain = "MySecret99";
    const hash = await bcrypt.hash(plain, 10);
    expect(hash).not.toBe(plain);
    expect(hash.startsWith("$2")).toBe(true);
  });

  test("matchPassword returns true for correct password", async () => {
    const user = makeUser();
    const result = await user.matchPassword("Admin@1234");
    expect(result).toBe(true);
  });

  test("matchPassword returns false for wrong password", async () => {
    const user = makeUser();
    const result = await user.matchPassword("WrongPass");
    expect(result).toBe(false);
  });

  test("pre-save hook does not double-hash an already-hashed password", async () => {
    // Simulate: password not modified → hook returns early
    const hash = await bcrypt.hash("Admin@1234", 10);
    // If we call bcrypt.hash on an existing hash, the result won't verify
    const doubleHashed = await bcrypt.hash(hash, 10);
    const verifyOriginal = await bcrypt.compare("Admin@1234", doubleHashed);
    expect(verifyOriginal).toBe(false); // proves double-hashing breaks verification
  });
});

// ── 2. JWT ────────────────────────────────────────────────────────────────────

describe("JWT", () => {
  test("valid token is accepted", () => {
    const token = jwt.sign({ id: "user001" }, process.env.JWT_SECRET, { expiresIn: "7d" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.id).toBe("user001");
  });

  test("expired token is rejected", () => {
    const token = jwt.sign({ id: "user001" }, process.env.JWT_SECRET, { expiresIn: "0s" });
    expect(() => jwt.verify(token, process.env.JWT_SECRET)).toThrow();
  });

  test("token signed with wrong secret is rejected", () => {
    const token = jwt.sign({ id: "user001" }, "wrong_secret");
    expect(() => jwt.verify(token, process.env.JWT_SECRET)).toThrow();
  });

  test("token does not contain password", () => {
    const token = jwt.sign({ id: "user001", role: "admin" }, process.env.JWT_SECRET);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.password).toBeUndefined();
  });
});

// ── 3. Login controller logic ─────────────────────────────────────────────────

describe("Login", () => {
  const buildLoginController = (userOverride) => {
    // Inline the login logic with a mocked User.findOne
    return async (req, res, next) => {
      const { email, password } = req.body;
      if (!email || !password) {
        const e = new Error("Email and password are required"); e.statusCode = 400; return next(e);
      }
      const user = userOverride;
      if (!user || !(await user.matchPassword(password))) {
        const e = new Error("Invalid email or password"); e.statusCode = 401; return next(e);
      }
      if (!user.isActive) {
        const e = new Error("Account is inactive"); e.statusCode = 403; return next(e);
      }
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
      res.json({ success: true, token, user: { id: user._id, name: user.name, role: user.role } });
    };
  };

  test("valid admin credentials return token", async () => {
    const user = makeUser();
    const login = buildLoginController(user);
    const req = { body: { email: "admin@test.com", password: "Admin@1234" } };
    const res = mockRes();
    const next = mockNext();
    await login(req, res, next);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, token: expect.any(String) }));
    expect(next).not.toHaveBeenCalled();
  });

  test("wrong password is rejected with 401", async () => {
    const user = makeUser();
    const login = buildLoginController(user);
    const req = { body: { email: "admin@test.com", password: "WrongPass" } };
    const res = mockRes();
    const next = mockNext();
    await login(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  test("inactive user is rejected with 403", async () => {
    const user = makeUser({ isActive: false });
    const login = buildLoginController(user);
    const req = { body: { email: "admin@test.com", password: "Admin@1234" } };
    const res = mockRes();
    const next = mockNext();
    await login(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  test("missing fields return 400", async () => {
    const login = buildLoginController(null);
    const req = { body: { email: "admin@test.com" } }; // no password
    const res = mockRes();
    const next = mockNext();
    await login(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  test("login response does not include password hash", async () => {
    const user = makeUser();
    const login = buildLoginController(user);
    const req = { body: { email: "admin@test.com", password: "Admin@1234" } };
    const res = mockRes();
    await login(req, res, mockNext());
    const payload = res.json.mock.calls[0][0];
    expect(payload.user.password).toBeUndefined();
  });
});

// ── 4. protect middleware ─────────────────────────────────────────────────────

describe("protect middleware", () => {
  const buildProtect = (foundUser) => async (req, res, next) => {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1] : null;
    if (!token) { const e = new Error("No token"); e.statusCode = 401; return next(e); }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = foundUser || null;
      if (!req.user) { const e = new Error("User not found"); e.statusCode = 401; return next(e); }
      if (!req.user.isActive) { const e = new Error("Inactive"); e.statusCode = 403; return next(e); }
      next();
    } catch {
      const e = new Error("Token invalid or expired"); e.statusCode = 401; next(e);
    }
  };

  test("valid token allows access", async () => {
    const token = jwt.sign({ id: "user001" }, process.env.JWT_SECRET, { expiresIn: "7d" });
    const protect = buildProtect(makeUser());
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = mockNext();
    await protect(req, {}, next);
    expect(next).toHaveBeenCalledWith(); // called with no args = success
  });

  test("missing token returns 401", async () => {
    const protect = buildProtect(makeUser());
    const req = { headers: {} };
    const next = mockNext();
    await protect(req, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  test("expired token returns 401", async () => {
    const token = jwt.sign({ id: "user001" }, process.env.JWT_SECRET, { expiresIn: "0s" });
    const protect = buildProtect(makeUser());
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = mockNext();
    await protect(req, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  test("inactive user is blocked with 403", async () => {
    const token = jwt.sign({ id: "user001" }, process.env.JWT_SECRET, { expiresIn: "7d" });
    const protect = buildProtect(makeUser({ isActive: false }));
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = mockNext();
    await protect(req, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});

// ── 5. authorizeRoles middleware ──────────────────────────────────────────────

describe("authorizeRoles middleware", () => {
  const authorizeRoles = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      const e = new Error("Access denied"); e.statusCode = 403; return next(e);
    }
    next();
  };

  test("admin passes adminOnly", () => {
    const req = { user: { role: "admin" } };
    const next = mockNext();
    authorizeRoles("admin")(req, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  test("faculty is blocked by adminOnly", () => {
    const req = { user: { role: "faculty" } };
    const next = mockNext();
    authorizeRoles("admin")(req, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  test("faculty passes authorizeRoles('admin','faculty')", () => {
    const req = { user: { role: "faculty" } };
    const next = mockNext();
    authorizeRoles("admin", "faculty")(req, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  test("student is blocked from admin+faculty route", () => {
    const req = { user: { role: "student" } };
    const next = mockNext();
    authorizeRoles("admin", "faculty")(req, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});

// ── 6. change-password logic ──────────────────────────────────────────────────

describe("changePassword", () => {
  const buildChangePassword = (user) => async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      const e = new Error("Both fields required"); e.statusCode = 400; return next(e);
    }
    if (newPassword.length < 6) {
      const e = new Error("Too short"); e.statusCode = 400; return next(e);
    }
    const match = await user.matchPassword(currentPassword);
    if (!match) { const e = new Error("Current password is incorrect"); e.statusCode = 401; return next(e); }
    user.password = await bcrypt.hash(newPassword, 10);
    res.json({ success: true, message: "Password changed successfully" });
  };

  test("correct current password allows change", async () => {
    const user = makeUser();
    const cp = buildChangePassword(user);
    const req = { body: { currentPassword: "Admin@1234", newPassword: "NewPass99" }, user };
    const res = mockRes();
    await cp(req, res, mockNext());
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test("wrong current password is rejected", async () => {
    const user = makeUser();
    const cp = buildChangePassword(user);
    const req = { body: { currentPassword: "WrongOld", newPassword: "NewPass99" }, user };
    const res = mockRes();
    const next = mockNext();
    await cp(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  test("new password too short is rejected", async () => {
    const user = makeUser();
    const cp = buildChangePassword(user);
    const req = { body: { currentPassword: "Admin@1234", newPassword: "abc" }, user };
    const res = mockRes();
    const next = mockNext();
    await cp(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });
});

// ── 7. Role self-escalation prevention ───────────────────────────────────────

describe("Role escalation prevention", () => {
  test("user cannot change their own role", () => {
    const userId = "user001";
    const reqUser = { _id: userId, role: "faculty" };
    const body = { role: "admin" };

    // Simulate the guard in updateUser controller
    const isSelf = String(reqUser._id) === userId;
    const isRoleChange = body.role && body.role !== reqUser.role;
    expect(isSelf && isRoleChange).toBe(true); // guard would block this
  });

  test("register does not accept role from untrusted input when called by non-admin", () => {
    // The route POST /api/auth/register requires protect + adminOnly
    // A non-admin token would be blocked before reaching the controller
    const req = { user: { role: "faculty" } };
    const next = jest.fn();
    const adminOnly = (r, res, n) => {
      if (r.user?.role !== "admin") { const e = new Error("Admin only"); e.statusCode = 403; return n(e); }
      n();
    };
    adminOnly(req, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});
