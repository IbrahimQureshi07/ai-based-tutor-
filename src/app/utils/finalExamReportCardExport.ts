import html2canvas from 'html2canvas';
import { PDFDocument } from 'pdf-lib';

/**
 * Renders `element` to canvas → single-page PDF. On failure, downloads PNG instead.
 */
export async function downloadFinalExamReportCard(element: HTMLElement, filenameBase: string): Promise<void> {
  const safeName = filenameBase.replace(/[^\w.-]+/g, '_');
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });

  const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
  if (!pngBlob) {
    throw new Error('Could not create image');
  }
  const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());

  try {
    const pdfDoc = await PDFDocument.create();
    const pngImage = await pdfDoc.embedPng(pngBytes);
    const a4w = 595;
    const a4h = 842;
    const scale = Math.min(a4w / pngImage.width, a4h / pngImage.height, 1);
    const w = pngImage.width * scale;
    const h = pngImage.height * scale;
    const page = pdfDoc.addPage([a4w, a4h]);
    page.drawImage(pngImage, {
      x: (a4w - w) / 2,
      y: (a4h - h) / 2,
      width: w,
      height: h,
    });
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}.pdf`;
      a.rel = 'noopener';
      a.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    const url = URL.createObjectURL(pngBlob);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}.png`;
      a.rel = 'noopener';
      a.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** Opens system print dialog with a clone of the report (user can “Save as PDF”). */
export function printFinalExamReportCard(element: HTMLElement): void {
  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200');
  if (!w) return;
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.position = 'relative';
  clone.style.left = '0';
  clone.style.margin = '24px auto';
  w.document.open();
  w.document.write(
    `<!DOCTYPE html><html><head><title>Final exam report</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #fff; margin: 0; }
      @media print { body { margin: 0; } }
    </style></head><body></body></html>`
  );
  w.document.body.appendChild(clone);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 250);
}

export async function shareFinalExamReportCard(element: HTMLElement): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    logging: false,
  });
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
  if (!blob) throw new Error('Could not create image');

  const file = new File([blob], 'final-exam-report.png', { type: 'image/png' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: 'Final exam report',
      text: 'Final exam report card',
    });
    return;
  }

  if (navigator.clipboard && 'ClipboardItem' in window) {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return;
  }

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = 'final-exam-report.png';
    a.rel = 'noopener';
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
