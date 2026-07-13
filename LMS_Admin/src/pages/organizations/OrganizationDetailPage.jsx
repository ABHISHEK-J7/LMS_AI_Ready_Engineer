import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, LogIn, Plus, ShieldCheck } from 'lucide-react';
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Input, Modal, Select, SkeletonText, useToast } from '@/components/ui';
import { PageHeader } from '@/components/PageHeader';
import { apiErrorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCreateOrgAdmin, useOrganization, useOrgAdmins, useUpdateOrganization } from '@/lib/organizations';

export function OrganizationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setOrgView = useAuth((s) => s.setOrgView);
  const { data: org, isLoading, isError, error, refetch } = useOrganization(id);
  const { data: admins } = useOrgAdmins(id);
  const update = useUpdateOrganization();
  const createAdmin = useCreateOrgAdmin();
  const toast = useToast();

  const [name, setName] = useState('');
  const [status, setStatus] = useState('active');
  const [addOpen, setAddOpen] = useState(false);
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');

  const back = <Link to="/app/organizations" className="lms-muted">← Organizations</Link>;

  if (isLoading && !org) {
    return <><PageHeader title="Organization" subtitle={back} /><Card><SkeletonText lines={4} /></Card></>;
  }
  if (isError || !org) {
    return <><PageHeader title="Organization" subtitle={back} /><ErrorState message={apiErrorMessage(error) || 'Not found'} onRetry={refetch} /></>;
  }

  function enter() {
    setOrgView({ id: org.id, name: org.name });
    qc.clear();
    navigate('/app', { replace: true });
  }

  async function saveOrg(e) {
    e.preventDefault();
    setErr('');
    try {
      await update.mutateAsync({ id: org.id, name: (name || org.name).trim(), status: status || org.status });
      toast.success('Saved.');
    } catch (e2) { setErr(apiErrorMessage(e2)); }
  }

  async function addAdmin(e) {
    e.preventDefault();
    setErr('');
    if (!adminForm.name || !adminForm.email || adminForm.password.length < 8) {
      return setErr('Enter a name, email, and a password of at least 8 characters.');
    }
    try {
      await createAdmin.mutateAsync({ id: org.id, name: adminForm.name.trim(), email: adminForm.email.trim(), password: adminForm.password });
      setAddOpen(false);
      setAdminForm({ name: '', email: '', password: '' });
      toast.success('Admin added.');
    } catch (e2) { setErr(apiErrorMessage(e2)); }
  }

  return (
    <>
      <PageHeader title={org.name} subtitle={back} />

      <div className="toolbar">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/organizations')}><ChevronLeft size={16} /> All organizations</Button>
        <span style={{ marginLeft: 'auto' }} />
        <Button onClick={enter}><LogIn size={15} style={{ marginRight: 6 }} /> Enter organization</Button>
      </div>

      <Card style={{ maxWidth: '40rem', marginBottom: 'var(--space-6)' }}>
        <CardHeader title="Details" subtitle={`Code: ${org.code}`} />
        <form onSubmit={saveOrg} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
          <Input label="Name" defaultValue={org.name} onChange={(e) => setName(e.target.value)} />
          <Select label="Status" defaultValue={org.status} onChange={(e) => setStatus(e.target.value)}
            options={[{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }]} />
          <div><Button type="submit" loading={update.isPending}>Save</Button></div>
        </form>
      </Card>

      <Card style={{ maxWidth: '40rem' }}>
        <div className="panel-head">
          <CardHeader title={`Admins (${admins?.length ?? 0})`} subtitle="Admins manage everything inside this organization." />
          <Button onClick={() => setAddOpen(true)}><Plus size={15} style={{ marginRight: 6 }} /> Add admin</Button>
        </div>
        {!admins ? (
          <SkeletonText lines={2} />
        ) : admins.length === 0 ? (
          <EmptyState icon={<ShieldCheck size={24} />} title="No admins yet" description="Add the first admin for this organization." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Status</th></tr></thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td className="lms-muted">{a.email}</td>
                    <td><Badge tone={a.status === 'active' ? 'success' : 'neutral'}>{a.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {err && <span className="field__error" style={{ display: 'block', marginTop: 'var(--space-2)' }}>{err}</span>}
      </Card>

      <Modal open={addOpen} title="Add admin" onClose={() => setAddOpen(false)}
        footer={<><Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button form="add-admin-form" type="submit" loading={createAdmin.isPending}>Add</Button></>}>
        <form id="add-admin-form" onSubmit={addAdmin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <Input label="Name" value={adminForm.name} onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })} required />
          <Input label="Email" type="email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} required />
          <Input label="Password" type="password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} placeholder="At least 8 characters" required />
          {err && <span className="field__error">{err}</span>}
        </form>
      </Modal>
    </>
  );
}
