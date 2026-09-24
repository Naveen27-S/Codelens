import { jsPDF } from 'jspdf';

export interface ExportDataPayload {
  user: {
    full_name?: string;
    email?: string;
    id?: number | string;
    created_at?: string;
  } | null;
  settings: Record<string, any>;
  savedPrograms: Array<{
    program_id: string;
    name: string;
    language: string;
    code: string;
    description?: string;
    output?: string;
    created_at?: string;
    updated_at?: string;
  }>;
  executions: Array<{
    execution_id: string;
    program_name?: string;
    language: string;
    code?: string;
    status: string;
    execution_time?: number;
    stdout?: string;
    stderr?: string;
    created_at?: string;
  }>;
  stats?: {
    total_programs?: number;
    total_executions?: number;
    successful_executions?: number;
    failed_executions?: number;
  };
}

export function generateCodeLensPDF(data: ExportDataPayload): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 16;
  const contentWidth = pageWidth - marginX * 2;
  let currentY = 18;

  const ensureSpace = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 18) {
      doc.addPage();
      currentY = 18;
    }
  };

  // ── Header Banner ─────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(marginX, currentY, contentWidth, 24, 3, 3, 'F');

  doc.setFillColor(79, 70, 229); // indigo-600 accent bar
  doc.rect(marginX, currentY, 3, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('CodeLens AI — Personal Data & History Report', marginX + 8, currentY + 9);

  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const nowStr = new Date().toLocaleString();
  doc.text(`Generated on: ${nowStr}  |  Storage: MongoDB Atlas Cloud`, marginX + 8, currentY + 17);

  currentY += 30;

  // ── User Information Section ──────────────────────────────────────────────
  ensureSpace(28);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('1. USER ACCOUNT INFORMATION', marginX, currentY);

  currentY += 4;
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.4);
  doc.line(marginX, currentY, marginX + contentWidth, currentY);
  currentY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  const fullName = data.user?.full_name || 'CodeLens User';
  const email = data.user?.email || 'Not logged in / Local Session';
  const userId = data.user?.id ? String(data.user.id) : 'N/A';

  doc.text(`Account Name: ${fullName}`, marginX, currentY);
  doc.text(`Email Address: ${email}`, marginX + 90, currentY);
  currentY += 5;
  doc.text(`User ID: ${userId}`, marginX, currentY);
  doc.text(`Total Saved Snippets: ${data.savedPrograms.length}`, marginX + 90, currentY);
  currentY += 5;
  doc.text(`Total Executions: ${data.executions.length}`, marginX, currentY);
  const successCount = data.stats?.successful_executions ?? data.executions.filter((e) => e.status === 'success').length;
  doc.text(`Successful Runs: ${successCount}`, marginX + 90, currentY);
  currentY += 9;

  // ── Application Settings Section ──────────────────────────────────────────
  ensureSpace(32);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('2. USER PREFERENCES & SETTINGS', marginX, currentY);

  currentY += 4;
  doc.line(marginX, currentY, marginX + contentWidth, currentY);
  currentY += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  const s = data.settings || {};
  doc.text(`Theme: ${s.theme || 'Dark'}`, marginX, currentY);
  doc.text(`Accent Color: ${s.accentColor || 'Indigo'}`, marginX + 60, currentY);
  doc.text(`Editor Font Size: ${s.fontSize || 14}px`, marginX + 120, currentY);
  currentY += 5;
  doc.text(`Animation Speed: ${s.animationSpeed || '1x'}`, marginX, currentY);
  doc.text(`Minimap Enabled: ${s.minimap !== false ? 'Yes' : 'No'}`, marginX + 60, currentY);
  doc.text(`Auto AI Diagnosis: ${s.autoDiagnose !== false ? 'Yes' : 'No'}`, marginX + 120, currentY);
  currentY += 5;
  doc.text(`Voice Narration: ${s.voiceEnabled ? 'Enabled' : 'Disabled'}`, marginX, currentY);
  doc.text(`Voice Speed: ${s.voiceRate || 1}x`, marginX + 60, currentY);
  doc.text(`AI Tutor Persona: ${s.aiPersona || 'Friendly Mentor'}`, marginX + 120, currentY);
  currentY += 10;

  // ── Saved Code Snippets Section ───────────────────────────────────────────
  ensureSpace(24);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`3. SAVED CODE SNIPPETS (${data.savedPrograms.length})`, marginX, currentY);

  currentY += 4;
  doc.line(marginX, currentY, marginX + contentWidth, currentY);
  currentY += 6;

  if (data.savedPrograms.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('No saved code snippets found in MongoDB library.', marginX, currentY);
    currentY += 10;
  } else {
    data.savedPrograms.forEach((prog, idx) => {
      ensureSpace(35);

      // Card Header
      doc.setFillColor(241, 245, 249); // slate-100
      doc.roundedRect(marginX, currentY, contentWidth, 8, 1.5, 1.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      const title = `${idx + 1}. ${prog.name || 'Untitled'}`;
      doc.text(title, marginX + 3, currentY + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(79, 70, 229);
      const langUpper = (prog.language || 'code').toUpperCase();
      doc.text(`[${langUpper}]`, marginX + contentWidth - 25, currentY + 5.5);

      currentY += 10;

      if (prog.description) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        const descLines = doc.splitTextToSize(`Description: ${prog.description}`, contentWidth);
        ensureSpace(descLines.length * 4);
        doc.text(descLines, marginX + 3, currentY);
        currentY += descLines.length * 4 + 2;
      }

      // Code Block box
      doc.setFont('courier', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);

      // Limit code lines to avoid overly huge PDFs if snippet is massive
      const rawLines = (prog.code || '').split('\n').slice(0, 40);
      const codeSnippet = rawLines.join('\n');
      const splitCode = doc.splitTextToSize(codeSnippet, contentWidth - 6);

      const blockHeight = Math.min(splitCode.length * 3.4 + 4, 65);
      ensureSpace(blockHeight + 4);

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(marginX, currentY, contentWidth, blockHeight, 1.5, 1.5, 'FD');

      const maxPrintLines = Math.floor((blockHeight - 4) / 3.4);
      doc.text(splitCode.slice(0, maxPrintLines), marginX + 3, currentY + 3.8);

      currentY += blockHeight + 6;
    });
  }

  // ── Past Execution Records Section ────────────────────────────────────────
  ensureSpace(24);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`4. PAST CODE EXECUTIONS (${data.executions.length})`, marginX, currentY);

  currentY += 4;
  doc.line(marginX, currentY, marginX + contentWidth, currentY);
  currentY += 6;

  if (data.executions.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text('No past execution records found in MongoDB.', marginX, currentY);
    currentY += 10;
  } else {
    // Show up to 25 recent executions
    const recentExecs = data.executions.slice(0, 25);
    recentExecs.forEach((exec, idx) => {
      ensureSpace(22);

      const isSuccess = exec.status === 'success';
      doc.setFillColor(isSuccess ? 240 : 254, isSuccess ? 253 : 242, isSuccess ? 244 : 242);
      doc.setDrawColor(isSuccess ? 187 : 254, isSuccess ? 247 : 202, isSuccess ? 208 : 202);
      doc.setLineWidth(0.3);
      doc.roundedRect(marginX, currentY, contentWidth, 14, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(isSuccess ? 21 : 185, isSuccess ? 128 : 28, isSuccess ? 61 : 28);
      const statusText = isSuccess ? '✓ SUCCESS' : '✕ ERROR / FAILED';
      doc.text(`${idx + 1}. ${statusText}`, marginX + 3, currentY + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const langText = (exec.language || 'Code').toUpperCase();
      const timeText = exec.execution_time ? `${exec.execution_time.toFixed(2)}s` : '0.01s';
      const dateText = exec.created_at ? new Date(exec.created_at).toLocaleDateString() : 'Recent';
      doc.text(`Language: ${langText}  |  Runtime: ${timeText}  |  Date: ${dateText}`, marginX + 35, currentY + 5);

      const outputPreview = (exec.stdout || exec.stderr || 'Executed cleanly with standard output.')
        .replace(/\n/g, ' ')
        .slice(0, 85);
      doc.setFont('courier', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Output: ${outputPreview}`, marginX + 3, currentY + 10.5);

      currentY += 17;
    });
  }

  // ── Footer with Page Numbers on all pages ──────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);

    doc.line(marginX, pageHeight - 12, marginX + contentWidth, pageHeight - 12);
    doc.text('CodeLens AI — AI-Powered Interactive Code Visualizer & Learning Platform', marginX, pageHeight - 7);
    doc.text(`Page ${i} of ${totalPages}`, marginX + contentWidth - 18, pageHeight - 7);
  }

  // Download PDF
  const safeName = (data.user?.full_name || 'CodeLens_User').replace(/\s+/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`CodeLens_Data_Export_${safeName}_${dateStr}.pdf`);
}

export function downloadJsonBackup(data: ExportDataPayload): void {
  const safeName = (data.user?.full_name || 'CodeLens_User').replace(/\s+/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CodeLens_Data_Backup_${safeName}_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
