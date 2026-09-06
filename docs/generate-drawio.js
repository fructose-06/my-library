import fs from 'fs';
import path from 'path';

function escapeXmlAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/"/g, '&quot;');
}

// Helper to generate mxCell XML strings
class DrawioBuilder {
  constructor() {
    this.cells = [];
    this.idCounter = 2;
  }

  nextId() {
    return `cell_${this.idCounter++}`;
  }

  addEntity(name, x, y, w = 140, h = 60, isWeak = false) {
    const id = this.nextId();
    const style = isWeak
      ? 'shape=ext;double=1;rounded=0;whiteSpace=wrap;html=1;fontStyle=1;fontSize=14;fillColor=#dae8fc;strokeColor=#6c8ebf;strokeWidth=2;'
      : 'rounded=0;whiteSpace=wrap;html=1;fontStyle=1;fontSize=14;fillColor=#dae8fc;strokeColor=#6c8ebf;strokeWidth=2;';
    const val = escapeXmlAttr(`&lt;b&gt;${name}&lt;/b&gt;`);
    this.cells.push(`
      <mxCell id="${id}" value="${val}" style="${style}" vertex="1" parent="1">
        <mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry" />
      </mxCell>`);
    return { id, x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
  }

  addRelationship(name, x, y, w = 130, h = 70, isIdentifying = false) {
    const id = this.nextId();
    const style = isIdentifying
      ? 'shape=rhombus;double=1;whiteSpace=wrap;html=1;fontStyle=1;fontSize=12;fillColor=#d5e8d4;strokeColor=#82b366;strokeWidth=2;'
      : 'rhombus;whiteSpace=wrap;html=1;fontStyle=1;fontSize=12;fillColor=#d5e8d4;strokeColor=#82b366;strokeWidth=2;';
    const val = escapeXmlAttr(name);
    this.cells.push(`
      <mxCell id="${id}" value="${val}" style="${style}" vertex="1" parent="1">
        <mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry" />
      </mxCell>`);
    return { id, x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
  }

  addAttribute(name, x, y, options = {}) {
    const { isKey = false, isDerived = false, isMultivalued = false, isPartial = false, w = 110, h = 42 } = options;
    const id = this.nextId();
    let style = 'ellipse;whiteSpace=wrap;html=1;fontSize=11;fillColor=#fff2cc;strokeColor=#d6b656;';
    let val = name;

    if (isKey) {
      style = 'ellipse;whiteSpace=wrap;html=1;fontSize=11;fontStyle=4;fontColor=#b85450;fillColor=#f8cecc;strokeColor=#b85450;strokeWidth=2;';
      val = `&lt;u&gt;&lt;b&gt;${name}&lt;/b&gt;&lt;/u&gt;`;
    } else if (isPartial) {
      style = 'ellipse;whiteSpace=wrap;html=1;fontSize=11;strokeColor=#d6b656;strokeWidth=1;dashed=1;fillColor=#fff2cc;';
      val = `&lt;span style="text-decoration: underline dotted;"&gt;${name}&lt;/span&gt;`;
    } else if (isDerived) {
      style = 'ellipse;whiteSpace=wrap;html=1;fontSize=11;dashed=1;dashPattern=3 3;fillColor=#e1d5e7;strokeColor=#9673a6;strokeWidth=1.5;';
      val = `&lt;i&gt;${name}&lt;/i&gt;`;
    } else if (isMultivalued) {
      style = 'shape=ellipse;double=1;whiteSpace=wrap;html=1;fontSize=11;fillColor=#fff2cc;strokeColor=#d6b656;';
    }

    const escapedVal = escapeXmlAttr(val);
    this.cells.push(`
      <mxCell id="${id}" value="${escapedVal}" style="${style}" vertex="1" parent="1">
        <mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry" />
      </mxCell>`);
    return { id, x, y, w, h, cx: x + w / 2, cy: y + h / 2 };
  }

  connect(sourceId, targetId, label = '', isDoubleLine = false) {
    const id = this.nextId();
    let style = 'endArrow=none;html=1;rounded=0;strokeColor=#333333;fontSize=12;fontStyle=1;';
    if (isDoubleLine) {
      style += 'strokeWidth=3;';
    } else {
      style += 'strokeWidth=1.5;';
    }
    const val = escapeXmlAttr(label);
    this.cells.push(`
      <mxCell id="${id}" value="${val}" style="${style}" edge="1" parent="1" source="${sourceId}" target="${targetId}">
        <mxGeometry relative="1" as="geometry" />
      </mxCell>`);
    return id;
  }

  connectAttr(entityId, attrId) {
    const id = this.nextId();
    const style = 'endArrow=none;html=1;rounded=0;strokeColor=#999999;strokeWidth=1;';
    this.cells.push(`
      <mxCell id="${id}" value="" style="${style}" edge="1" parent="1" source="${entityId}" target="${attrId}">
        <mxGeometry relative="1" as="geometry" />
      </mxCell>`);
    return id;
  }

  addText(text, x, y, w, h, style = '') {
    const id = this.nextId();
    const val = escapeXmlAttr(text);
    this.cells.push(`
      <mxCell id="${id}" value="${val}" style="text;html=1;strokeColor=none;fillColor=none;align=left;verticalAlign=top;whiteSpace=wrap;rounded=0;${style}" vertex="1" parent="1">
        <mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry" />
      </mxCell>`);
    return id;
  }

  addBox(x, y, w, h, style = '') {
    const id = this.nextId();
    this.cells.push(`
      <mxCell id="${id}" value="" style="${style}" vertex="1" parent="1">
        <mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry" />
      </mxCell>`);
    return id;
  }

  buildXml() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${new Date().toISOString()}" agent="UniLib Core Chen ERD Generator" version="24.7.5">
  <diagram id="unilib_chen_erd" name="UniLib Chen ER Diagram">
    <mxGraphModel dx="1800" dy="1200" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="2800" pageHeight="2200" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
${this.cells.join('\n')}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
  }
}

const b = new DrawioBuilder();

// ==========================================
// 1. TITLE & LEGEND HEADER
// ==========================================
b.addBox(50, 30, 2680, 100, 'rounded=1;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;fontColor=#333333;');
b.addText(
  '&lt;h1 style="margin:0; font-size:22px; color:#1e293b;"&gt;UniLib Core — Peter Chen ER Diagram (Conceptual Database Model)&lt;/h1&gt;' +
  '&lt;p style="margin:4px 0 0 0; color:#475569; font-size:13px;"&gt;Production Enterprise Edition — Complete 11 Entities, Cardinality Ratios (1:1, 1:N, M:N), Weak Entities, Keys &amp; Derived Attributes for draw.io&lt;/p&gt;',
  70, 45, 1100, 70
);

// Legend items
b.addBox(1200, 45, 1500, 70, 'rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#cccccc;');
b.addText('&lt;b&gt;CHEN NOTATION LEGEND:&lt;/b&gt;', 1215, 55, 180, 20, 'fontSize=11;fontColor=#333;');

// Legend shapes
b.addEntity('Entity', 1370, 52, 70, 32);
b.addEntity('Weak Entity', 1460, 52, 90, 32, true);
b.addRelationship('Relation', 1570, 45, 75, 45);
b.addRelationship('Ident. Rel', 1660, 45, 85, 45, true);
b.addAttribute('PK Key', 1765, 52, { isKey: true, w: 75, h: 32 });
b.addAttribute('Attribute', 1855, 52, { w: 75, h: 32 });
b.addAttribute('Derived', 1945, 52, { isDerived: true, w: 75, h: 32 });
b.addText('&lt;b&gt;1 : N&lt;/b&gt; Cardinality&lt;br&gt;&lt;b&gt;===&lt;/b&gt; Total Partic.', 2040, 50, 120, 40, 'fontSize=11;fontColor=#555;');

// ==========================================
// 2. ENTITIES
// ==========================================

// --- BOOK (Center Top) ---
const book = b.addEntity('BOOK', 800, 300, 160, 70);
const bk_id = b.addAttribute('id', 660, 190, { isKey: true });
const bk_isbn = b.addAttribute('isbn', 770, 180, { isKey: true }); // Alternate key
const bk_title = b.addAttribute('title', 890, 180);
const bk_desc = b.addAttribute('description', 1000, 200);
const bk_pub = b.addAttribute('publisher', 1020, 250);
const bk_year = b.addAttribute('publication_year', 620, 260);
const bk_lang = b.addAttribute('language', 620, 330);
const bk_status = b.addAttribute('status', 630, 400);

[bk_id, bk_isbn, bk_title, bk_desc, bk_pub, bk_year, bk_lang, bk_status].forEach(a => b.connectAttr(book.id, a.id));

// --- AUTHOR (Top Left) ---
const author = b.addEntity('AUTHOR', 220, 230, 130, 60);
const au_id = b.addAttribute('id', 110, 190, { isKey: true });
const au_name = b.addAttribute('name', 110, 260);
[au_id, au_name].forEach(a => b.connectAttr(author.id, a.id));

// Relation Book <-> Author
const rel_written = b.addRelationship('WRITTEN_BY', 500, 235, 130, 65);
b.connect(author.id, rel_written.id, 'N');
b.connect(book.id, rel_written.id, 'M');

// --- CATEGORY (Mid Left) ---
const category = b.addEntity('CATEGORY', 220, 430, 130, 60);
const cat_id = b.addAttribute('id', 110, 400, { isKey: true });
const cat_name = b.addAttribute('name', 110, 470);
[cat_id, cat_name].forEach(a => b.connectAttr(category.id, a.id));

// Relation Book <-> Category
const rel_classified = b.addRelationship('CLASSIFIED_AS', 500, 425, 130, 65);
b.connect(category.id, rel_classified.id, 'N');
b.connect(book.id, rel_classified.id, 'M');

// --- PHYSICAL_COPY (Weak Entity dependent on Book) ---
const copy = b.addEntity('PHYSICAL_COPY', 1400, 300, 160, 70, true);
const cp_id = b.addAttribute('id', 1600, 210, { isKey: true });
const cp_barcode = b.addAttribute('barcode', 1510, 180, { isKey: true });
const cp_price = b.addAttribute('acquisition_price', 1400, 180);
const cp_date = b.addAttribute('acquisition_date', 1620, 270);
const cp_status = b.addAttribute('status', 1620, 330);
const cp_ver = b.addAttribute('version', 1620, 390);

[cp_id, cp_barcode, cp_price, cp_date, cp_status, cp_ver].forEach(a => b.connectAttr(copy.id, a.id));

// Identifying Relationship Book -> PhysicalCopy (1 : N)
const rel_has_copies = b.addRelationship('HAS_COPIES', 1130, 305, 130, 65, true);
b.connect(book.id, rel_has_copies.id, '1');
b.connect(copy.id, rel_has_copies.id, 'N', true); // total participation

// --- USER (Center) ---
const user = b.addEntity('USER', 600, 780, 160, 70);
const u_id = b.addAttribute('id', 440, 680, { isKey: true });
const u_uni_id = b.addAttribute('university_id', 540, 660, { isKey: true });
const u_email = b.addAttribute('email', 670, 660);
const u_pass = b.addAttribute('password_hash', 420, 740);
const u_name = b.addAttribute('full_name', 420, 800);
const u_role = b.addAttribute('role', 420, 860);
const u_status = b.addAttribute('status', 440, 920);
const u_balance = b.addAttribute('outstanding_balance', 560, 920, { isDerived: true });
const u_active_loans = b.addAttribute('active_loans_count', 680, 920, { isDerived: true });

[u_id, u_uni_id, u_email, u_pass, u_name, u_role, u_status, u_balance, u_active_loans].forEach(a => b.connectAttr(user.id, a.id));

// --- LOAN (Circulation Entity) ---
const loan = b.addEntity('LOAN', 1400, 780, 160, 70);
const ln_id = b.addAttribute('id', 1600, 700, { isKey: true });
const ln_bdate = b.addAttribute('borrow_date', 1620, 760);
const ln_ddate = b.addAttribute('due_date', 1620, 820);
const ln_rdate = b.addAttribute('return_date', 1620, 880);
const ln_renew = b.addAttribute('renewal_count', 1540, 920);
const ln_status = b.addAttribute('status', 1430, 930);
const ln_fine = b.addAttribute('calculated_fine', 1330, 930, { isDerived: true });

[ln_id, ln_bdate, ln_ddate, ln_rdate, ln_renew, ln_status, ln_fine].forEach(a => b.connectAttr(loan.id, a.id));

// Relationship: User BORROWS (via Loan) -> 1 : N
const rel_borrows = b.addRelationship('BORROWS', 980, 785, 130, 65);
b.connect(user.id, rel_borrows.id, '1');
b.connect(loan.id, rel_borrows.id, 'N');

// Relationship: PhysicalCopy LOANED_IN Loan -> 1 : N
const rel_loaned = b.addRelationship('OF_COPY', 1415, 545, 130, 65);
b.connect(copy.id, rel_loaned.id, '1');
b.connect(loan.id, rel_loaned.id, 'N');

// --- RESERVATION (FIFO Queue Entity) ---
const res = b.addEntity('RESERVATION', 800, 1250, 160, 70);
const rs_id = b.addAttribute('id', 650, 1370, { isKey: true });
const rs_pos = b.addAttribute('queue_position', 770, 1380);
const rs_stat = b.addAttribute('status', 890, 1380);
const rs_exp = b.addAttribute('hold_expires_at', 1010, 1370);

[rs_id, rs_pos, rs_stat, rs_exp].forEach(a => b.connectAttr(res.id, a.id));

// Relationship: User RESERVES Book
const rel_reserves = b.addRelationship('PLACES_RES', 650, 1050, 130, 65);
b.connect(user.id, rel_reserves.id, '1');
b.connect(res.id, rel_reserves.id, 'N');

const rel_res_book = b.addRelationship('TARGET_BOOK', 815, 785, 130, 65);
b.connect(book.id, rel_res_book.id, '1');
b.connect(res.id, rel_res_book.id, 'N');

// Optional allocation of PhysicalCopy to Reservation when ON_HOLD
const rel_alloc = b.addRelationship('ALLOCATED_TO', 1130, 1255, 130, 65);
b.connect(copy.id, rel_alloc.id, '0..1');
b.connect(res.id, rel_alloc.id, '1');

// --- FINE_LEDGER (Double-Entry Financial Ledger) ---
const fine = b.addEntity('FINE_LEDGER', 1400, 1250, 160, 70);
const fn_id = b.addAttribute('id', 1600, 1180, { isKey: true });
const fn_type = b.addAttribute('charge_type', 1620, 1240);
const fn_amt = b.addAttribute('amount', 1620, 1300);
const fn_stat = b.addAttribute('status', 1600, 1360);

[fn_id, fn_type, fn_amt, fn_stat].forEach(a => b.connectAttr(fine.id, a.id));

// Relationship: User INCURS FineLedger (1 : N)
const rel_incurs = b.addRelationship('INCURS', 1120, 1050, 130, 65);
b.connect(user.id, rel_incurs.id, '1');
b.connect(fine.id, rel_incurs.id, 'N');

// Relationship: Loan GENERATES FineLedger (0..1 : N)
const rel_loan_fine = b.addRelationship('ASSESSED_FROM', 1415, 1040, 130, 65);
b.connect(loan.id, rel_loan_fine.id, '0..1');
b.connect(fine.id, rel_loan_fine.id, 'N');

// --- PAYMENT (Financial Transaction) ---
const payment = b.addEntity('PAYMENT', 2050, 780, 150, 70);
const pay_id = b.addAttribute('id', 2230, 710, { isKey: true });
const pay_amt = b.addAttribute('amount_paid', 2250, 770);
const pay_date = b.addAttribute('created_at', 2250, 830);

[pay_id, pay_amt, pay_date].forEach(a => b.connectAttr(payment.id, a.id));

// Relationship: User PAYS Payment (1 : N)
const rel_pays = b.addRelationship('MAKES_PAYMENT', 1780, 785, 130, 65);
b.connect(user.id, rel_pays.id, '1');
b.connect(payment.id, rel_pays.id, 'N');

// --- WAIVER (Admin Authorization) ---
const waiver = b.addEntity('WAIVER', 2050, 1250, 150, 70);
const wv_id = b.addAttribute('id', 2230, 1180, { isKey: true });
const wv_amt = b.addAttribute('amount_waived', 2250, 1240);
const wv_reason = b.addAttribute('reason', 2250, 1300);

[wv_id, wv_amt, wv_reason].forEach(a => b.connectAttr(waiver.id, a.id));

// Relationship: User RECEIVES Waiver (1 : N)
const rel_waived = b.addRelationship('RECEIVES_WAIVER', 1780, 1255, 130, 65);
b.connect(user.id, rel_waived.id, '1');
b.connect(waiver.id, rel_waived.id, 'N');

// --- AUDIT_LOG (Immutable Security Trail) ---
const audit = b.addEntity('AUDIT_LOG', 2050, 300, 150, 70);
const ad_id = b.addAttribute('id', 2230, 230, { isKey: true });
const ad_act = b.addAttribute('action', 2250, 290);
const ad_res = b.addAttribute('resource_type', 2250, 350);
const ad_time = b.addAttribute('created_at', 2230, 410);

[ad_id, ad_act, ad_res, ad_time].forEach(a => b.connectAttr(audit.id, a.id));

// Relationship: User PERFORMS AuditLog (1 : N)
const rel_performs = b.addRelationship('LOGS_ACTION', 1780, 305, 130, 65);
b.connect(user.id, rel_performs.id, '0..1');
b.connect(audit.id, rel_performs.id, 'N');

// ==========================================
// 3. WRITE OUTPUT
// ==========================================
const xml = b.buildXml();
const targetPath = path.resolve('c:/Users/fruct/Desktop/library/docs/chen-er-diagram.drawio');
fs.writeFileSync(targetPath, xml, 'utf8');
console.log('Created Chen ER Diagram at:', targetPath);
