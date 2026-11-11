import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { can, getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { audit } from "@/lib/services/guard";
import { buildColumns, cellText, parseQuery, queryDocuments } from "@/lib/services/document-query";
import type { FormField } from "@/lib/forms/schema";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Non authentifié", { status: 401 });

  const url = new URL(req.url);
  const raw: Record<string, string | string[]> = {};
  for (const k of new Set(url.searchParams.keys())) raw[k] = url.searchParams.getAll(k);
  const flat = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, k === "ids" ? v : v[0]]));
  const categoryId = String(url.searchParams.get("category") ?? "");
  const format = url.searchParams.get("format") ?? "xlsx";
  if (!["xlsx", "csv", "pdf"].includes(format)) return new Response("Format invalide", { status: 400 });

  // Contrôle d'accès à la catégorie (isolation inter-entreprises)
  const cat = await db.documentCategory.findFirst({
    where: { id: categoryId, ...(user.isSuperAdmin ? {} : { companyId: { in: user.companyIds } }) },
    include: { company: true, schemas: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!cat) return new Response("Introuvable", { status: 404 });
  if (!can(user, "documents.export", cat.companyId)) return new Response("Interdit", { status: 403 });

  const q = parseQuery(flat);
  const columns = buildColumns((cat.schemas[0]?.fields ?? []) as FormField[], "all"); // les exports contiennent toutes les colonnes
  const { rows, total } = await queryDocuments(cat.id, q, { paginate: false, max: 10000 });
  const header = columns.map((c) => c.label);
  const body = rows.map((r) => columns.map((c) => cellText(r, c.key)));
  const safe = `${cat.company.code}-${cat.slug}-${new Date().toISOString().slice(0, 10)}`;
  await audit(user, "document.export", "DocumentCategory", cat.id, undefined, { format, count: rows.length, total });

  if (format === "csv") {
    // Protection contre l'injection de formules dans Excel
    const esc = (s: string) => `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
    const csv = "﻿" + [header, ...body].map((r) => r.map(esc).join(";")).join("\r\n");
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${safe}.csv"` } });
  }

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(cat.name.slice(0, 31));
    ws.addRow(header).font = { bold: true };
    body.forEach((r) => ws.addRow(r.map((s) => (/^[=+\-@]/.test(s) ? `'${s}` : s))));
    ws.columns.forEach((c) => { c.width = 22; });
    const buf = await wb.xlsx.writeBuffer();
    return new Response(new Uint8Array(buf as ArrayBuffer), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${safe}.xlsx"` },
    });
  }

  const pdf = new jsPDF({ orientation: "landscape" });
  pdf.setFontSize(14);
  pdf.text(`${cat.company.name} — ${cat.name}`, 14, 14);
  pdf.setFontSize(9);
  pdf.text(`${rows.length} document(s) — exporté le ${new Date().toLocaleDateString("fr-FR")}`, 14, 20);
  autoTable(pdf, { head: [header], body, startY: 24, styles: { fontSize: 8 }, headStyles: { fillColor: [30, 41, 59] } });
  return new Response(new Uint8Array(pdf.output("arraybuffer")), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${safe}.pdf"` },
  });
}
