import { api } from '../services/api.js';
import { showToast, openModal } from '../state/store.js';

export async function renderAdminView(container: HTMLElement) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2>🛡️ Administration & Governance</h2>
        <p>System security control, fine waiver authorization, role assignments, immutable audit logs, and analytics.</p>
      </div>
      <button class="btn btn-warning" id="btn-open-waive">
        ✨ Waive User Fine (Admin Only)
      </button>
    </div>

    <!-- Reports & Inventory Overview -->
    <div class="stats-grid" id="admin-stats-container">
      <div class="stat-card">
        <div class="stat-header">
          <span>Available Copies</span>
          <span>🟢</span>
        </div>
        <div class="stat-value" id="stat-avail-copies">-</div>
        <div class="stat-sub">Ready in circulation</div>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <span>On Loan Copies</span>
          <span>📘</span>
        </div>
        <div class="stat-value" id="stat-loan-copies">-</div>
        <div class="stat-sub">Currently borrowed</div>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <span>On Hold Copies</span>
          <span>⏳</span>
        </div>
        <div class="stat-value" id="stat-hold-copies">-</div>
        <div class="stat-sub">Awaiting pickup (48h)</div>
      </div>
      <div class="stat-card">
        <div class="stat-header">
          <span>Maintenance / Lost</span>
          <span>🛠️</span>
        </div>
        <div class="stat-value" id="stat-maint-copies">-</div>
        <div class="stat-sub">Damaged or missing</div>
      </div>
    </div>

    <!-- User Management Section -->
    <div class="glass-panel">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="font-family: var(--font-heading); font-size: 1.25rem;">👥 User Accounts & Access Control</h3>
        <button class="btn btn-secondary btn-sm" id="btn-refresh-users">🔄 Refresh</button>
      </div>
      <div id="users-table-container">
        <p style="color: var(--text-muted);">Loading users...</p>
      </div>
    </div>

    <!-- Immutable Audit Logs Section -->
    <div class="glass-panel">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="font-family: var(--font-heading); font-size: 1.25rem;">📜 Immutable System Audit Trail</h3>
        <button class="btn btn-secondary btn-sm" id="btn-refresh-audit">🔄 Refresh</button>
      </div>
      <div id="audit-table-container">
        <p style="color: var(--text-muted);">Loading audit records...</p>
      </div>
    </div>
  `;

  const usersContainer = container.querySelector('#users-table-container') as HTMLElement;
  const auditContainer = container.querySelector('#audit-table-container') as HTMLElement;

  async function loadStats() {
    const res = await api.getInventoryReport();
    if (res.success && res.data) {
      const getCount = (st: string) => res.data?.find((d) => d.status === st)?.count || 0;
      (container.querySelector('#stat-avail-copies') as HTMLElement).innerText = getCount('AVAILABLE').toString();
      (container.querySelector('#stat-loan-copies') as HTMLElement).innerText = getCount('ON_LOAN').toString();
      (container.querySelector('#stat-hold-copies') as HTMLElement).innerText = getCount('ON_HOLD').toString();
      const maint = getCount('MAINTENANCE') + getCount('LOST') + getCount('RETIRED');
      (container.querySelector('#stat-maint-copies') as HTMLElement).innerText = maint.toString();
    }
  }

  async function loadUsers() {
    const res = await api.listUsers();
    if (!res.success || !res.data) {
      usersContainer.innerHTML = `<p style="color: var(--text-muted);">Failed to load users.</p>`;
      return;
    }

    usersContainer.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID / University ID</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Current Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${res.data
              .map((u) => {
                const roleClass = `badge-${u.role.toLowerCase()}`;
                const isActive = u.status === 'ACTIVE';

                return `
                <tr>
                  <td><code>${u.university_id}</code></td>
                  <td style="font-weight: 600;">${u.full_name}</td>
                  <td>${u.email}</td>
                  <td><span class="user-role-badge ${roleClass}">${u.role}</span></td>
                  <td>
                    <span class="status-pill ${isActive ? 'status-available' : 'status-lost'}">
                      ${u.status}
                    </span>
                  </td>
                  <td>
                    <div style="display: flex; gap: 6px;">
                      <button class="btn btn-secondary btn-sm btn-toggle-status" data-user-id="${u.id}" data-current-status="${u.status}">
                        ${isActive ? '🚫 Disable' : '✅ Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    usersContainer.querySelectorAll('.btn-toggle-status').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const userId = (e.currentTarget as HTMLElement).getAttribute('data-user-id')!;
        const currentStatus = (e.currentTarget as HTMLElement).getAttribute('data-current-status')!;
        const newStatus = currentStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';

        showToast(`Updating user status to ${newStatus}...`, 'info');
        const updateRes = await api.updateUserStatus(userId, newStatus);
        if (updateRes.success) {
          showToast('User status updated successfully', 'success');
          loadUsers();
          loadAudit();
        } else {
          showToast(updateRes.error?.message || 'Update failed', 'error');
        }
      });
    });
  }

  async function loadAudit() {
    const res = await api.getAuditLogs({ limit: 15 });
    if (!res.success || !res.data) {
      auditContainer.innerHTML = `<p style="color: var(--text-muted);">Failed to load audit trail.</p>`;
      return;
    }

    auditContainer.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Resource Type</th>
              <th>Resource ID</th>
            </tr>
          </thead>
          <tbody>
            ${res.data
              .map((log) => {
                const timeStr = new Date(log.created_at).toLocaleString();
                return `
                <tr>
                  <td style="color: var(--text-secondary); font-size: 0.8rem;">${timeStr}</td>
                  <td>${log.actor_name || 'System / Batch'}</td>
                  <td><span class="status-pill status-on-hold">${log.action}</span></td>
                  <td><code>${log.resource_type}</code></td>
                  <td><code>${log.resource_id}</code></td>
                </tr>
              `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // Waive Fine Modal
  container.querySelector('#btn-open-waive')?.addEventListener('click', () => {
    openModal(
      'Administrative Fine Waiver Approval',
      `
      <form id="admin-waive-form">
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 14px;">
          Only Administrators possess authority to waive fine ledger charges. A specific reason must be supplied for audit verification.
        </p>
        <div class="form-group">
          <label>Borrower User ID *</label>
          <input type="text" name="user_id" placeholder="e.g. usr-stu-01" required />
        </div>
        <div class="form-group">
          <label>Amount to Waive (THB) *</label>
          <input type="number" step="0.01" min="0.01" name="amount" placeholder="e.g. 200.00" required />
        </div>
        <div class="form-group">
          <label>Official Justification / Reason *</label>
          <textarea name="reason" rows="3" placeholder="Enter reason for waiver..." required></textarea>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-close-btn').click()">Cancel</button>
          <button type="submit" class="btn btn-warning">Approve Waiver</button>
        </div>
      </form>
      `,
      async (data) => {
        showToast('Submitting waiver approval...', 'info');
        const res = await api.waiveFine(data.user_id, parseFloat(data.amount), data.reason);
        if (res.success) {
          showToast(`Waiver of ฿${data.amount} approved! Remaining: ฿${res.data?.newOutstanding}`, 'success');
          loadAudit();
        } else {
          showToast(res.error?.message || 'Waiver failed', 'error');
        }
      }
    );
  });

  container.querySelector('#btn-refresh-users')?.addEventListener('click', loadUsers);
  container.querySelector('#btn-refresh-audit')?.addEventListener('click', loadAudit);

  loadStats();
  loadUsers();
  loadAudit();
}
