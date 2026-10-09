"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, Minus, Search } from "lucide-react";
import { Badge, Card, INPUT_CLASS, PageHeader, TabButton, TabList } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Role = "OWNER" | "ADMIN" | "STAFF" | "BENDAHARA";
type Tab = "mulai" | "qna" | "workflow" | "role";

const TABS: { key: Tab; label: string }[] = [
  { key: "mulai", label: "Quick Start" },
  { key: "qna", label: "Tanya Jawab" },
  { key: "workflow", label: "Workflow" },
  { key: "role", label: "Penjelasan Role" },
];

const WARNA_ROLE: Record<Role, "biru" | "hijau" | "abu" | "kuning"> = {
  OWNER: "biru",
  ADMIN: "hijau",
  STAFF: "abu",
  BENDAHARA: "kuning",
};

const NAMA_ROLE: Record<Role, string> = {
  OWNER: "OWNER",
  ADMIN: "ADMIN (Finance)",
  STAFF: "STAFF",
  BENDAHARA: "BENDAHARA",
};

function ChipRole({ role }: { role: Role }) {
  return <Badge warna={WARNA_ROLE[role]}>{NAMA_ROLE[role]}</Badge>;
}

function Tautan({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-blue-700 underline dark:text-blue-300">
      {children}
    </Link>
  );
}

// ───────────────────────── QUICK START ─────────────────────────

interface Langkah {
  judul: string;
  isi: React.ReactNode;
}

const QUICK_START: { role: Role; judul: string; ringkas: string; langkah: Langkah[] }[] = [
  {
    role: "OWNER",
    judul: "Setup awal (dilakukan sekali)",
    ringkas: "Menyiapkan akun tim, rekening, dan aturan laporan sebelum mulai dipakai.",
    langkah: [
      {
        judul: "Ganti password akun awal",
        isi: (
          <>
            Login dengan akun bawaan <code className="font-mono">admin</code>, lalu buka{" "}
            <Tautan href="/pengguna">Pengguna</Tautan> di kelompok Administrasi dan ubah passwordnya. Password bawaan
            sama untuk semua instalasi, jadi jangan dibiarkan.
          </>
        ),
      },
      {
        judul: "Buat akun untuk tiap anggota tim",
        isi: (
          <>
            Di <Tautan href="/pengguna">Pengguna</Tautan> (Administrasi) pilih role sesuai tugas (lihat tab Penjelasan
            Role). Satu orang satu akun, jangan berbagi, karena semua perubahan dicatat atas nama akunnya.
          </>
        ),
      },
      {
        judul: "Tambahkan semua rekening beserta saldo awalnya",
        isi: (
          <>
            Di <Tautan href="/master/rekening">Rekening</Tautan> (kelompok Master). Isi <strong>saldo awal</strong> dan tanggalnya dengan teliti: itu
            titik nol pembukuan, kalau salah seluruh saldo ikut salah. Kas tunai (mis. kas gudang) dibuat sebagai rekening berjenis{" "}
            <strong>Petty Cash</strong>, boleh lebih dari satu.
          </>
        ),
      },
      {
        judul: "Periksa Kode Akun",
        isi: (
          <>
            Di <Tautan href="/master/kode-akun">Kode Akun</Tautan> (kelompok Master) atur kolom <strong>Masuk laporan</strong> (Neraca / Laba Rugi / Tidak
            masuk), <strong>Arus kas</strong>, dan <strong>% Alokasi</strong>. Kode yang masih berlabel &quot;Belum diatur&quot; akan
            muncul sebagai peringatan di Laporan sampai kamu putuskan.
          </>
        ),
      },
      {
        judul: "Isi saldo awal alokasi (kalau sudah berjalan)",
        isi: (
          <>
            Di <Tautan href="/alokasi">Alokasi</Tautan> (kelompok Tutup buku), klik ikon pensil pada kode yang sudah punya saldo (mis. Alokasi R) supaya
            hitungan tidak mulai dari nol.
          </>
        ),
      },
    ],
  },
  {
    role: "STAFF",
    judul: "Rutinitas harian: merekap mutasi bank",
    ringkas: "Dari screenshot atau PDF mutasi sampai tersimpan dan menunggu ACC Finance.",
    langkah: [
      {
        judul: "Buka Rekap dan pilih rekening dulu",
        isi: (
          <>
            Di <Tautan href="/rekap">Rekap</Tautan> (kelompok Operasional), rekening wajib dipilih sebelum upload supaya transaksi masuk ke rekening yang
            benar. Screenshot dari bank apa pun bisa dibaca; PDF e-Statement baru didukung untuk Mandiri.
          </>
        ),
      },
      {
        judul: "Upload lalu klik Proses",
        isi: "Boleh banyak gambar sekaligus (drag & drop, klik, atau paste dengan Ctrl+V). AI membaca transaksinya, lalu menyarankan kode akun.",
      },
      {
        judul: "Periksa hasilnya",
        isi: (
          <>
            Baris <strong>merah</strong> berarti AI ragu membacanya, cocokkan dengan gambar aslinya. Kode berlabel{" "}
            <strong>saran AI</strong> belum dikonfirmasi, tebakan mesin bisa salah. Ubah lewat dropdown kode; satu transaksi yang
            dipakai untuk beberapa keperluan bisa di-<strong>split</strong> (ikon gunting).
          </>
        ),
      },
      {
        judul: "Simpan Semua",
        isi: (
          <>
            Yang dicentang <strong>Ikut</strong> tersimpan dengan status <Badge warna="biru">ACC Bendahara</Badge> sampai
            diverifikasi. Koreksi kode, catatan, atau split setelah itu diteruskan ke Finance (badge kuning). Baris bertanda{" "}
            <strong>Duplikat</strong> tidak ikut: centangnya kosong. Centang Ikut hanya kalau transaksi kembar itu memang
            terjadi dua kali. Beberapa baris bisa diganti kodenya bareng-bareng lewat <strong>Ubah Sekaligus</strong>; itu
            baru tersimpan setelah Simpan Semua.
          </>
        ),
      },
      {
        judul: "Arsipkan dokumennya (opsional)",
        isi: (
          <>
            Di <Tautan href="/dokumen">Dokumen</Tautan> (kelompok Operasional), unggah file mutasi ke rekeningnya. Arsip di sana disimpan permanen.
            Screenshot dan PDF di halaman Rekap tidak disimpan: hanya dibaca, lalu dibuang.
          </>
        ),
      },
    ],
  },
  {
    role: "ADMIN",
    judul: "Rutinitas Finance: mengesahkan dan menutup bulan",
    ringkas: "Memastikan pekerjaan tim benar, mencatat jurnal penyesuaian, lalu membagikan alokasi dari laba.",
    langkah: [
      {
        judul: "Sahkan pekerjaan tim (berjenjang)",
        isi: (
          <>
            Di <Tautan href="/dashboard">Dashboard</Tautan> (kelompok Operasional) ada banner &quot;menunggu ACC&quot;. Klik untuk membuka{" "}
            <Tautan href="/transaksi?menungguAcc=1">daftarnya</Tautan>. Bendahara memverifikasi input staff (badge biru); koreksi
            kode/catatan/split diteruskan untuk finalisasi Finance (badge kuning). Lingkupmu:{" "}
            <strong>klik centang per baris</strong> atau <strong>Verifikasi/Finalkan semua di halaman ini</strong>. Kalau ada yang salah,
            cukup ubah sendiri: perubahan oleh Finance otomatis disahkan.
          </>
        ),
      },
      {
        judul: "Pastikan Laporan lengkap",
        isi: (
          <>
            Buka <Tautan href="/laporan">Laporan</Tautan> (kelompok Tutup buku). Kotak hijau &quot;Kas cocok&quot; harus muncul. Banner kuning berarti ada
            transaksi tanpa kode atau kode yang belum diatur masuk laporan, perbaiki sebelum laba dipakai.
          </>
        ),
      },
      {
        judul: "Catat jurnal penyesuaian per brand",
        isi: (
          <>
            Sebelum OWNER mengesahkan laba, buka <Tautan href="/laporan">Laporan</Tautan>, lalu tab{" "}
            <strong>Jurnal Penyesuaian</strong>.
            Buat satu jurnal per brand untuk pencatatan yang tidak menggerakkan bank. Contoh: kredit{" "}
            <strong>10415 Deposit Gaji</strong> sebesar mutasi keluar, debit <strong>601 Beban Gaji</strong> dengan angka
            yang sama. Klik <strong>isi kredit</strong> atau <strong>isi debit</strong> pada saran, lalu ubah angkanya kalau
            perlu. Jangan centang balik untuk reklasifikasi. Jurnal ini mengubah laba, jadi harus selesai sebelum laba
            disahkan.
          </>
        ),
      },
      {
        judul: "Awal bulan: bagikan alokasi",
        isi: (
          <>
            Setelah OWNER mengesahkan laba bulan lalu, buka <Tautan href="/alokasi">Alokasi</Tautan> (kelompok Tutup buku) lalu{" "}
            <strong>Lihat &amp; sahkan distribusi</strong>. Periksa rinciannya sebelum disahkan.
          </>
        ),
      },
    ],
  },
  {
    role: "BENDAHARA",
    judul: "Mencatat pengeluaran kas tunai",
    ringkas: "Untuk petty cash yang dipegang (mis. kas gudang). Tidak ada mutasi bank, jadi dicatat manual.",
    langkah: [
      {
        judul: "Buka Transaksi lalu Tambah Transaksi",
        isi: (
          <>
            Di <Tautan href="/transaksi">Transaksi</Tautan> (kelompok Operasional), klik <strong>Tambah Transaksi</strong>. Rekening yang tampil hanya kas
            tunai.
          </>
        ),
      },
      {
        judul: "Isi tanggal, keterangan, arah uang, dan nominal",
        isi: "Pilih Uang keluar untuk belanja, Uang masuk untuk isi ulang kas. Kode akun boleh dikosongkan dulu kalau belum tahu, Finance bisa melengkapinya.",
      },
      {
        judul: "Langsung masuk (tanpa ACC)",
        isi: (
          <>
            Transaksi petty cash yang kamu catat <strong>langsung disetujui</strong> — tidak perlu menunggu ACC. Saldo
            kas langsung berubah, karena uangnya memang sudah keluar. ACC hanya berlaku untuk rekening bank.
          </>
        ),
      },
    ],
  },
];

const PETA_MENU: { grup: string; arti: string; item: string[] }[] = [
  { grup: "Operasional", arti: "Kerja harian", item: ["Dashboard", "Rekap", "Transaksi", "Dokumen"] },
  { grup: "Tutup buku", arti: "Laporan dan persediaan", item: ["Laporan", "Alokasi", "Stok & HPP"] },
  { grup: "Master", arti: "Data acuan", item: ["Rekening", "Brand", "Kode Akun"] },
  { grup: "Administrasi", arti: "Akun dan jejak, hanya OWNER", item: ["Pengguna", "Log Aktivitas"] },
];

function PetaMenu() {
  return (
    <Card>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">Peta menu</h2>
      <p className="mt-1 mb-4 text-sm text-gray-600 dark:text-gray-400">
        Sidebar dikelompokkan menurut pekerjaan, bukan daftar panjang. Kelompok yang tidak ada haknya tidak
        ditampilkan. Di HP, tombol menu di kiri atas membuka daftar yang sama; judul di atas menunjukkan kelompok
        dan halaman yang sedang dibuka.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {PETA_MENU.map((g) => (
          <div key={g.grup} className="rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-zinc-800/80">
            <div className="text-[11px] font-semibold tracking-[0.14em] text-gray-600 uppercase dark:text-gray-400">
              {g.grup}
            </div>
            <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">{g.arti}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {g.item.map((m) => (
                <Badge key={m}>{m}</Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
        <strong>Panduan</strong> menempel di bawah sidebar, di luar kelompok. Akun yang dibatasi ke brand tertentu
        tidak melihat Alokasi, Stok &amp; HPP, Kode Akun, dan Brand.
      </p>
    </Card>
  );
}

function QuickStart({ roleSaya }: { roleSaya: Role | null }) {
  // Bagian untuk role pengguna ditaruh paling atas, supaya langsung ketemu.
  const urut = [...QUICK_START].sort((a, b) => Number(b.role === roleSaya) - Number(a.role === roleSaya));
  return (
    <div className="space-y-4">
      <PetaMenu />
      {urut.map((s) => (
        <Card key={s.role} className={cn(s.role === roleSaya && "ring-2 ring-blue-500 dark:ring-blue-400")}>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <ChipRole role={s.role} />
            {s.role === roleSaya && <Badge warna="biru">Role kamu</Badge>}
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">{s.judul}</h2>
          </div>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">{s.ringkas}</p>
          <ol className="space-y-3">
            {s.langkah.map((l, i) => (
              <li key={l.judul} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-900 dark:bg-blue-900/50 dark:text-blue-100">
                  {i + 1}
                </span>
                <div className="min-w-0 text-sm">
                  <div className="font-medium text-gray-900 dark:text-gray-50">{l.judul}</div>
                  <div className="mt-0.5 text-gray-700 dark:text-gray-300">{l.isi}</div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ))}
    </div>
  );
}

// ───────────────────────── TANYA JAWAB ─────────────────────────

// Jawaban sengaja teks biasa (bukan JSX) supaya bisa dicari lewat kotak pencarian.
const QNA: { kategori: string; t: string; j: string }[] = [
  {
    kategori: "Menu",
    t: "Di mana saya mencari halaman setelah menu dikelompokkan?",
    j: "Sidebar punya empat kelompok. Operasional untuk kerja harian: Dashboard, Rekap, Transaksi, dan Dokumen. Tutup buku untuk Laporan, Alokasi, dan Stok & HPP. Master untuk Rekening, Brand, dan Kode Akun. Administrasi untuk Pengguna dan Log Aktivitas, hanya OWNER. Panduan menempel di bawah sidebar. Kelompok yang tidak ada haknya disembunyikan. Di HP, tombol menu di kiri atas membuka daftar yang sama, dan judul di atas menulis kelompok serta nama halamannya.",
  },
  {
    kategori: "Rekap",
    t: "Bank apa saja yang bisa dibaca?",
    j: "Screenshot dari bank apa pun (BCA, Mandiri, BRI, BNI, dan lainnya) dibaca oleh AI dengan satu aturan yang sama. PDF e-Statement baru didukung untuk Mandiri. Untuk bank lain, pakai screenshot dulu.",
  },
  {
    kategori: "Rekap",
    t: "Apakah hasil bacaan AI pasti benar?",
    j: "Tidak. AI bisa salah baca dan salah menebak kode akun. Karena itu baris yang AI ragukan diberi warna merah, dan kode hasil tebakan diberi label \"saran AI\" sampai manusia menyentuhnya. Selalu cocokkan dengan gambar aslinya sebelum menyimpan.",
  },
  {
    kategori: "Rekap",
    t: "Kenapa ada baris bertanda Duplikat, dan kenapa tidak ikut tersimpan?",
    j: "Sistem menandai duplikat kalau di rekening yang sama sudah ada transaksi dengan hari, nama pengirim, dan nominal yang sama — atau keterangan yang persis sama. Biasanya ini screenshot yang tumpang tindih, atau transfer yang sama terunggah lagi. Baris itu tidak ikut saat Simpan Semua. Kalau memang ada dua transaksi kembar yang benar-benar terjadi, centang Ikut pada baris itu.",
  },
  {
    kategori: "Rekap",
    t: "Kenapa transfer masuk langsung dapat kode 400?",
    j: "Uang masuk yang bukan marketplace (Shopee, Lazada, Tokopedia, TikTok, Midtrans), bukan JNT VIP, bukan SAP, bukan Mengantar, dan bukan pencairan QR diisi kode 400 Penjualan. Itu baru di preview, masih bisa diganti sebelum disimpan. Centang beberapa baris lalu klik Ubah Sekaligus kalau mau mengganti kodenya bareng-bareng. Perubahan itu baru masuk database setelah Simpan Semua.",
  },
  {
    kategori: "Rekap",
    t: "Apakah AI jadi lebih akurat setelah sering dikoreksi?",
    j: "Modelnya tidak dilatih ulang. Yang diingat adalah koreksi tim: kalau sebuah pola (biasanya nama pengirim atau lawan transaksi) sudah diganti ke kode tertentu, unggahan berikutnya memakai kode itu dan diberi label \"dari koreksi sebelumnya\". Transfer masuk biasa yang tetap 400 tidak perlu diingat, karena itu sudah aturan tetap.",
  },
  {
    kategori: "Rekap",
    t: "Bagaimana memecah (split) satu transaksi ke beberapa kode, mis. tarik tunai ATM?",
    j: "Klik ikon gunting di baris itu. Isi minimal 2 rincian, masing-masing dengan kode akun dan nominal. Total rincian harus sama persis dengan transaksi aslinya, kalau tidak, tombol simpan mati dan ditampilkan kurang atau kelebihan berapa. Yang dihitung di laporan adalah rinciannya; transaksi asli tetap tersimpan sebagai catatan.",
  },
  {
    kategori: "Rekap",
    t: "Kenapa ada tanda \"beda dgn bank\" di kolom saldo?",
    j: "Saldo di app dihitung sendiri: saldo awal ditambah semua masuk dikurangi keluar. Kalau saldo yang tertulis di mutasi bank berbeda Rp 1 atau lebih, baris itu ditandai. Biasanya ada transaksi yang terlewat atau saldo awal rekening salah.",
  },
  {
    kategori: "Transaksi",
    t: "Apa bedanya History dan Penjualan di halaman Transaksi?",
    j: "History berisi semua transaksi. Penjualan hanya kode 400. Di situ Staff dan Finance (ADMIN/OWNER) bisa menandai Verified atau mengosongkannya lagi. Hijau berarti sudah dicek, abu-abu berarti belum. Filter Verifikasi menyaring keduanya. Ini terpisah dari ACC Bendahara dan ACC Finance.",
  },
  {
    kategori: "ACC",
    t: "Bagaimana alur ACC yang berlaku sekarang?",
    j: "Berjenjang. Koreksi dari STAFF masuk berstatus \"ACC Bendahara\". Bila koreksi itu menyentuh kode akun, catatan, atau split, setelah diverifikasi Bendahara statusnya naik jadi \"Perlu ACC Finance\" untuk difinalkan ADMIN/OWNER. Koreksi ringan (mis. tanda yakin) cukup sampai verifikasi Bendahara. Yang bukan koreksi (mis. input bank biasa) hanya lewat satu tahap: verifikasi Bendahara.",
  },
  {
    kategori: "ACC",
    t: "Apakah input petty cash perlu ACC?",
    j: "Tidak. Transaksi manual ke rekening berjenis Petty Cash langsung disetujui (tersimpan final) — ini kas kecil operasional. ACC berjenjang hanya untuk rekening bank.",
  },
  {
    kategori: "ACC",
    t: "Apakah transaksi yang menunggu ACC tetap dihitung?",
    j: "Ya. Baik \"ACC Bendahara\" maupun \"Perlu ACC Finance\", transaksinya tetap dihitung di Laporan — uangnya sudah benar-benar berpindah di rekening. Yang menunggu adalah pengesahan pencatatannya (terutama kode akunnya), jadi rincian per akun di laporan masih bisa berubah. Jumlahnya ditampilkan di Dashboard dan Laporan.",
  },
  {
    kategori: "ACC",
    t: "Kalau STAFF mengubah transaksi yang sudah disetujui, apa yang terjadi?",
    j: "Jejak ACC lama dihapus dan statusnya dihitung ulang: koreksi kode/catatan/split → Perlu ACC Finance; koreksi ringan → ACC Bendahara. Kalau ADMIN atau OWNER yang mengubah, langsung berstatus disetujui.",
  },
  {
    kategori: "ACC",
    t: "Apa bedanya \"belum beres\" dan \"menunggu ACC\"?",
    j: "Belum beres berarti isinya belum lengkap: kode akun kosong, masih saran AI, atau AI ragu membacanya. Menunggu ACC berarti isinya sudah ada tapi belum disahkan (Bendahara/Finance). Dua filter terpisah di halaman Transaksi; filter \"menunggu ACC\" mencakup kedua tahap.",
  },
  {
    kategori: "Laporan",
    t: "Kenapa di Neraca ada baris \"Belum diklasifikasi\"?",
    j: "Itu transaksi yang belum bisa dimasukkan ke laporan manapun: tidak punya kode akun, atau kodenya belum diatur masuk Neraca atau Laba Rugi (atau diatur Tidak masuk laporan). Nilainya ditampilkan mencolok dengan tautan perbaikan, supaya tidak ada uang yang hilang diam-diam. Selesaikan dengan mengatur kolom Masuk laporan di Kode Akun.",
  },
  {
    kategori: "Laporan",
    t: "Apa arti kotak hijau \"Kas cocok\" di Laporan?",
    j: "App menghitung total kas dua kali lewat jalur yang berbeda, dari mutasi dan dari saldo berjalan yang tersimpan, lalu membandingkannya. Hijau berarti sama. Merah berarti ada data yang rusak dan laporan jangan dipakai dulu. Perhatikan: Neraca yang \"seimbang\" bukan bukti angkanya benar, karena sisi kiri dan kanannya memang selalu sama besar secara konstruksi.",
  },
  {
    kategori: "Laporan",
    t: "Laporan memakai basis apa? Kenapa labanya bisa terasa tidak biasa?",
    j: "Basis kas: pendapatan dan beban dicatat saat uang masuk atau keluar di rekening, bukan saat transaksinya terjadi. Pembelian ke vendor dihitung penuh sebagai biaya bulan itu, tanpa memperhitungkan persediaan akhir. Jadi bulan ketika belanja stok besar akan terlihat labanya kecil. Pengecualiannya Jurnal Penyesuaian: reklasifikasi atau akrual yang tidak menggerakkan saldo bank. Jurnal itu ikut Laba Rugi, Neraca, dan Perubahan Modal, tetapi tidak ikut Arus Kas.",
  },
  {
    kategori: "Laporan",
    t: "Kenapa Pengalihan Dana tidak nol kalau saya memilih satu rekening?",
    j: "Transfer antar rekening dicatat dua kali: keluar di satu rekening dan masuk di rekening lain, dengan efek total nol. Kalau laporan dibatasi satu rekening, hanya satu sisinya yang terlihat. Pilih \"Semua rekening\" untuk laporan usaha yang utuh.",
  },
  {
    kategori: "Laporan",
    t: "Apa itu Jurnal Penyesuaian, dan bedanya dengan transaksi bank?",
    j: "Tab Jurnal Penyesuaian di Laporan untuk pencatatan yang tidak menggerakkan uang di rekening. Contohnya memindahkan Deposit Gaji menjadi Beban Gaji di akhir periode. Satu jurnal untuk satu brand, bukan per rekening dan bukan untuk seluruh perusahaan sekaligus. Debit harus sama dengan kredit; kalau tidak, tombol Simpan mati. Jurnal masuk Laba Rugi, Neraca, dan Perubahan Modal. Saldo rekening dan Arus Kas tidak berubah. Filter satu rekening tidak memasukkan jurnal. Kalau rekening yang dipilih belum punya brand, tab itu menampilkan peringatan dan jurnal tidak bisa dibuat.",
  },
  {
    kategori: "Laporan",
    t: "Bagaimana memindahkan Deposit Gaji menjadi Beban Gaji?",
    j: "Buka Laporan, pilih brand dan periode, lalu tab Jurnal Penyesuaian → Jurnal baru. Hanya ADMIN dan OWNER. Isi tanggal (biasanya akhir periode atau awal periode berikutnya) dan keterangan. Baris pertama pilih 10415 Deposit Gaji, lalu pada saran Mutasi keluar periode ini klik isi kredit. Baris kedua pilih 601 Beban Gaji dan ketik angka yang sama di Debit. Kalau akun beban itu tidak punya mutasi bank, tidak ada tombol salin antar baris: ketik angkanya sendiri. Angka saran boleh diubah, dan tidak tersimpan sebelum kamu klik Simpan. Jangan centang Balik tanggal 1 bulan berikutnya, karena reklasifikasi tidak dibalik.",
  },
  {
    kategori: "Laporan",
    t: "Kapan saya mencentang Balik tanggal 1 bulan berikutnya?",
    j: "Hanya untuk akrual: beban yang belum dibayar, atau pendapatan yang belum diterima. Sistem membuat jurnal kedua bertanggal tanggal 1 bulan berikutnya, debit dan kreditnya tertukar, supaya saat uangnya benar-benar bergerak tidak terhitung dua kali. Reklasifikasi deposit menjadi beban jangan dicentang. Jurnal pembalik diubah lewat jurnal asalnya, bukan langsung. Menghapus jurnal asal ikut menghapus pembaliknya. Menghapus pembalik membuat jurnal asal tidak lagi bertanda dibalik.",
  },
  {
    kategori: "Laporan",
    t: "Kenapa saldo bank dan Arus Kas tidak berubah setelah jurnal disimpan?",
    j: "Karena jurnal ini bukan mutasi. Uang di rekening tidak bertambah atau berkurang, jadi saldo berjalan dan Arus Kas tetap dari mutasi bank saja. Yang berubah adalah klasifikasi di laporan: misalnya Deposit Gaji (harta) berkurang dan Beban Gaji bertambah, jadi laba turun. Kotak Kas cocok juga tidak terpengaruh jurnal.",
  },
  {
    kategori: "Laporan",
    t: "Siapa yang boleh membuat jurnal, dan apakah saran angkanya sudah tersimpan?",
    j: "ADMIN dan OWNER boleh membuat, mengubah, dan menghapus. Siapa pun yang bisa membuka Laporan, termasuk STAFF, boleh melihat dan mengunduh PDF. Bendahara tidak membuka Laporan, jadi tidak melihat jurnal. Akun yang dibatasi brand hanya melihat jurnal brand-nya. Saran (mutasi keluar, mutasi masuk, dan posisi kumulatif) hanya angka bantu. Posisi kumulatif sudah memperhitungkan jurnal sebelumnya. Tidak ada yang terpasang otomatis.",
  },
  {
    kategori: "Persediaan",
    t: "Dari mana nilai persediaan di Neraca?",
    j: "Dari Stok Opname: Σ stok × HPP semua SKU, dipecah per brand. SO terakhir yang tanggal stoknya sudah lewat dipakai untuk tanggal Neraca. Bukan dari transaksi bank.",
  },
  {
    kategori: "Persediaan",
    t: "Apa itu 599 Selisih HPP?",
    j: "Baris otomatis di Laba Rugi: persediaan awal periode dikurangi persediaan akhir periode. Positif berarti stok berkurang (menambah HPP), negatif berarti stok bertambah (mengurangi HPP). Jadi HPP = Pembelian (kode 5xx) + Selisih HPP. Tidak perlu diinput manual.",
  },
  {
    kategori: "Persediaan",
    t: "Kapan SO diunggah dan tanggalnya diisi apa?",
    j: "Tim SO tanggal 1 (atau tanggal 2 kalau tanggal 1 libur) lalu diunggah di tanggal itu. Isi Tanggal input dengan hari itu. Sistem otomatis menganggap SO tanggal 1 sampai 5 sebagai stok akhir bulan sebelumnya; tanggal stoknya bisa diubah di form. Cukup sekali isi tanggal untuk seluruh file.",
  },
  {
    kategori: "Persediaan",
    t: "Kalau HPP produk berubah, apakah Neraca bulan lalu ikut berubah?",
    j: "Tidak. HPP tiap SKU dikunci (snapshot) saat SO disimpan. Perubahan HPP hanya berlaku untuk SO berikutnya. Karena itu isi HPP dulu di Master Produk sebelum mengunggah SO; pop up pemeriksaan memperingatkan SKU berstok yang HPP-nya masih 0.",
  },
  {
    kategori: "Persediaan",
    t: "Bagaimana mengubah HPP banyak SKU sekaligus?",
    j: "Di Stok & HPP → Master Produk: Download template (sudah berisi data sekarang), ubah kolom HPP di Excel, lalu Unggah. Sistem menampilkan SKU mana yang berubah (HPP lama → baru) sebelum disimpan. Hanya ADMIN dan OWNER.",
  },
  {
    kategori: "Persediaan",
    t: "SKU di file SO tidak ada di master, apa yang terjadi?",
    j: "Baris itu ditolak dan muncul di pop up lengkap dengan nomor baris dan alasannya. Klik Download Excel baris gagal, perbaiki, lalu unggah ulang. Anda bisa memilih menyimpan baris yang valid saja, tapi nilai persediaan jadi lebih kecil dari kenyataan, jadi lebih aman memperbaiki dulu.",
  },
  {
    kategori: "Persediaan",
    t: "Kenapa Neraca menunjukkan peringatan 'SO belum menjangkau periode ini' atau 'kode 103'?",
    j: "Peringatan pertama: SO terakhir yang ada lebih lama dari akhir periode laporan, jadi persediaan akhir dan Selisih HPP belum final sampai SO berikutnya diunggah (penting sebelum tutup buku Alokasi). Peringatan kedua: kode 103 Persediaan Barang Dagang masih berisi transaksi bank, padahal persediaan kini dihitung dari SO. Pindahkan pembelian barang ke kode 5xx supaya tidak dobel.",
  },
  {
    kategori: "Persediaan",
    t: "Bagaimana laporan per brand?",
    j: "Di Laporan pilih Brand. Isinya rekening yang diberi brand itu (atur di menu Rekening), persediaan brand itu, dan jurnal penyesuaian brand itu. Rekening tanpa brand hanya muncul di Semua brand. Laporan per satu rekening tidak menampilkan persediaan dan tidak memasukkan jurnal, karena jurnal dicatat per brand.",
  },
  {
    kategori: "Brand",
    t: "Di mana menambah brand?",
    j: "Menu Brand (OWNER dan ADMIN yang tidak dibatasi). Brand juga otomatis dibuat saat unggah master produk, tapi dengan persetujuan di pop up. Mengganti nama brand tidak merusak data lama. Brand yang sudah dipakai rekening, produk, SO, atau pengguna tidak bisa dihapus.",
  },
  {
    kategori: "Brand",
    t: "Bagaimana membatasi seorang pengguna ke brand tertentu?",
    j: "Menu Pengguna → Ubah → Akses brand, pilih satu atau lebih brand (OWNER saja yang bisa). Kosong berarti semua brand. Akun yang dibatasi hanya melihat dan mengelola rekening milik brand itu: transaksi, rekap, dokumen, dashboard, laporan, dan export. Pembatasan dicek di server dan langsung berlaku tanpa login ulang. Perubahannya tercatat di Log Aktivitas.",
  },
  {
    kategori: "Brand",
    t: "Fitur apa yang tidak tersedia untuk akun yang dibatasi brand?",
    j: "Alokasi, Stok & HPP (SO dan master produk), Kode Akun, dan Brand, karena semuanya lintas brand dan tidak bisa dipotong per brand. Nilai persediaan brand mereka tetap terlihat di Laporan dan Dashboard. OWNER selalu melihat semua brand.",
  },
  {
    kategori: "Alokasi",
    t: "Pengeluaran dari kode alokasi (Zakat, Santunan, dll.) muncul di mana di Laporan?",
    j: "Di Neraca dan Perubahan Modal sebagai pengurang ekuitas, dan di Arus Kas sebagai Pendanaan. Tidak masuk Laba Rugi, jadi tidak mengurangi laba yang menjadi dasar alokasi bulan berikutnya. Rincian saldo tiap alokasi (jatah dikurangi pemakaian) ada di halaman Alokasi. Kalau ingin perlakuan lain, ubah kolom Masuk laporan dan Arus kas pada kode itu di Kode Akun.",
  },
  {
    kategori: "Alokasi",
    t: "Bagaimana saldo alokasi dihitung?",
    j: "Saldo = saldo awal + jatah dari distribusi yang sudah disahkan − pemakaian. Pemakaian dihitung dari transaksi uang keluar berkode alokasi itu (termasuk rincian split) dan dari jurnal penyesuaian pada kode yang sama: debit menambah pemakaian, kredit menguranginya. Jatah bulanan = laba bersih yang disahkan OWNER × persen alokasi kode itu.",
  },
  {
    kategori: "Alokasi",
    t: "Kenapa saya tidak bisa menutup buku bulan ini?",
    j: "Bulan yang masih berjalan belum bisa disahkan labanya karena belum final. Tunggu bulannya berakhir. Hanya OWNER yang bisa mengesahkan laba.",
  },
  {
    kategori: "Alokasi",
    t: "Kenapa tombol distribusi mati atau ditolak?",
    j: "Beberapa kemungkinan: laba bulan itu belum disahkan OWNER; laba berubah sejak disahkan (ada transaksi atau jurnal penyesuaian yang diubah, OWNER perlu mengesahkan ulang); labanya nol atau rugi (tidak ada yang dibagikan); atau total persentase alokasi melebihi 100% (perbaiki di Kode Akun). Bulan yang sudah dibagikan tidak bisa dibagikan dua kali.",
  },
  {
    kategori: "Alokasi",
    t: "Siapa yang bisa membatalkan distribusi?",
    j: "Hanya OWNER. Jatah bulan itu hilang dari saldo alokasi dan pembatalannya tercatat di Log Aktivitas. Laba bulan itu tetap berstatus disahkan.",
  },
  {
    kategori: "Kas tunai",
    t: "Apa itu Petty Cash dan siapa yang memegangnya?",
    j: "Kas tunai yang dipegang orang tertentu, mis. kas gudang atau kas office. Dibuat sebagai rekening berjenis Petty Cash di menu Rekening, boleh lebih dari satu. Saldonya masuk Kas dan Setara Kas di Neraca dan Arus Kas, tampil sebagai kelompok tersendiri. Dicatat manual oleh Bendahara. Catatan: saat ini semua Bendahara bisa melihat semua petty cash, belum dibatasi per kas.",
  },
  {
    kategori: "Dokumen",
    t: "Kenapa file mutasi yang saya unggah tidak ada di arsip?",
    j: "Screenshot dan PDF di halaman Rekap hanya dipakai untuk membaca mutasi, lalu dibuang. File itu tidak masuk arsip. Supaya tersimpan, unggah di halaman Dokumen: arsip di sana permanen, dikelompokkan per rekening. File hanya hilang dari Dokumen kalau Admin atau Owner menghapusnya manual. Catatannya (nama file, rekening, periode, siapa, kapan) tetap ada.",
  },
  {
    kategori: "Akun",
    t: "Saya lupa password. Bagaimana?",
    j: "Belum ada reset mandiri. Minta OWNER mengganti passwordmu lewat menu Pengguna (tombol ubah, isi Password baru). Untuk keamanan, login dibatasi 5 kali percobaan salah per 15 menit.",
  },
  {
    kategori: "Akun",
    t: "Kenapa akun yang sudah tidak dipakai tidak bisa dihapus?",
    j: "Akun yang pernah beraktivitas tidak boleh dihapus, karena menghapusnya memutus catatan siapa yang mengubah apa di Log Aktivitas. Nonaktifkan saja: ia tidak bisa login lagi, tapi jejaknya utuh.",
  },
  {
    kategori: "Akun",
    t: "Saya membuka halaman lalu dialihkan ke halaman lain. Kenapa?",
    j: "Halaman itu tidak tersedia untuk role kamu, jadi kamu dialihkan ke halaman pertama yang boleh dibuka. Lihat tab Penjelasan Role untuk tahu apa yang bisa dibuka tiap role.",
  },
];

function TanyaJawab() {
  const [cari, setCari] = React.useState("");
  const q = cari.trim().toLowerCase();
  const tampil = QNA.filter(
    (x) => !q || x.t.toLowerCase().includes(q) || x.j.toLowerCase().includes(q) || x.kategori.toLowerCase().includes(q)
  );
  const kategori = [...new Set(tampil.map((x) => x.kategori))];

  return (
    <div>
      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
        <input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari pertanyaan, mis. ACC, jurnal, alokasi"
          aria-label="Cari pertanyaan"
          className={`${INPUT_CLASS} pl-8`}
        />
      </div>

      {tampil.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-600 dark:text-gray-400">Tidak ada pertanyaan yang cocok dengan &quot;{cari}&quot;.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {kategori.map((k) => (
            <Card key={k}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">{k}</h2>
              <div className="divide-y divide-gray-200 dark:divide-zinc-700">
                {tampil
                  .filter((x) => x.kategori === k)
                  .map((x) => (
                    <details key={x.t} className="group py-2.5" open={q.length > 0}>
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-sm font-medium text-gray-900 dark:text-gray-50">
                        <span>{x.t}</span>
                        <span
                          aria-hidden
                          className="mt-0.5 shrink-0 text-gray-500 transition-transform group-open:rotate-90 dark:text-gray-400"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      </summary>
                      <div className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">{x.j}</div>
                    </details>
                  ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── WORKFLOW ─────────────────────────

interface LangkahAlur {
  role?: Role;
  teks: string;
  status?: string;
}

const ALUR: { judul: string; deskripsi: string; langkah: LangkahAlur[] }[] = [
  {
    judul: "1. Dari mutasi bank sampai masuk laporan",
    deskripsi: "Jalur utama yang dilewati setiap transaksi bank.",
    langkah: [
      { role: "STAFF", teks: "Upload screenshot atau PDF di Rekap, pilih rekening" },
      { teks: "AI membaca transaksi, lalu menyarankan kode akun (dua tahap terpisah)" },
      { role: "STAFF", teks: "Periksa baris merah, koreksi kode, split bila perlu" },
      { role: "STAFF", teks: "Simpan Semua. Baris Duplikat tidak ikut kecuali dicentang Ikut", status: "ACC Bendahara" },
      { role: "BENDAHARA", teks: "Verifikasi input staff (koreksi kode/split lanjut ke Finance)", status: "Disetujui" },
      { teks: "Masuk Laporan: Laba Rugi, Neraca, Arus Kas, Perubahan Modal" },
    ],
  },
  {
    judul: "2. Koreksi dan pengesahan (ACC berjenjang)",
    deskripsi: "Koreksi dari STAFF lewat dua tahap: verifikasi Bendahara, lalu finalisasi Finance untuk kode/catatan/split.",
    langkah: [
      { role: "STAFF", teks: "Mengubah kode, catatan, split, atau tanda yakin sebuah transaksi", status: "ACC Bendahara" },
      { role: "BENDAHARA", teks: "Periksa koreksi ringan, lalu verifikasi", status: "Disetujui" },
      { role: "BENDAHARA", teks: "Koreksi kode/catatan/split: verifikasi dulu, lalu diteruskan", status: "Perlu ACC Finance" },
      { role: "ADMIN", teks: "Finalkan koreksi kode/catatan/split yang diteruskan Bendahara", status: "Disetujui" },
      { teks: "Perubahan oleh ADMIN/OWNER otomatis disetujui dan tercatat atas namanya" },
      { teks: "Kalau STAFF mengubah lagi transaksi yang sudah disetujui, statusnya dihitung ulang (berjenjang)" },
    ],
  },
  {
    judul: "3. Kas tunai (petty cash)",
    deskripsi: "Untuk uang tunai yang tidak punya mutasi bank — input manual bebas ACC.",
    langkah: [
      { role: "OWNER", teks: "Buat rekening berjenis Petty Cash dengan saldo awal (menu Rekening)" },
      { role: "BENDAHARA", teks: "Catat belanja atau isi ulang lewat Tambah Transaksi", status: "Disetujui" },
      { teks: "Input petty cash langsung final (tanpa ACC); kode boleh dilengkapi Finance kapan saja" },
      { teks: "Saldo petty cash tampil sebagai kelompok sendiri di Neraca, dan ikut total kas" },
    ],
  },
  {
    judul: "4. Tutup bulan dan pembagian alokasi",
    deskripsi: "Dilakukan awal bulan, untuk laba bulan sebelumnya. Jurnal penyesuaian dicatat dulu, karena ia mengubah laba. Urutan sahkan lalu bagikan dipaksa oleh sistem.",
    langkah: [
      { role: "ADMIN", teks: "Pastikan semua transaksi bulan itu sudah disetujui dan berkode (cek banner di Laporan)" },
      { role: "ADMIN", teks: "Per brand, catat Jurnal Penyesuaian yang tidak menggerakkan bank. Contoh: kredit 10415 Deposit Gaji, debit 601 Beban Gaji. Reklasifikasi jangan dibalik. Akrual boleh dicentang Balik tanggal 1 bulan berikutnya" },
      { role: "OWNER", teks: "Sahkan laba bersih bulan itu di menu Alokasi (tutup buku). Angkanya disimpan sebagai snapshot" },
      { role: "ADMIN", teks: "Lihat pratinjau, lalu sahkan distribusi: jatah = laba disahkan × persen tiap kode" },
      { teks: "Jatah masuk ke saldo alokasi tiap kode, dan tercatat di Log Aktivitas" },
      { teks: "Uang keluar berkode alokasi (ZIS, Alokasi R, dst) mengurangi saldonya. Jurnal penyesuaian pada kode yang sama juga ikut: debit menambah pemakaian, kredit menguranginya" },
    ],
  },
  {
    judul: "5. Stok opname dan persediaan",
    deskripsi: "Dasar nilai persediaan di Neraca dan Selisih HPP di Laba Rugi. Sekali SO untuk semua produk dan semua brand.",
    langkah: [
      { role: "ADMIN", teks: "Sekali di awal: unggah master produk (SKU, Brand, HPP) di Stok & HPP → Master Produk. Sistem menampilkan hasil pemeriksaan dulu, termasuk brand baru dan baris yang gagal" },
      { role: "ADMIN", teks: "Hubungkan tiap rekening ke brand-nya di menu Rekening (dasar laporan per brand)" },
      { role: "ADMIN", teks: "Sekali di awal: unggah Persediaan Awal. Nilainya masuk modal awal (harta awal), bukan laba" },
      { role: "STAFF", teks: "Tiap awal bulan (tgl 1, atau tgl 2 kalau libur): unggah SO Bulanan, isi tanggal input sekali di form, bukan per baris", status: "Menunggu ACC" },
      { teks: "Sistem memeriksa file. Kalau ada SKU yang tidak ada di master atau stok tidak valid, muncul pop up berisi alasan per baris, plus file Excel baris gagal untuk diperbaiki" },
      { role: "ADMIN", teks: "Setujui SO. HPP tiap SKU dikunci saat SO disimpan, jadi Neraca bulan lalu tidak berubah walau HPP diubah kemudian", status: "Disetujui" },
      { teks: "Laporan per brand menghitung Persediaan (Neraca) dan 599 Selisih HPP = persediaan awal periode − akhir periode (Laba Rugi)" },
    ],
  },
  {
    judul: "6. Arsip dokumen mutasi",
    deskripsi: "Gudang file mutasi semua rekening. File di sini tidak dihapus otomatis.",
    langkah: [
      { role: "STAFF", teks: "Unggah PDF atau gambar di menu Dokumen, pilih rekening dan periode" },
      { teks: "File tersimpan permanen dan bisa diunduh kapan saja" },
      { teks: "Screenshot dan PDF di halaman Rekap tidak masuk arsip; file itu hanya dibaca lalu dibuang" },
      { role: "ADMIN", teks: "Boleh menghapus file manual kalau perlu. Catatannya tetap ada" },
    ],
  },
];

function Workflow() {
  return (
    <div className="space-y-4">
      {ALUR.map((a) => (
        <Card key={a.judul}>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">{a.judul}</h2>
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">{a.deskripsi}</p>
          <ol className="relative space-y-0">
            {a.langkah.map((l, i) => (
              <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                {i < a.langkah.length - 1 && (
                  <span aria-hidden className="absolute left-3 top-7 h-[calc(100%-1.25rem)] w-px bg-gray-300 dark:bg-zinc-600" />
                )}
                <span className="z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-900 dark:bg-blue-900/50 dark:text-blue-100">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    {l.role ? <ChipRole role={l.role} /> : <Badge>Sistem</Badge>}
                    {l.status && (
                      <>
                        <ArrowRight className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                        <Badge warna={l.status === "Disetujui" ? "hijau" : "biru"}>{l.status}</Badge>
                      </>
                    )}
                  </div>
                  <div className="mt-1 text-gray-900 dark:text-gray-50">{l.teks}</div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ))}
    </div>
  );
}

// ───────────────────────── PENJELASAN ROLE ─────────────────────────

const RINGKAS_ROLE: {
  role: Role;
  peran: string;
  menu: { grup: string; item: string[] }[];
  bisa: string[];
  tidak: string[];
  catatan?: string;
}[] = [
  {
    role: "OWNER",
    peran: "Pemilik usaha. Akses penuh, dan satu-satunya yang mengesahkan laba serta mengelola akun.",
    menu: [
      { grup: "Operasional", item: ["Dashboard", "Rekap", "Transaksi", "Dokumen"] },
      { grup: "Tutup buku", item: ["Laporan", "Alokasi", "Stok & HPP"] },
      { grup: "Master", item: ["Rekening", "Brand", "Kode Akun"] },
      { grup: "Administrasi", item: ["Pengguna", "Log Aktivitas"] },
      { grup: "Di bawah sidebar", item: ["Panduan"] },
    ],
    bisa: [
      "Semua yang bisa dilakukan ADMIN",
      "Membuat, mengubah, dan menonaktifkan akun pengguna",
      "Melihat Log Aktivitas: siapa mengubah apa, kapan, dari nilai berapa ke berapa",
      "Mengesahkan laba bersih bulanan (tutup buku) dan membukanya kembali",
      "Membatalkan distribusi alokasi yang sudah disahkan",
    ],
    tidak: ["Menghapus akun yang punya jejak aktivitas (harus dinonaktifkan)"],
  },
  {
    role: "ADMIN",
    peran: "Finance. Mengelola data keuangan dan mengesahkan pekerjaan tim.",
    menu: [
      { grup: "Operasional", item: ["Dashboard", "Rekap", "Transaksi", "Dokumen"] },
      { grup: "Tutup buku", item: ["Laporan", "Alokasi", "Stok & HPP"] },
      { grup: "Master", item: ["Rekening", "Brand", "Kode Akun"] },
      { grup: "Di bawah sidebar", item: ["Panduan"] },
    ],
    bisa: [
      "Meng-ACC koreksi dan input STAFF serta Bendahara (satuan atau massal)",
      "Mengubah transaksi tanpa perlu ACC, perubahannya langsung disetujui",
      "Menghapus transaksi dan menghapus file dokumen lebih awal",
      "Mengelola Rekening dan Kode Akun, termasuk persen alokasi",
      "Membuat, mengubah, dan menghapus Jurnal Penyesuaian per brand, serta mengunduh PDF-nya",
      "Mengesahkan distribusi alokasi dari laba yang sudah disahkan OWNER",
      "Melihat Dashboard, Laporan, dan export Excel",
    ],
    tidak: ["Mengesahkan laba (tutup buku)", "Membatalkan distribusi alokasi", "Mengelola pengguna dan melihat Log Aktivitas"],
  },
  {
    role: "STAFF",
    peran: "Staf yang merekap mutasi dan membantu mengoreksi. Pekerjaannya disahkan Finance.",
    menu: [
      { grup: "Operasional", item: ["Dashboard", "Rekap", "Transaksi", "Dokumen"] },
      { grup: "Tutup buku", item: ["Laporan", "Stok & HPP"] },
      { grup: "Di bawah sidebar", item: ["Panduan"] },
    ],
    bisa: [
      "Upload mutasi, memeriksa hasil AI, dan menyimpan rekap",
      "Mengoreksi kode akun dan catatan, serta split transaksi",
      "Menambah transaksi manual",
      "Mengunggah dan mengunduh dokumen mutasi",
      "Melihat Dashboard, Laporan, dan Jurnal Penyesuaian, serta mengunduh PDF jurnal",
    ],
    tidak: [
      "Semua perubahannya berstatus Menunggu ACC",
      "Menghapus transaksi",
      "Membuat, mengubah, atau menghapus Jurnal Penyesuaian",
      "Mengelola rekening, kode akun, alokasi, atau pengguna",
    ],
  },
  {
    role: "BENDAHARA",
    peran: "Pemegang kas tunai (mis. gudang) yang tidak punya mutasi bank, jadi mencatat manual.",
    menu: [
      { grup: "Operasional", item: ["Transaksi"] },
      { grup: "Tutup buku", item: ["Stok & HPP"] },
      { grup: "Di bawah sidebar", item: ["Panduan"] },
    ],
    bisa: [
      "Menambah transaksi manual di rekening petty cash",
      "Melihat dan mengoreksi transaksi petty cash",
      "Memakai Split pada transaksi petty cash",
    ],
    tidak: [
      "Semua inputnya berstatus Menunggu ACC",
      "Melihat atau mengubah rekening bank",
      "Memakai Rekap, Dokumen, Dashboard, Laporan, Alokasi, atau export",
    ],
    catatan:
      "Saat ini semua Bendahara bisa melihat semua petty cash. Pembatasan per kas (mis. Bendahara Gudang hanya Kas Gudang) belum ada.",
  },
];

/** Matriks izin. Harus tetap sama dengan aturan di lib/auth.ts di server. */
type Izin = boolean | "acc" | "acc-kas";

const MATRIKS: { aksi: string; o: Izin; a: Izin; s: Izin; b: Izin }[] = [
  { aksi: "Upload mutasi & simpan Rekap", o: true, a: true, s: "acc", b: false },
  { aksi: "Koreksi kode, catatan, dan split", o: true, a: true, s: "acc", b: "acc-kas" },
  { aksi: "Tambah transaksi manual", o: true, a: true, s: "acc", b: "acc-kas" },
  { aksi: "ACC (sahkan) pekerjaan STAFF/Bendahara", o: true, a: true, s: false, b: false },
  { aksi: "Hapus transaksi", o: true, a: true, s: false, b: false },
  { aksi: "Dashboard, Laporan, export Excel", o: true, a: true, s: true, b: false },
  { aksi: "Buat, ubah, hapus Jurnal Penyesuaian", o: true, a: true, s: false, b: false },
  { aksi: "Unggah dan unduh Dokumen", o: true, a: true, s: true, b: false },
  { aksi: "Hapus file Dokumen lebih awal", o: true, a: true, s: false, b: false },
  { aksi: "Unggah Stok Opname (SO)", o: true, a: true, s: "acc", b: "acc" },
  { aksi: "Master Produk dan HPP (lihat, ubah, mass edit)", o: true, a: true, s: false, b: false },
  { aksi: "Kelola Rekening dan Kode Akun", o: true, a: true, s: false, b: false },
  { aksi: "Lihat Alokasi dan saldonya", o: true, a: true, s: false, b: false },
  { aksi: "Sahkan distribusi alokasi", o: true, a: true, s: false, b: false },
  { aksi: "Sahkan laba bulanan (tutup buku)", o: true, a: false, s: false, b: false },
  { aksi: "Batalkan distribusi alokasi", o: true, a: false, s: false, b: false },
  { aksi: "Kelola pengguna & lihat Log Aktivitas", o: true, a: false, s: false, b: false },
];

function Sel({ v }: { v: Izin }) {
  if (v === "acc" || v === "acc-kas") {
    return (
      <span
        title={
          v === "acc-kas"
            ? "Boleh hanya di rekening petty cash, dan hasilnya menunggu ACC Finance"
            : "Boleh, tapi hasilnya menunggu ACC Finance"
        }
        className="inline-flex flex-col items-center gap-0.5"
      >
        <Check className="h-4 w-4 text-green-700 dark:text-green-400" aria-label="Boleh" />
        <span className="text-[10px] font-medium leading-tight text-blue-800 dark:text-blue-300">
          {v === "acc-kas" ? "perlu ACC, kas tunai saja" : "perlu ACC"}
        </span>
      </span>
    );
  }
  return v ? (
    <Check className="mx-auto h-4 w-4 text-green-700 dark:text-green-400" aria-label="Boleh" />
  ) : (
    <Minus className="mx-auto h-4 w-4 text-gray-500 dark:text-gray-500" aria-label="Tidak boleh" />
  );
}

function PenjelasanRole({ roleSaya }: { roleSaya: Role | null }) {
  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-50">Siapa boleh apa</h2>
        <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">
          Centang = boleh langsung. <strong>Perlu ACC</strong> = boleh dikerjakan, tapi transaksinya diberi badge{" "}
          &quot;Menunggu ACC&quot; sampai Finance (ADMIN) atau OWNER menyetujuinya di halaman Transaksi (ACC = persetujuan/pengesahan).
          Selama menunggu, transaksinya tetap ikut laporan. <strong>Perlu ACC, kas tunai saja</strong> = sama, tapi hanya untuk rekening petty cash. Tanda minus = tidak boleh; sistem
          menolaknya di server, bukan hanya menyembunyikan tombolnya.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-600 dark:border-zinc-700 dark:text-gray-400">
                <th className="px-2 py-2 text-left font-medium">Aksi</th>
                {(["OWNER", "ADMIN", "STAFF", "BENDAHARA"] as Role[]).map((r) => (
                  <th key={r} className={cn("px-2 py-2 text-center font-medium", r === roleSaya && "text-blue-800 dark:text-blue-300")}>
                    {r === "ADMIN" ? "ADMIN" : r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIKS.map((m) => (
                <tr key={m.aksi} className="border-b border-gray-100 dark:border-zinc-800">
                  <td className="px-2 py-2 text-gray-900 dark:text-gray-50">{m.aksi}</td>
                  <td className="px-2 py-2 text-center"><Sel v={m.o} /></td>
                  <td className="px-2 py-2 text-center"><Sel v={m.a} /></td>
                  <td className="px-2 py-2 text-center"><Sel v={m.s} /></td>
                  <td className="px-2 py-2 text-center"><Sel v={m.b} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {RINGKAS_ROLE.map((r) => (
          <Card key={r.role} className={cn(r.role === roleSaya && "ring-2 ring-blue-500 dark:ring-blue-400")}>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <ChipRole role={r.role} />
              {r.role === roleSaya && <Badge warna="biru">Role kamu</Badge>}
            </div>
            <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">{r.peran}</p>

            <div className="mb-3 space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Menu yang terlihat</div>
              {r.menu.map((g) => (
                <div key={g.grup}>
                  <div className="mb-1 text-[11px] font-semibold tracking-[0.12em] text-gray-600 uppercase dark:text-gray-400">
                    {g.grup}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {g.item.map((m) => (
                      <Badge key={m}>{m}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Bisa</div>
              <ul className="space-y-1 text-sm text-gray-900 dark:text-gray-50">
                {r.bisa.map((x) => (
                  <li key={x} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-700 dark:text-green-400" />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Tidak bisa / perlu tahu</div>
              <ul className="space-y-1 text-sm text-gray-900 dark:text-gray-50">
                {r.tidak.map((x) => (
                  <li key={x} className="flex gap-2">
                    <Minus className="mt-0.5 h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </div>

            {r.catatan && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                {r.catatan}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── HALAMAN ─────────────────────────

export default function PanduanPage() {
  const [tab, setTab] = React.useState<Tab>("mulai");
  const [roleSaya, setRoleSaya] = React.useState<Role | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) setRoleSaya((await res.json()).user.role);
      } catch {
        /* panduan tetap terbaca tanpa penanda role */
      }
    })();
  }, []);

  return (
    <>
      <PageHeader
        judul="Panduan"
        deskripsi="Cara memakai Zaneva Finance: peta menu, mulai cepat, tanya jawab, alur kerja, dan pembagian tugas tiap role."
      />

      <TabList label="Bagian panduan" className="mb-4">
        {TABS.map((t) => (
          <TabButton key={t.key} aktif={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </TabButton>
        ))}
      </TabList>

      {tab === "mulai" && <QuickStart roleSaya={roleSaya} />}
      {tab === "qna" && <TanyaJawab />}
      {tab === "workflow" && <Workflow />}
      {tab === "role" && <PenjelasanRole roleSaya={roleSaya} />}
    </>
  );
}
