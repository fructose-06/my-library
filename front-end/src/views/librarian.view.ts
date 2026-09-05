import { api } from '../services/api.js';
import { showToast, openModal } from '../state/store.js';

export async function renderLibrarianView(container: HTMLElement) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2>📚 Librarian Operations Desk</h2>
        <p>Circulation counter management: quick borrow/return, damage assessments, lost confirmation, and fine payment collection.</p>
      </div>
    </div>

    <!-- Operations Action Bar -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 28px;">
      <button class="btn btn-primary" id="btn-quick-borrow" style="padding: 18px; font-size: 1rem;">
        ⚡ Borrow on Behalf
      </button>
      <button class="btn btn-success" id="btn-quick-return" style="padding: 18px; font-size: 1rem;">
        📥 Process Return & Inspection
      </button>
      <button class="btn btn-warning" id="btn-quick-payment" style="padding: 18px; font-size: 1rem;">
        💵 Receive Fine Payment
      </button>
      <button class="btn btn-danger" id="btn-confirm-lost" style="padding: 18px; font-size: 1rem;">
        📕 Confirm Book Lost
      </button>
    </div>

    <!-- Real-time Overdue Monitor -->
    <div class="glass-panel">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="font-family: var(--font-heading); font-size: 1.25rem;">⚠️ Real-Time Overdue Loans Monitor</h3>
        <button class="btn btn-secondary btn-sm" id="btn-refresh-overdue">🔄 Refresh List</button>
      </div>
      <div id="overdue-table-container">
        <p style="color: var(--text-muted);">Loading overdue loans...</p>
      </div>
    </div>
  `;

  const overdueContainer = container.querySelector('#overdue-table-container') as HTMLElement;

  async function loadOverdue() {
    const res = await api.getOverdueReport();
    if (!res.success || !res.data || res.data.length === 0) {
      overdueContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 8px;">🎉</div>
          <p>No active overdue loans in the system. Everything is on schedule!</p>
        </div>
      `;
      return;
    }

    overdueContainer.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Borrower Name</th>
              <th>Book Title</th>
              <th>Barcode</th>
              <th>Due Date</th>
              <th>Accrued Fine</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${res.data
              .map((l) => {
                const dueStr = new Date(l.due_date).toLocaleDateString();
                return `
                <tr>
                  <td style="font-weight: 600;">${l.borrower_name || l.user_id}</td>
                  <td>${l.book_title}</td>
                  <td><code>${l.copy_barcode}</code></td>
                  <td style="color: #fb7185; font-weight: 700;">${dueStr}</td>
                  <td style="color: #fb7185; font-weight: 700;">฿${l.accrued_late_fine}</td>
                  <td>
                    <button class="btn btn-primary btn-sm btn-table-return" data-loan-id="${l.id}" data-barcode="${l.copy_barcode}">
                      Process Return
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

    overdueContainer.querySelectorAll('.btn-table-return').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const loanId = (e.currentTarget as HTMLElement).getAttribute('data-loan-id')!;
        showReturnModal(loanId);
      });
    });
  }

  // --- Quick Borrow Modal ---
  container.querySelector('#btn-quick-borrow')?.addEventListener('click', () => {
    openModal(
      'Borrow on Behalf of Student/Lecturer',
      `
      <form id="librarian-borrow-form">
        <div class="form-group">
          <label>Borrower ID / University ID *</label>
          <input type="text" name="borrower_id" placeholder="e.g. usr-stu-01 or student ID" required />
        </div>
        <div class="form-group">
          <label>Physical Copy Barcode *</label>
          <input type="text" name="barcode" placeholder="e.g. CA-000002" required />
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-close-btn').click()">Cancel</button>
          <button type="submit" class="btn btn-primary">Process Borrow</button>
        </div>
      </form>
      `,
      async (data) => {
        showToast('Processing borrow...', 'info');
        const res = await api.borrowBook(data.barcode, data.borrower_id);
        if (res.success) {
          showToast(`Successfully borrowed ${data.barcode} for user!`, 'success');
          loadOverdue();
        } else {
          showToast(res.error?.message || 'Borrow failed', 'error');
        }
      }
    );
  });

  // --- Return Modal with Condition Assessment ---
  function showReturnModal(defaultLoanId: string = '') {
    openModal(
      'Process Book Return & Inspection',
      `
      <form id="librarian-return-form">
        <div class="form-group">
          <label>Loan ID *</label>
          <input type="text" name="loan_id" value="${defaultLoanId}" placeholder="Enter Loan ID" required />
        </div>
        <div class="form-group">
          <label>Physical Inspection Condition *</label>
          <select name="condition" class="filter-select" style="width: 100%;">
            <option value="NORMAL">NORMAL — 0 THB (Return to circulation/hold)</option>
            <option value="MINOR_DAMAGE">MINOR_DAMAGE — ฿100.00 charge (Maintenance)</option>
            <option value="MAJOR_DAMAGE">MAJOR_DAMAGE — 50% Acquisition Price (Maintenance)</option>
            <option value="UNUSABLE">UNUSABLE — 100% Price + ฿200 Processing Fee (Retired)</option>
          </select>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-close-btn').click()">Cancel</button>
          <button type="submit" class="btn btn-success">Complete Return</button>
        </div>
      </form>
      `,
      async (data) => {
        showToast('Processing return...', 'info');
        const res = await api.returnBook(data.loan_id, data.condition);
        if (res.success) {
          const d = res.data;
          let msg = 'Book returned successfully!';
          if (d.lateFine > 0) msg += ` Late fine: ฿${d.lateFine}.`;
          if (d.damageCharge > 0) msg += ` Damage charge: ฿${d.damageCharge}.`;
          if (d.allocatedReservation) msg += ` Allocated to next reservation queue!`;
          showToast(msg, 'success');
          loadOverdue();
        } else {
          showToast(res.error?.message || 'Return failed', 'error');
        }
      }
    );
  }

  container.querySelector('#btn-quick-return')?.addEventListener('click', () => showReturnModal());

  // --- Confirm Lost Modal ---
  container.querySelector('#btn-confirm-lost')?.addEventListener('click', () => {
    openModal(
      'Confirm Book Lost (Librarian)',
      `
      <form id="confirm-lost-form">
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 14px;">
          Confirming a book as lost permanently closes the loan and charges the borrower:
          <strong>Acquisition Price + ฿200 Processing Fee + Accrued Late Fine</strong>.
        </p>
        <div class="form-group">
          <label>Loan ID *</label>
          <input type="text" name="loan_id" placeholder="Enter active Loan ID" required />
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-close-btn').click()">Cancel</button>
          <button type="submit" class="btn btn-danger">Confirm Lost & Charge</button>
        </div>
      </form>
      `,
      async (data) => {
        showToast('Confirming lost book...', 'info');
        const res = await api.confirmLost(data.loan_id);
        if (res.success) {
          const total = res.data?.charges?.totalCharge;
          showToast(`Book confirmed LOST. Charged ฿${total} to borrower ledger.`, 'success');
          loadOverdue();
        } else {
          showToast(res.error?.message || 'Failed to confirm lost', 'error');
        }
      }
    );
  });

  // --- Receive Payment Modal ---
  container.querySelector('#btn-quick-payment')?.addEventListener('click', () => {
    openModal(
      'Receive Fine Payment',
      `
      <form id="receive-payment-form">
        <div class="form-group">
          <label>Borrower User ID *</label>
          <input type="text" name="user_id" placeholder="e.g. usr-stu-01" required />
        </div>
        <div class="form-group">
          <label>Payment Amount (THB) *</label>
          <input type="number" step="0.01" min="0.01" name="amount" placeholder="e.g. 100.00" required />
        </div>
        <div class="form-group">
          <label>Payment Notes / Receipt Reference</label>
          <input type="text" name="notes" placeholder="e.g. Cash at Front Desk #1" />
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('modal-close-btn').click()">Cancel</button>
          <button type="submit" class="btn btn-success">Record Payment</button>
        </div>
      </form>
      `,
      async (data) => {
        showToast('Recording payment...', 'info');
        const res = await api.payFine(data.user_id, parseFloat(data.amount), data.notes);
        if (res.success) {
          showToast(`Payment of ฿${data.amount} recorded! New balance: ฿${res.data?.newOutstanding}`, 'success');
        } else {
          showToast(res.error?.message || 'Payment failed', 'error');
        }
      }
    );
  });

  container.querySelector('#btn-refresh-overdue')?.addEventListener('click', loadOverdue);
  loadOverdue();
}
