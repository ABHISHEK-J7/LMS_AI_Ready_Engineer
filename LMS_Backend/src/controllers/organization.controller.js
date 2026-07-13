import { z } from 'zod';
import { UserRole, UserStatus } from '#shared';
import { Batch, Module, Organization, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/http.js';
import { audit } from '../services/audit.js';
import { seedCurriculumForOrg } from '../services/orgSeed.js';

const objectId = z.string().length(24);
export const orgIdParam = z.object({ id: objectId });

export const createOrgSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(16),
  // Optional first admin created together with the org.
  adminName: z.string().min(2).max(120).optional(),
  adminEmail: z.string().email().max(160).optional(),
  adminPassword: z.string().min(8).max(128).optional(),
});

export const updateOrgSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  status: z.enum(['active', 'suspended']).optional(),
});

export const createOrgAdminSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(160),
  password: z.string().min(8).max(128),
});

/** Super admin: list organizations with headline counts. */
export async function listOrganizations(_req, res) {
  const orgs = await Organization.find().sort({ createdAt: -1 });
  const items = await Promise.all(
    orgs.map(async (o) => {
      const [admins, trainers, students, batches, modules] = await Promise.all([
        User.countDocuments({ organization: o._id, role: UserRole.ADMIN }),
        User.countDocuments({ organization: o._id, role: UserRole.TRAINER }),
        User.countDocuments({ organization: o._id, role: UserRole.STUDENT }),
        Batch.countDocuments({ organization: o._id }),
        Module.countDocuments({ organization: o._id }),
      ]);
      return { ...o.toJSON(), counts: { admins, trainers, students, batches, modules } };
    }),
  );
  ok(res, items);
}

export async function getOrganization(req, res) {
  const org = await Organization.findById(req.params.id);
  if (!org) throw ApiError.notFound('Organization not found');
  ok(res, org.toJSON());
}

/** Super admin: create an organization, seed its curriculum, optionally add its first admin. */
export async function createOrganization(req, res) {
  const { name, code, adminName, adminEmail, adminPassword } = req.body;
  const codeUp = code.toUpperCase();
  if (await Organization.findOne({ code: codeUp })) {
    throw ApiError.conflict(`An organization with code ${codeUp} already exists`);
  }
  if (adminEmail && (await User.findOne({ email: adminEmail }))) {
    throw ApiError.conflict('An account with that admin email already exists');
  }

  const org = await Organization.create({ name, code: codeUp, createdBy: req.auth.userId });
  await seedCurriculumForOrg(org._id); // its own copy of the default curriculum

  let admin = null;
  if (adminName && adminEmail && adminPassword) {
    admin = await User.create({
      name: adminName,
      email: adminEmail,
      passwordHash: await User.setPassword(adminPassword),
      role: UserRole.ADMIN,
      organization: org._id,
      status: UserStatus.ACTIVE,
    });
  }

  audit(req, 'organization.create', { targetType: 'organization', targetId: org.id, meta: { name, code: codeUp, withAdmin: Boolean(admin) } });
  ok(res, { ...org.toJSON(), admin: admin ? admin.toJSON() : null }, 201);
}

export async function updateOrganization(req, res) {
  const org = await Organization.findById(req.params.id);
  if (!org) throw ApiError.notFound('Organization not found');
  const { name, status } = req.body;
  if (name !== undefined) org.name = name;
  if (status !== undefined) org.status = status;
  await org.save();
  audit(req, 'organization.update', { targetType: 'organization', targetId: org.id, meta: { name: org.name, status: org.status } });
  ok(res, org.toJSON());
}

/** Super admin: add an admin to an organization (orgs may have several admins). */
export async function createOrgAdmin(req, res) {
  const org = await Organization.findById(req.params.id);
  if (!org) throw ApiError.notFound('Organization not found');
  const { name, email, password } = req.body;
  if (await User.findOne({ email })) throw ApiError.conflict('An account with that email already exists');
  const admin = await User.create({
    name,
    email,
    passwordHash: await User.setPassword(password),
    role: UserRole.ADMIN,
    organization: org._id,
    status: UserStatus.ACTIVE,
  });
  audit(req, 'organization.addAdmin', { targetType: 'user', targetId: admin.id, meta: { org: org.code, email } });
  ok(res, admin.toJSON(), 201);
}

/** Super admin: list an org's admins. */
export async function listOrgAdmins(req, res) {
  const admins = await User.find({ organization: req.params.id, role: UserRole.ADMIN }).sort({ createdAt: 1 });
  ok(res, admins.map((a) => a.toJSON()));
}
