import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
export default function NotFoundPage() { return <div className="not-found"><span>404</span><h1>Halaman tidak ditemukan.</h1><p>Halaman yang kamu cari tidak tersedia.</p><Link to="/"><Button><ArrowLeft size={16}/> Kembali ke beranda</Button></Link></div>; }
