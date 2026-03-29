'use strict';

const PDFDocument = require('pdfkit');
const { findOne, executeQuery } = require('../config/database');

/**
 * GET /export/transactions/:userId
 * Exports user's transactions as CSV. Pro tier only.
 */
const exportTransactions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { format: fmt = 'csv', month, year } = req.query;

    // Tier check
    const user = await findOne('SELECT subscription_tier FROM users WHERE id = ?', [userId]);
    if (!user || (user.subscription_tier !== 'pro')) {
      return res.status(403).json({
        message: 'CSV/PDF export is available on the Pro plan. Upgrade to access this feature.',
        code: 'TIER_LIMIT_EXPORT',
      });
    }

    let dateFilter = '';
    const params = [userId, userId, userId];

    if (year && month) {
      dateFilter = ' AND (YEAR(COALESCE(t.date, t.due_date, t.created_at)) = ? AND MONTH(COALESCE(t.date, t.due_date, t.created_at)) = ?)';
      params.push(parseInt(year), parseInt(month));
    } else if (year) {
      dateFilter = ' AND YEAR(COALESCE(t.date, t.due_date, t.created_at)) = ?';
      params.push(parseInt(year));
    }

    const transactions = await executeQuery(`
      SELECT
        t.id, t.type, t.title, t.amount, t.date, t.due_date,
        t.category, t.recurrence, t.status, t.is_shared, t.created_at,
        CASE WHEN t.user_id = ? THEN 'owner' ELSE 'participant' END AS role,
        COALESCE(tp.amount_owed, t.amount) AS my_share,
        COALESCE(tp.status, t.status) AS my_payment_status
      FROM transactions t
      LEFT JOIN transaction_participants tp ON t.id = tp.transaction_id AND tp.user_id = ?
      WHERE (t.user_id = ? OR tp.user_id IS NOT NULL)${dateFilter}
      ORDER BY COALESCE(t.date, t.due_date, t.created_at) DESC
    `, params);

    if (fmt === 'csv') {
      const header = 'Date,Type,Title,Category,Total Amount,My Share,Role,Payment Status,Shared,Recurrence\n';
      const rows = transactions.map(t => {
        const date = t.date || t.due_date || t.created_at;
        const dateStr = date ? new Date(date).toISOString().split('T')[0] : '';
        const title = `"${(t.title || '').replace(/"/g, '""')}"`;
        const category = `"${(t.category || '').replace(/"/g, '""')}"`;
        return [
          dateStr, t.type, title, category,
          parseFloat(t.amount).toFixed(2),
          parseFloat(t.my_share).toFixed(2),
          t.role, t.my_payment_status,
          t.is_shared ? 'Yes' : 'No',
          t.recurrence || '',
        ].join(',');
      }).join('\n');

      const filename = year && month
        ? `spendsync-${year}-${String(month).padStart(2, '0')}.csv`
        : `spendsync-transactions.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(header + rows);
    }

    // JSON fallback
    res.json({ transactions });
  } catch (error) {
    console.error('[Export] Error:', error);
    res.status(500).json({ message: 'Failed to export transactions' });
  }
};

/**
 * GET /export/report/:userId?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Generates a PDF report with separate totals for expenses, billings, and earnings.
 * Pro tier only.
 */
const exportReport = async (req, res) => {
  try {
    const { userId } = req.params;
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ message: 'Both "from" and "to" query parameters are required (YYYY-MM-DD).' });
    }

    // Tier check
    const user = await findOne('SELECT subscription_tier, username, email FROM users WHERE id = ?', [userId]);
    if (!user || user.subscription_tier !== 'pro') {
      return res.status(403).json({
        message: 'PDF report export is available on the Pro plan. Upgrade to access this feature.',
        code: 'TIER_LIMIT_EXPORT',
      });
    }

    const transactions = await executeQuery(`
      SELECT
        t.id, t.type, t.title, t.amount, t.date, t.due_date,
        t.category, t.status, t.is_shared, t.created_at,
        CASE WHEN t.user_id = ? THEN 'owner' ELSE 'participant' END AS role,
        COALESCE(tp.amount_owed, t.amount) AS my_share
      FROM transactions t
      LEFT JOIN transaction_participants tp ON t.id = tp.transaction_id AND tp.user_id = ?
      WHERE (t.user_id = ? OR tp.user_id IS NOT NULL)
        AND DATE(COALESCE(t.date, t.due_date, t.created_at)) >= ?
        AND DATE(COALESCE(t.date, t.due_date, t.created_at)) <= ?
      ORDER BY COALESCE(t.date, t.due_date, t.created_at) ASC
    `, [userId, userId, userId, from, to]);

    // Separate by type
    const expenses = transactions.filter(t => t.type === 'expense');
    const billings = transactions.filter(t => t.type === 'bill');
    const earnings = transactions.filter(t => t.type === 'income');

    const sumShare = (arr) => arr.reduce((s, t) => s + parseFloat(t.my_share || 0), 0);
    const totalExpenses = sumShare(expenses);
    const totalBillings = sumShare(billings);
    const totalEarnings = sumShare(earnings);

    // Build PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    const filename = `spendsync-report-${from}-to-${to}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    const primary = '#4F46E5';
    const gray = '#6B7280';
    const darkText = '#111827';
    const lightBg = '#F9FAFB';

    // ── Header ──
    doc.fontSize(22).fillColor(primary).text('SpendSync', 50, 50);
    doc.fontSize(10).fillColor(gray).text('Transaction Report', 50, 75);
    doc.moveTo(50, 95).lineTo(545, 95).strokeColor('#E5E7EB').stroke();

    // ── Report info ──
    doc.fontSize(10).fillColor(gray);
    doc.text(`Account: ${user.username || user.email}`, 50, 105);
    doc.text(`Period: ${from}  to  ${to}`, 50, 120);
    doc.text(`Generated: ${new Date().toISOString().split('T')[0]}`, 50, 135);

    // ── Summary box ──
    let y = 160;
    doc.roundedRect(50, y, 495, 80, 4).fillAndStroke('#F3F4F6', '#E5E7EB');

    doc.fontSize(11).fillColor(darkText).text('Summary', 70, y + 12);

    // Three columns
    const colWidth = 150;
    const cols = [
      { label: 'Expenses', value: totalExpenses, color: '#EF4444' },
      { label: 'Billings', value: totalBillings, color: '#F59E0B' },
      { label: 'Earnings', value: totalEarnings, color: '#10B981' },
    ];

    cols.forEach((col, i) => {
      const cx = 70 + i * colWidth;
      doc.fontSize(9).fillColor(gray).text(col.label, cx, y + 32);
      doc.fontSize(16).fillColor(col.color).text(`$${col.value.toFixed(2)}`, cx, y + 46);
    });

    // Net total
    const net = totalEarnings - totalExpenses - totalBillings;
    doc.fontSize(9).fillColor(gray).text('Net', 70 + 3 * colWidth, y + 32);
    doc.fontSize(16).fillColor(net >= 0 ? '#10B981' : '#EF4444')
      .text(`${net >= 0 ? '+' : ''}$${net.toFixed(2)}`, 70 + 3 * colWidth, y + 46);

    y += 100;

    // ── Helper: draw a transaction table section ──
    const drawSection = (title, color, items) => {
      if (y > 700) { doc.addPage(); y = 50; }

      // Section header
      doc.fontSize(13).fillColor(color).text(title, 50, y);
      y += 20;

      if (items.length === 0) {
        doc.fontSize(10).fillColor(gray).text('No transactions in this period.', 50, y);
        y += 25;
        return;
      }

      // Table header
      const colX = { date: 50, title: 120, category: 290, amount: 410, status: 480 };
      doc.rect(50, y, 495, 18).fill('#F3F4F6');
      doc.fontSize(8).fillColor(gray);
      doc.text('Date', colX.date + 4, y + 5);
      doc.text('Title', colX.title + 4, y + 5);
      doc.text('Category', colX.category + 4, y + 5);
      doc.text('My Share', colX.amount + 4, y + 5);
      doc.text('Status', colX.status + 4, y + 5);
      y += 18;

      items.forEach((t, idx) => {
        if (y > 750) { doc.addPage(); y = 50; }

        // Alternating row background
        if (idx % 2 === 0) {
          doc.rect(50, y, 495, 16).fill(lightBg);
        }

        const date = t.date || t.due_date || t.created_at;
        const dateStr = date ? new Date(date).toISOString().split('T')[0] : '';
        const titleText = (t.title || '').substring(0, 28);
        const categoryText = (t.category || '-').substring(0, 18);
        const share = parseFloat(t.my_share || 0).toFixed(2);

        doc.fontSize(8).fillColor(darkText);
        doc.text(dateStr, colX.date + 4, y + 4, { width: 65 });
        doc.text(titleText, colX.title + 4, y + 4, { width: 165 });
        doc.text(categoryText, colX.category + 4, y + 4, { width: 115 });
        doc.text(`$${share}`, colX.amount + 4, y + 4, { width: 60 });
        doc.fontSize(7).fillColor(t.status === 'paid' ? '#10B981' : '#F59E0B')
          .text(t.status || '-', colX.status + 4, y + 4, { width: 60 });
        y += 16;
      });

      // Section subtotal
      const sectionTotal = sumShare(items);
      doc.moveTo(50, y).lineTo(545, y).strokeColor('#E5E7EB').stroke();
      y += 4;
      doc.fontSize(9).fillColor(darkText).text('Subtotal:', 350, y);
      doc.fontSize(9).fillColor(color).text(`$${sectionTotal.toFixed(2)}`, 412, y);
      y += 25;
    };

    drawSection('Expenses', '#EF4444', expenses);
    drawSection('Billings', '#F59E0B', billings);
    drawSection('Earnings', '#10B981', earnings);

    // ── Footer ──
    if (y > 750) { doc.addPage(); y = 50; }
    doc.moveTo(50, y + 10).lineTo(545, y + 10).strokeColor('#E5E7EB').stroke();
    doc.fontSize(8).fillColor(gray)
      .text('Generated by SpendSync (spend-sync.com)', 50, y + 18, { align: 'center', width: 495 });

    doc.end();
  } catch (error) {
    console.error('[Export] PDF report error:', error);
    res.status(500).json({ message: 'Failed to generate report' });
  }
};

module.exports = { exportTransactions, exportReport };
