import { api } from '../services/api.js';
import { showToast } from '../state/store.js';

export async function renderReservationsView(container: HTMLElement) {
  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">
        <h2>⏳ Book Reservations & Queue</h2>
        <p>Monitor your active book reservations, view your FIFO queue positions, and track 48-hour hold pickups.</p>
      </div>
      <button class="btn btn-secondary btn-sm" id="btn-refresh-res">🔄 Refresh</button>
    </div>

    <div class="glass-panel">
      <div id="reservations-table-container">
        <p style="color: var(--text-muted);">Loading reservations...</p>
      </div>
    </div>
  `;

  const tableContainer = container.querySelector('#reservations-table-container') as HTMLElement;

  async function loadReservations() {
    const res = await api.getMyReservations();
    if (!res.success || !res.data || res.data.length === 0) {
      tableContainer.innerHTML = `
        <div style="text-align: center; padding: 50px 20px; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 12px;">⏳</div>
          <h3>No Active Reservations</h3>
          <p style="font-size: 0.85rem; margin-top: 4px;">You have not reserved any books. You can reserve books with 0 available copies from the catalog.</p>
        </div>
      `;
      return;
    }

    tableContainer.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Book Title</th>
              <th>Queue Position</th>
              <th>Status</th>
              <th>Allocated Barcode</th>
              <th>Hold Expiration (48h)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${res.data
              .map((r) => {
                const isOnHold = r.status === 'ON_HOLD';
                let holdStr = '-';
                if (isOnHold && r.hold_expires_at) {
                  const expireDate = new Date(r.hold_expires_at);
                  const diffHours = Math.max(0, Math.round((expireDate.getTime() - Date.now()) / (1000 * 60 * 60)));
                  holdStr = `⏰ ${diffHours} hours remaining (${expireDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
                }

                const statusClass = isOnHold
                  ? 'status-on-hold'
                  : r.status === 'PENDING'
                  ? 'status-on-loan'
                  : r.status === 'EXPIRED'
                  ? 'status-lost'
                  : 'status-available';

                return `
                <tr>
                  <td style="font-weight: 600; color: #fff;">${r.book_title}</td>
                  <td><span style="font-family: var(--font-heading); font-size: 1.1rem; font-weight: 800; color: var(--accent-cyan);">#${r.queue_position}</span></td>
                  <td><span class="status-pill ${statusClass}">${r.status}</span></td>
                  <td>${r.copy_barcode ? `<code>${r.copy_barcode}</code>` : '<span style="color: var(--text-muted);">-</span>'}</td>
                  <td style="${isOnHold ? 'color: #fbbf24; font-weight: 600;' : 'color: var(--text-muted);'}">${holdStr}</td>
                  <td>
                    ${
                      r.status === 'PENDING' || r.status === 'ON_HOLD'
                        ? `<button class="btn btn-danger btn-sm btn-cancel-res" data-res-id="${r.id}">Cancel</button>`
                        : `<span style="color: var(--text-muted); font-size: 0.8rem;">-</span>`
                    }
                  </td>
                </tr>
              `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;

    tableContainer.querySelectorAll('.btn-cancel-res').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = (e.currentTarget as HTMLElement).getAttribute('data-res-id')!;
        if (confirm('Are you sure you want to cancel this reservation?')) {
          showToast('Cancelling reservation...', 'info');
          const cancelRes = await api.cancelReservation(id);
          if (cancelRes.success) {
            showToast('Reservation cancelled', 'success');
            loadReservations();
          } else {
            showToast(cancelRes.error?.message || 'Failed to cancel', 'error');
          }
        }
      });
    });
  }

  container.querySelector('#btn-refresh-res')?.addEventListener('click', loadReservations);
  loadReservations();
}
