import { api } from '../services/api.js';
import { store } from '../state/store.js';

export async function renderFinesView(container: HTMLElement) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2>💳 Fines, Ledger & Payments</h2>
        <p>Transparent, double-entry financial ledger of all library charges, payment receipts, and administrative waivers.</p>
      </div>
      <button class="btn btn-secondary btn-sm" id="btn-refresh-fines">🔄 Refresh</button>
    </div>

    <!-- Outstanding Balance Alert Banner (Dynamic) -->
    <div id="balance-banner-container"></div>

    <!-- Stats Grid -->
    <div class="stats-grid" id="fines-stats-container">
      <div class="stat-card" id="card-outstanding">
        <div class="stat-header">
          <span>Outstanding Balance</span>
          <span>💰</span>
        </div>
        <div class="stat-value" id="stat-outstanding">฿0.00</div>
        <div class="stat-sub" id="stat-sub-outstanding">Threshold limit: ฿500.00</div>
      </div>
    </div>

    <!-- Fine Ledger Tables -->
    <div class="glass-panel">
      <h3 style="font-family: var(--font-heading); font-size: 1.2rem; margin-bottom: 16px;">🧾 Itemized Charges</h3>
      <div id="charges-table-container">
        <p style="color: var(--text-muted);">Loading charges...</p>
      </div>
    </div>

    <div class="glass-panel">
      <h3 style="font-family: var(--font-heading); font-size: 1.2rem; margin-bottom: 16px;">💵 Payment Receipts & Waivers</h3>
      <div id="credits-table-container">
        <p style="color: var(--text-muted);">Loading payment records...</p>
      </div>
    </div>
  `;

  const bannerContainer = container.querySelector('#balance-banner-container') as HTMLElement;
  const statOutstanding = container.querySelector('#stat-outstanding') as HTMLElement;
  const statSubOutstanding = container.querySelector('#stat-sub-outstanding') as HTMLElement;
  const cardOutstanding = container.querySelector('#card-outstanding') as HTMLElement;
  const chargesContainer = container.querySelector('#charges-table-container') as HTMLElement;
  const creditsContainer = container.querySelector('#credits-table-container') as HTMLElement;

  async function loadFines() {
    const res = await api.getMyFines();
    if (!res.success || !res.data) {
      chargesContainer.innerHTML = `<p style="color: var(--text-muted);">Failed to load fine details.</p>`;
      return;
    }

    const { outstanding_balance, charges, payments, waivers } = res.data;
    statOutstanding.innerText = `฿${outstanding_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    // Check 500 THB threshold rule
    if (outstanding_balance >= 500) {
      cardOutstanding.classList.add('alert');
      statSubOutstanding.innerText = '⚠️ Account suspended (Limit ฿500 reached)';
      bannerContainer.innerHTML = `
        <div class="alert-box">
          <div class="icon">🚨</div>
          <div>
            <strong>Borrowing Privilege Suspended:</strong>
            Your outstanding fine balance of <strong>฿${outstanding_balance.toLocaleString()}</strong> has reached or exceeded the ฿500.00 threshold limit.
            Per university policy, borrowing, renewals, and new reservations are blocked until your balance is reduced below ฿500.00.
          </div>
        </div>
      `;
    } else {
      cardOutstanding.classList.remove('alert');
      statSubOutstanding.innerText = `Good standing (฿${(500 - outstanding_balance).toFixed(2)} under threshold)`;
      bannerContainer.innerHTML = '';
    }

    // Render Charges Table
    if (charges.length === 0) {
      chargesContainer.innerHTML = `<p style="color: var(--text-muted); padding: 20px; text-align: center;">No charges on record.</p>`;
    } else {
      chargesContainer.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Charge Type</th>
                <th>Amount (THB)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${charges
                .map((ch) => {
                  const dateStr = new Date(ch.created_at).toLocaleDateString();
                  const typeLabel =
                    ch.charge_type === 'LATE_FINE'
                      ? '⏱️ Late Overdue Fine'
                      : ch.charge_type === 'DAMAGE_CHARGE'
                      ? '🛠️ Book Damage Charge'
                      : ch.charge_type === 'LOST_REPLACEMENT'
                      ? '📕 Lost Book Replacement'
                      : '📋 Processing Fee';

                  return `
                  <tr>
                    <td style="color: var(--text-secondary);">${dateStr}</td>
                    <td style="font-weight: 500;">${typeLabel}</td>
                    <td style="font-weight: 700; color: #fb7185;">+฿${Number(ch.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td><span class="status-pill status-maintenance">${ch.status}</span></td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // Render Payments & Waivers Table
    const allCredits = [
      ...payments.map((p) => ({ ...p, type: 'PAYMENT' })),
      ...waivers.map((w) => ({ ...w, type: 'WAIVER' })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (allCredits.length === 0) {
      creditsContainer.innerHTML = `<p style="color: var(--text-muted); padding: 20px; text-align: center;">No payment or waiver transactions recorded.</p>`;
    } else {
      creditsContainer.innerHTML = `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Transaction Type</th>
                <th>Amount Paid / Waived</th>
                <th>Authorizer / Notes</th>
              </tr>
            </thead>
            <tbody>
              ${allCredits
                .map((cr: any) => {
                  const dateStr = new Date(cr.created_at).toLocaleDateString();
                  const isPayment = cr.type === 'PAYMENT';
                  const amount = isPayment ? cr.amount_paid : cr.amount_waived;
                  const note = isPayment
                    ? `Received by: ${cr.receiver_name || 'Librarian'}${cr.notes ? ` (${cr.notes})` : ''}`
                    : `Approved by Admin: ${cr.approver_name || 'Admin'} (Reason: "${cr.reason}")`;

                  return `
                  <tr>
                    <td style="color: var(--text-secondary);">${dateStr}</td>
                    <td>
                      <span class="status-pill ${isPayment ? 'status-available' : 'status-on-hold'}">
                        ${isPayment ? '💵 Payment Received' : '🛡️ Administrative Waiver'}
                      </span>
                    </td>
                    <td style="font-weight: 700; color: #34d399;">-฿${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td style="color: var(--text-secondary); font-size: 0.85rem;">${note}</td>
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

  container.querySelector('#btn-refresh-fines')?.addEventListener('click', loadFines);
  loadFines();
}
