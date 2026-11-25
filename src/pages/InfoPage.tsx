import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
const content: Record<string, { title: string; text: string }> = {
  about: { title: 'About Shop rakDEV.', text: 'Shop rakDEV adalah marketplace produk digital untuk kebutuhan developer dan pemilik server Minecraft. Kami berfokus pada plugin, Skript, map, dan backup server.' },
  faq: { title: 'Frequently asked questions.', text: 'Informasi kompatibilitas, proses pembayaran, dan download produk akan ditampilkan di halaman ini. Pastikan membaca detail setiap produk sebelum membeli.' },
  contact: { title: 'Contact the team.', text: 'Untuk bantuan terkait pesanan atau produk, gunakan kanal kontak resmi Shop rakDEV yang akan ditambahkan pada pengaturan toko.' },
  terms: { title: 'Terms of service.', text: 'Ketentuan final perlu disesuaikan dengan identitas penjual, hak distribusi setiap produk, kebijakan pengembalian dana, dan aturan transaksi yang berlaku sebelum toko dipublikasikan.' },
  privacy: { title: 'Privacy policy.', text: 'Shop rakDEV hanya boleh mengumpulkan data yang dibutuhkan untuk akun, pesanan, pembayaran, dan pengiriman produk. Kebijakan final harus menjelaskan data, tujuan, masa simpan, dan hak pengguna.' },
};
export default function InfoPage() {
  const { pathname } = useLocation(); const key = pathname.replace('/', ''); const item = content[key] ?? content.about;
  return <div className="page-container info-page"><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><b>{key}</b></div><span className="eyebrow">SHOP rakDEV / INFORMATION</span><h1>{item.title}</h1><p>{item.text}</p><div className="info-callout">Halaman informasi ini merupakan kerangka awal. Lengkapi konten dan data bisnis sebelum website dipublikasikan untuk umum.</div><Link to="/shop"><Button>Lanjut ke Shop <ArrowUpRight size={16}/></Button></Link></div>;
}
