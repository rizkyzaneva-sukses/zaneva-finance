/**
 * Aturan kode referensi yang diambil dari pola transaksi nyata tim.
 *
 * Aturan di sini sengaja hanya berisi pola yang cukup jelas. Koreksi tim yang
 * tersimpan di ContohKlasifikasi tetap diprioritaskan oleh pemanggil, sehingga
 * aturan ini menjadi default yang bisa dikoreksi, bukan keputusan permanen.
 */

export interface HasilKodeRefOtomatis {
  kode: string;
  alasan: string;
  /** Aturan eksplisit dari tim yang harus mengalahkan contoh lama yang keliru. */
  prioritas?: boolean;
}

export type ArahKodeRef = "masuk" | "keluar";

interface AturanKodeRef {
  kode: string;
  arah?: ArahKodeRef;
  pola: RegExp;
  alasan: string;
  prioritas?: boolean;
}

const KONTEKS_VENDOR =
  "payment|pembelian|vendor|dp|po|bahan|kain|sablon|konveksi|pelunasan|swimwear|sarimbit|hijab|jaket|jacket|hoodie|vest|topi|logo|ziplock";

function polaVendor(nama: string): RegExp {
  return new RegExp(`(?=.*\\b(?:${KONTEKS_VENDOR})\\b)(?=.*\\b${nama}\\b)`);
}

const ATURAN: AturanKodeRef[] = [
  // Pemasukan dari kanal penjualan. Airpay adalah nama settlement Shopee pada
  // mutasi bank, walaupun kata "Shopee" tidak selalu ikut terbaca OCR.
  { kode: "402", arah: "masuk", pola: /shopee|airpay|shopeepay/, alasan: "pencairan Shopee" },
  { kode: "403", arah: "masuk", pola: /lazada/, alasan: "pencairan Lazada" },
  { kode: "406", arah: "masuk", pola: /tokopedia/, alasan: "pencairan Tokopedia" },
  { kode: "407", arah: "masuk", pola: /tiktok|tik\s*tok/, alasan: "pencairan TikTok" },
  { kode: "408", arah: "masuk", pola: /\bsap\b/, alasan: "pencairan SAP" },
  { kode: "409", arah: "masuk", pola: /\bjnt\b|j\s*&\s*t|jnt\s*vip|global\s+jet\s+expr(?:ess)?|82gvht/, alasan: "pencairan JNT/Global Jet", prioritas: true },
  { kode: "410", arah: "masuk", pola: /mengantar/, alasan: "pencairan Mengantar" },

  // Koreksi eksplisit tim. Aturan ini sengaja berprioritas agar contoh lama
  // yang sempat tersimpan dari saran belum terkonfirmasi tidak menang lagi.
  { kode: "601", pola: /kembalian\s+gaji(?:an)?/, alasan: "kembalian gajian", prioritas: true },
  { kode: "510", arah: "keluar", pola: /sablon\s+polymailer|polymailer/, alasan: "payment sablon polymailer", prioritas: true },
  { kode: "508", arah: "keluar", pola: /payment\s+leg\s+rok|leg\s+rok/, alasan: "payment leg rok", prioritas: true },
  { kode: "62004", arah: "keluar", pola: /paket\s+postbronze|postbronze/, alasan: "paket postbronze", prioritas: true },
  { kode: "802", arah: "keluar", pola: /payment\s+property\s+booth|property\s+booth/, alasan: "property booth", prioritas: true },
  { kode: "804", arah: "keluar", pola: /beli\s+(?:hp|handphone)|hp\s*ke\s*\d/, alasan: "pembelian HP untuk tim", prioritas: true },
  {
    kode: "621",
    arah: "keluar",
    pola: /e\s*tol+l?.*mobil\s+ops|reimburse\s+bensin.*mobil\s+ops|lalamove\s+load\s+out|service\s+hp(?:\s+dan\s+ongkir)?|fee\s+driver/,
    alasan: "operasional kendaraan/tim",
    prioritas: true,
  },
  {
    kode: "701",
    pola: /tukar\s+uang.*cash|(?:[o0]ngkir|iklan)\s+(?:jan(?:uari)?|feb(?:ruari)?|mar(?:et)?|apr(?:il)?|mei|jun(?:i)?|jul(?:i)?|agu(?:stus)?|sep(?:t(?:ember)?)?|okt(?:ober)?|nov(?:ember)?|des(?:ember)?)\s+20\d{2}|vendor\s+elok\s+[o0]ngkir\s+retur\s+rijek|payment\s+belt\s+\d+\s*pcs|lalamove\s+load\s+in/,
    alasan: "aktivitas ikut transfer",
    prioritas: true,
  },

  // Pengembalian uang dan kewajiban pelanggan.
  { kode: "401", pola: /refund|retur|cust\s+salah\s+trf|salah\s+transfer/, alasan: "refund/retur pelanggan" },
  { kode: "207", pola: /deposit\s+customer|deposit\s+pelanggan/, alasan: "deposit customer" },

  // Dua kode khusus yang dipakai workbook arus kas untuk perpindahan dana.
  { kode: "10101", pola: /pengalihan\s+dana|alih\s+dana/, alasan: "pengalihan dana" },
  { kode: "10102", pola: /setoran\s+dana|setor\s+dana/, alasan: "setoran dana" },

  // Perpindahan dana antar rekening atau pembayaran yang dilakukan untuk
  // rekening/brand lain. Nama bank sendiri cukup kuat untuk pola ini bila ada
  // kata transfer di keterangan. Untuk uang masuk, transfer biasa tetap
  // mengikuti aturan default 400 atau saran AI.
  {
    kode: "701",
    arah: "keluar",
    pola: /switching|bi[-\s]?fast|kliring|rtgs|skn|aktivitas\s+ikut\s+transfer|hutang\s+ekspedisi|pinjam\s+ke|bayar\s+pinjam|transaksi\s+(?:bca|mandiri|bri|bni|bank)|\b(?:bca|mandiri|bri|bni)\b.*\btransfer\b/,
    alasan: "transfer antar rekening/aktivitas ikut transfer",
  },

  // Vendor pembelian. Urutan vendor spesifik harus berada sebelum "payment"
  // generik agar transaksi vendor langsung jatuh ke akun yang benar.
  { kode: "501", arah: "keluar", pola: polaVendor("arif"), alasan: "pembelian vendor Arif" },
  { kode: "502", arah: "keluar", pola: polaVendor("fahmi"), alasan: "pembelian vendor Fahmi" },
  { kode: "503", arah: "keluar", pola: polaVendor("dimas"), alasan: "pembelian vendor Dimas" },
  { kode: "504", arah: "keluar", pola: polaVendor("anwar"), alasan: "pembelian vendor Anwar" },
  { kode: "505", arah: "keluar", pola: polaVendor("hitjab"), alasan: "pembelian vendor Hitjab" },
  { kode: "506", arah: "keluar", pola: polaVendor("wahyu"), alasan: "pembelian vendor Wahyu" },
  { kode: "507", arah: "keluar", pola: polaVendor("ramdhan"), alasan: "pembelian vendor Ramdhan" },
  { kode: "508", arah: "keluar", pola: /vendor\s+zaneva|payment.*vendor\s+zaneva/, alasan: "pembelian vendor Zaneva" },
  { kode: "509", arah: "keluar", pola: polaVendor("toni"), alasan: "pembelian vendor Toni" },
  { kode: "510", arah: "keluar", pola: polaVendor("ian"), alasan: "pembelian vendor Ian" },
  { kode: "511", arah: "keluar", pola: polaVendor("dindin"), alasan: "pembelian vendor Dindin" },
  { kode: "512", arah: "keluar", pola: polaVendor("wmd"), alasan: "pembelian vendor WMD" },
  { kode: "513", arah: "keluar", pola: polaVendor("dimam"), alasan: "pembelian vendor Dimam" },
  { kode: "514", arah: "keluar", pola: polaVendor("yanti"), alasan: "pembelian vendor Yanti" },
  { kode: "515", arah: "keluar", pola: polaVendor("vazya"), alasan: "pembelian vendor Vazya" },
  { kode: "516", arah: "keluar", pola: polaVendor("evi"), alasan: "pembelian vendor Evi" },
  { kode: "517", arah: "keluar", pola: polaVendor("elok"), alasan: "pembelian vendor Elok" },
  { kode: "518", arah: "keluar", pola: polaVendor("bilal"), alasan: "pembelian vendor Bilal" },
  { kode: "519", arah: "keluar", pola: polaVendor("fajar"), alasan: "pembelian vendor Fajar" },
  { kode: "52001", arah: "keluar", pola: polaVendor("rudi"), alasan: "pembelian vendor Rudi" },
  { kode: "52002", arah: "keluar", pola: polaVendor("fauzan"), alasan: "pembelian vendor Fauzan" },
  { kode: "52003", arah: "keluar", pola: polaVendor("s12"), alasan: "pembelian vendor S12" },
  { kode: "52004", arah: "keluar", pola: polaVendor("oberbe"), alasan: "pembelian vendor Oberbe" },
  { kode: "52005", arah: "keluar", pola: polaVendor("suherman"), alasan: "pembelian vendor Suherman" },
  { kode: "52006", arah: "keluar", pola: polaVendor("rivaldi"), alasan: "pembelian vendor Rivaldi" },
  { kode: "52007", arah: "keluar", pola: polaVendor("jamal"), alasan: "pembelian vendor Jamal" },
  { kode: "52008", arah: "keluar", pola: polaVendor("firman"), alasan: "pembelian vendor Firman" },
  { kode: "52009", arah: "keluar", pola: polaVendor("dita"), alasan: "pembelian vendor Dita" },
  { kode: "52010", arah: "keluar", pola: polaVendor("yuni"), alasan: "pembelian vendor Yuni" },
  { kode: "52011", arah: "keluar", pola: polaVendor("trinda"), alasan: "pembelian vendor Trinda" },
  { kode: "52012", arah: "keluar", pola: polaVendor("reni"), alasan: "pembelian vendor Reni" },
  { kode: "52013", arah: "keluar", pola: polaVendor("sae"), alasan: "pembelian vendor Sae" },
  { kode: "52014", arah: "keluar", pola: polaVendor("mastor"), alasan: "pembelian vendor Mastor" },
  { kode: "52015", arah: "keluar", pola: polaVendor("wildan"), alasan: "pembelian vendor Wildan" },

  // Kanal iklan dan biaya marketplace. Koin Shopee adalah promosi, bukan
  // biaya iklan Shopee, sesuai pengelompokan pada workbook arus kas.
  { kode: "62007", arah: "keluar", pola: /^(?!.*(?:paid\s+endorse|endorse|paid\s+promote|paid\s+promo)).*(?:koin\s+shopee|promosi|sponsorship)/, alasan: "promosi/sponsorship" },
  { kode: "62005", arah: "keluar", pola: /paid\s+endorse|endorse|influencer/, alasan: "paid endorse" },
  { kode: "62004", arah: "keluar", pola: /paid\s+promote|paid\s+promo/, alasan: "paid promote" },
  { kode: "60901", arah: "keluar", pola: /\bfb\b|facebook|meta\s+ads|iklan\s+fb/, alasan: "iklan Facebook" },
  { kode: "60902", arah: "keluar", pola: /iklan\s+shopee|shopee\s+ads|shopeepay/, alasan: "iklan Shopee" },
  { kode: "60903", arah: "keluar", pola: /iklan\s+lazada|lazada\s+ads/, alasan: "iklan Lazada" },
  { kode: "60904", arah: "keluar", pola: /iklan\s+tokopedia|iklan\s+tiktok|tiktok\s+ads/, alasan: "iklan Tokopedia/TikTok" },
  { kode: "609", arah: "keluar", pola: /\biklan\b|advertis|ads/, alasan: "beban iklan" },
  { kode: "61701", arah: "keluar", pola: /jasa\s+marketplace.*shopee|fee\s+shopee/, alasan: "jasa marketplace Shopee" },
  { kode: "61702", arah: "keluar", pola: /jasa\s+marketplace.*lazada|fee\s+lazada/, alasan: "jasa marketplace Lazada" },
  { kode: "61703", arah: "keluar", pola: /jasa\s+marketplace.*tokopedia|fee\s+tokopedia/, alasan: "jasa marketplace Tokopedia" },
  { kode: "61704", arah: "keluar", pola: /jasa\s+marketplace.*tiktok|fee\s+tiktok/, alasan: "jasa marketplace TikTok" },

  // Ekspedisi, bank, pajak dan biaya rutin.
  { kode: "500", arah: "keluar", pola: /top\s*up\s+lalamove|angkut\s+pembelian/, alasan: "angkut pembelian" },
  { kode: "613", arah: "keluar", pola: /^(?!.*(?:budget\s+parcel|parcel\s+\d)).*(?:ekspedisi|jnt|j\s*&\s*t|sicepat|lion|gosend|go\s*send|pos\b|pengiriman)/, alasan: "pengiriman/ekspedisi" },
  { kode: "61101", arah: "keluar", pola: /transfer\s+antar\s+bank|biaya\s+transfer|admin\s+transfer/, alasan: "biaya transfer antar bank" },
  { kode: "611", arah: "keluar", pola: /biaya\s+admin|adm\s+bank|admin\s+bank|m[de]r\b/, alasan: "administrasi bank" },
  { kode: "612", arah: "keluar", pola: /pajak\s+bank|pajak\s+rekening/, alasan: "pajak bank" },
  { kode: "615", arah: "keluar", pola: /bunga\s+bank|bunga\s+rekening/, alasan: "beban bunga bank" },
  { kode: "699", arah: "keluar", pola: /anggaran\s+pajak|sp2dk|pajak\s+masa/, alasan: "anggaran pajak" },
  { kode: "607", arah: "keluar", pola: /pajak|pph|ppn|tax/, alasan: "beban pajak" },
  { kode: "601", arah: "keluar", pola: /\bgaji\b|salary|upah|freelance|honor/, alasan: "beban gaji" },
  { kode: "604", arah: "keluar", pola: /^(?!.*photoshoot).*\b(?:sewa|rental)\b/, alasan: "sewa gedung/tempat" },
  { kode: "618", arah: "keluar", pola: /\bthr\b|tunjangan\s+hari\s+raya/, alasan: "beban THR" },
  { kode: "619", arah: "keluar", pola: /pesangon/, alasan: "beban pesangon" },

  // Donasi dan kegiatan alokasi didahulukan dari kata-kata operasional di
  // catatan, misalnya "Infaq: Listrik CMD".
  { kode: "801", arah: "keluar", pola: /zakat/, alasan: "zakat" },
  { kode: "80101", arah: "keluar", pola: /santunan|ramadhan/, alasan: "santunan Ramadhan" },
  { kode: "80103", arah: "keluar", pola: /infaq|infak|shadaqoh|sedekah/, alasan: "infaq/shadaqoh" },
  { kode: "616", arah: "keluar", pola: /qurban|kurban/, alasan: "qurban" },

  // Pola alokasi/cashback yang tampak berulang di workbook arus kas.
  { kode: "805", arah: "keluar", pola: /alokasi\s+r|syaftraco|komerce/, alasan: "alokasi R" },
  { kode: "806", arah: "keluar", pola: /alokasi\s+i/, alasan: "alokasi I" },
  { kode: "80702", arah: "keluar", pola: /budget\s+parcel|parcel\s+2026/, alasan: "budget parcel" },
  { kode: "808", arah: "keluar", pola: /cashback\s+sap/, alasan: "cashback SAP" },
  { kode: "814", arah: "keluar", pola: /cashback\s+ekspedisi/, alasan: "cashback ekspedisi" },
  { kode: "614", arah: "keluar", pola: /kelebihan\s+transfer/, alasan: "kelebihan transfer" },

  { kode: "804", arah: "keluar", pola: /upgrade\s+team|kelas\s+online|training|konsultan/, alasan: "upgrade team" },

  // Operasional dan kegiatan tim.
  { kode: "6-10114", arah: "keluar", pola: /biznet/, alasan: "beban Biznet" },
  { kode: "606", arah: "keluar", pola: /^(?!.*(?:infaq|infak|shadaqoh|sedekah|zakat|alokasi\s+[ri]\b)).*(?:listrik|token|pln|indihome|telepon)/, alasan: "listrik/telepon" },
  { kode: "62102", arah: "keluar", pola: /pulsa|kuota|paket\s+data|data\s+internet/, alasan: "kuota" },
  { kode: "62103", arah: "keluar", pola: /photoshoot|photo\s+shoot|model|makeup|grab\s*pp/, alasan: "photoshoot" },
  { kode: "605", arah: "keluar", pola: /catering|nasi\s+box|lunch|snack|warteg|makan\s+siang/, alasan: "catering" },
  { kode: "621", arah: "keluar", pola: /^(?!.*(?:cashback\s+sap|budget\s+parcel|parcel\s+\d)).*(?:operasional|galon|beras|tissue|pembersih|plastik\s+packing|qr\s+\d|pandiga)/, alasan: "operasional" },
  { kode: "80205", arah: "keluar", pola: /top\s*up\s+kas\s+besar|kas\s+besar/, alasan: "top up kas besar" },
  { kode: "80206", arah: "keluar", pola: /top\s*up\s+kas\s+kecil|kas\s+kecil/, alasan: "top up kas kecil" },
  { kode: "802", arah: "keluar", pola: /pengembangan\s+bisnis|tools\s+tambahan|beli\s+pc|domain|mobil\s+ops/, alasan: "pengembangan bisnis" },

  // Pembelian yang tidak mengandung nama vendor tetap boleh jatuh ke akun
  // vendor lain, tetapi diletakkan paling akhir agar kata "payment" tidak
  // menimpa aturan gaji, pajak, operasional, dan kategori lain.
  { kode: "520", arah: "keluar", pola: /(?:payment|pembelian)\s+(?:bahan|kain|konveksi)|vendor\s+lain/, alasan: "pembelian vendor lain" },
];

function bersihkan(teks: string): string {
  return teks
    .toLowerCase()
    .replace(/[^a-z0-9&]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cari aturan pertama yang cocok. Urutan aturan adalah bagian dari logika. */
export function cariKodeRefOtomatis(
  keterangan: string,
  arah: ArahKodeRef,
  kodeTersedia?: ReadonlySet<string>,
): HasilKodeRefOtomatis | null {
  const teks = bersihkan(keterangan);
  if (!teks) return null;

  for (const aturan of ATURAN) {
    if (aturan.arah && aturan.arah !== arah) continue;
    if (!aturan.pola.test(teks)) continue;
    if (kodeTersedia && !kodeTersedia.has(aturan.kode)) continue;
    return { kode: aturan.kode, alasan: aturan.alasan, prioritas: aturan.prioritas };
  }
  return null;
}

/**
 * Keterangan yang belum mengandung tujuan transaksi harus dibiarkan kosong.
 * Contoh utama: tarik tunai ATM tidak menjelaskan uangnya dipakai untuk apa.
 */
export function alasanKodeHarusKosong(
  keterangan: string,
  arah: ArahKodeRef,
): string | null {
  const teks = bersihkan(keterangan);
  if (arah === "keluar" && /tarikan\s+atm|penarikan\s+atm|tarik\s+tunai\s+atm/.test(teks)) {
    return "tujuan penggunaan uang dari ATM belum diketahui";
  }
  return null;
}
