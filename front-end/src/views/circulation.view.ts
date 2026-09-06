import { api } from '../services/api.js';
import { store, showToast } from '../state/store.js';

export async function renderCirculationView(container: HTMLElement) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2>🔄 My Loans & Circulation</h2>
        <p>Manage your active book loans, track due dates and accrued fines, and request renewals (+7 days).</p>
      </div>
    </div>

    ${
      store.currentUser?.role === 'ADMIN'
        ? `
        <div style="background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 1.5rem;">🛡️</span>
          <div>
            <div style="font-weight: 600; color: #93c5fd;">System Administrator Account (Separation of Duties)</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">Administrators manage system security, user accounts, audit logs, and fine waivers. Direct book borrowing is reserved for Student and Lecturer roles.</div>
          </div>
        </div>
        `
        : store.currentUser?.role === 'LIBRARIAN'
        ? `
        <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 1.5rem;">📚</span>
          <div>
            <div style="font-weight: 600; color: #6ee7b7;">Librarian Staff Account (Circulation Service)</div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">Librarians process borrowing and returns for students and lecturers at the Librarian Desk. Direct personal borrowing is reserved for Student and Lecturer roles.</div>
          </div>
        </div>
        `
        : ''
    }

    <!-- Active Loans Section -->
    <div class="glass-panel">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="font-family: var(--font-heading); font-size: 1.25rem;">📖 Currently Borrowed Books</h3>
        <button class="btn btn-secondary btn-sm" id="btn-refresh-loans">🔄 Refresh</button>
      </div>
      <div id="active-loans-container">
        <p style="color: var(--text-muted);">Loading active loans...</p>
      </div>
    </div>

    <!-- Loan History Section -->
    <div class="glass-panel">
      <h3 style="font-family: var(--font-heading); font-size: 1.25rem; margin-bottom: 16px;">📜 Borrowing History</h3>
      <div id="history-loans-container">
        <p style="color: var(--text-muted);">Loading history...</p>
      </div>
    </div>
  `;

  const activeContainer = container.querySelector('#active-loans-container') as HTMLElement;
  const historyContainer = container.querySelector('#history-loans-container') as HTMLElement;

  async function loadLoans() {
    // 1. Load active loans
    const activeRes = await api.getMyLoans();
    if (!activeRes.success || !activeRes.data || activeRes.data.length === 0) {
      activeContainer.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 8px;">📚</div>
          <p>You currently have no active book loans.</p>
        </div>
      `;
    } else {
      activeContainer.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Book Title</th>
                <th>Barcode</th>
                <th>Borrowed</th>
                <th>Due Date</th>
                <th>Renewals</th>
                <th>Status / Fine</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${activeRes.data
                .map((loan) => {
                  const borrowStr = new Date(loan.borrow_date).toLocaleDateString();
                  const dueStr = new Date(loan.due_date).toLocaleDateString();
                  const isOverdue = loan.is_overdue;
                  const fine = loan.accrued_late_fine || 0;

                  return `
                  <tr style="${isOverdue ? 'background: rgba(244, 63, 94, 0.05);' : ''}">
                    <td style="font-weight: 600; color: #fff;">${loan.book_title}</td>
                    <td><code>${loan.copy_barcode}</code></td>
                    <td style="color: var(--text-secondary);">${borrowStr}</td>
                    <td style="${isOverdue ? 'color: #fb7185; font-weight: 700;' : 'color: var(--accent-cyan);'}">${dueStr}</td>
                    <td>${loan.renewal_count}/2</td>
                    <td>
                      ${
                        isOverdue
                          ? `<span class="status-pill status-lost">⚠️ Overdue (฿${fine})</span>`
                          : `<span class="status-pill status-available">Active</span>`
                      }
                    </td>
                    <td>
                      <button class="btn btn-secondary btn-sm btn-renew-loan" data-loan-id="${loan.id}" ${loan.renewal_count >= 2 || isOverdue ? 'disabled title="Cannot renew"' : ''}>
                        🔁 Renew (+7d)
                      </button>
                    </td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `;

      activeContainer.querySelectorAll('.btn-renew-loan').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const loanId = (e.currentTarget as HTMLElement).getAttribute('data-loan-id')!;
          await handleRenew(loanId);
        });
      });
    }

    // 2. Load history loans
    const historyRes = await api.getMyHistory();
    if (!historyRes.success || !historyRes.data || historyRes.data.length === 0) {
      historyContainer.innerHTML = `
        <div style="text-align: center; padding: 30px; color: var(--text-muted);">
          No previous borrowing records found.
        </div>
      `;
    } else {
      historyContainer.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Book Title</th>
                <th>Barcode</th>
                <th>Borrowed</th>
                <th>Returned</th>
                <th>Final Status</th>
              </tr>
            </thead>
            <tbody>
              ${historyRes.data
                .map((loan) => {
                  const borrowStr = new Date(loan.borrow_date).toLocaleDateString();
                  const returnStr = loan.return_date ? new Date(loan.return_date).toLocaleDateString() : '-';
                  const statusClass = loan.status === 'RETURNED' ? 'status-available' : loan.status === 'LOST' ? 'status-lost' : 'status-on-loan';

                  return `
                  <tr>
                    <td>${loan.book_title}</td>
                    <td><code>${loan.copy_barcode}</code></td>
                    <td style="color: var(--text-secondary);">${borrowStr}</td>
                    <td style="color: var(--text-secondary);">${returnStr}</td>
                    <td><span class="status-pill ${statusClass}">${loan.status}</span></td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  async function handleRenew(loanId: string) {
    showToast('Submitting renewal request...', 'info');
    const res = await api.renewLoan(loanId);

    if (res.success) {
      showToast('Loan successfully renewed for 7 additional days!', 'success');
      await store.refreshUser();
      loadLoans();
    } else {
      showToast(res.error?.message || 'Renewal rejected', 'error');
    }
  }

  container.querySelector('#btn-refresh-loans')?.addEventListener('click', loadLoans);
  loadLoans();
}
