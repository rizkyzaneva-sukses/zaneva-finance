import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehRekap } from "@/lib/auth";
import { parseGambarMutasi, dedupeHasilParsing } from "@/lib/openrouter";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 10;

/**
 * OCR screenshot mutasi — berlaku untuk bank apa pun (satu prompt generik).
 * File gambar tidak pernah disimpan: hanya hidup di memori request ini.
 */
export async function POST(req: Request) {
  const auth = await wajibLogin(bolehRekap);
  if (!auth.ok) return auth.response;

  try {
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "Tidak ada file gambar yang diupload" }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Maksimal ${MAX_FILES} file sekaligus` }, { status: 400 });
    }
    for (const f of files) {
      if (!f.type.startsWith("image/")) {
        return NextResponse.json(
          { error: `File "${f.name}" bukan gambar (${f.type || "tidak diketahui"})` },
          { status: 400 }
        );
      }
      if (f.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File "${f.name}" lebih dari 10MB` }, { status: 400 });
      }
    }

    const hasil = await Promise.all(
      files.map(async (file) => {
        const buf = Buffer.from(await file.arrayBuffer());
        const dataUrl = `data:${file.type};base64,${buf.toString("base64")}`;
        return parseGambarMutasi(dataUrl, file.name);
      })
    );

    return NextResponse.json({ baris: dedupeHasilParsing(hasil.flat()) });
  } catch (err) {
    return apiError(err);
  }
}
