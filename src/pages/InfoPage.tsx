import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { WHATSAPP_DISPLAY } from '../lib/whatsapp';
const content: Record<string, { title: string; text: string }> = {
  about: { title: 'About Shop rakDEV.', text: 'Shop rakDEV adalah marketplace produk digital untuk kebutuhan developer dan pemilik server Minecraft. Kami berfokus pada plugin, Skript, map, dan backup server.' },
  faq: { title: 'Frequently asked questions.', text: 'Informasi kompatibilitas, proses pemesanan, dan download produk ditampilkan di halaman ini. Checkout bisa dibayar otomatis dengan QRIS atau dikonfirmasi manual melalui WhatsApp.' },
  contact: { title: 'Contact the team.', text: `Untuk bantuan terkait pesanan atau produk, hubungi admin Shop rakDEV melalui WhatsApp ${WHATSAPP_DISPLAY}. Sertakan nomor pesanan agar proses pengecekan lebih cepat.` },
  terms: { title: 'Terms of service.', text: 'Ketentuan final perlu disesuaikan dengan identitas penjual, hak distribusi setiap produk, kebijakan pengembalian dana, dan aturan transaksi yang berlaku sebelum toko dipublikasikan.' },
  privacy: { title: 'Privacy policy.', text: 'Shop rakDEV hanya mengumpulkan data yang dibutuhkan untuk akun, pesanan, dan pengiriman produk. Data pesanan dapat mencakup nama, nomor kontak, alamat, catatan pesanan, dan status pembayaran QRIS.' },
};
export default function InfoPage() {
  const { pathname } = useLocation(); const key = pathname.replace('/', ''); const item = content[key] ?? content.about;
  return <div className="page-container info-page"><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><b>{key}</b></div><span className="eyebrow">SHOP rakDEV / INFORMATION</span><h1>{item.title}</h1><p>{item.text}</p><div className="info-callout">Hubungi admin Shop rakDEV jika kamu membutuhkan informasi lebih detail terkait produk, pesanan, atau pengunduhan.</div><Link to="/shop"><Button>Lanjut ke Shop <ArrowUpRight size={16}/></Button></Link></div>;
}
