import { NextResponse } from "next/server";
import { isAuthenticated, unauthorized, apiError } from "@/lib/api-helpers";
import { parseMandiriPdf } from "@/lib/mandiri-parser";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return unauthorized();

  try {
    const form = await req.formData();
    const file = form.get("file");
    const password = String(form.get("password") ?? "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Tidak ada file PDF yang diupload" }, { status: 400 });
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "File harus berformat PDF" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File lebih dari 10MB" }, { status: 400 });
    }

    const data = new Uint8Array(await file.arrayBuffer());

    try {
      const result = await parseMandiriPdf(data, password);
      if (result.transactions.length === 0) {
        return NextResponse.json(
          { error: "Tidak ada baris transaksi yang terbaca dari PDF ini" },
          { status: 422 }
        );
      }
      return NextResponse.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memproses PDF";
      if (message.includes("Password")) {
        return NextResponse.json({ error: message }, { status: 401 });
      }
      throw err;
    }
  } catch (err) {
    return apiError(err);
  }
}
