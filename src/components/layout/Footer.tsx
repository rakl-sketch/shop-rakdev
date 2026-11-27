import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
export function Footer() {
  return <footer className="site-footer"><div className="page-container footer-grid">
    <div className="footer-brand"><Link to="/" className="brand brand-light"><span className="brand-mark">r<span>.</span></span><span className="brand-word">rakDEV<small>digital shop</small></span></Link><p>Temukan kebutuhan digital untuk membangun dan mengembangkan server Minecraft.</p></div>
    <div><h4>Jelajahi</h4><Link to="/shop">Semua Produk</Link><Link to="/shop?category=plugins">Plugins</Link><Link to="/shop?category=skript">Skript</Link><Link to="/shop?category=maps">Maps</Link><Link to="/shop?category=server-backup">Server Backup</Link></div>
    <div><h4>Bantuan</h4><Link to="/faq">FAQ</Link><Link to="/contact">Hubungi Kami</Link><Link to="/terms">Ketentuan Layanan</Link><Link to="/privacy">Privasi</Link></div>
    <div className="footer-note"><span className="footer-kicker">BUILT FOR SERVER CREATORS</span><h3>Build better.<br/>Play <em>further.</em></h3><Link to="/shop">Jelajahi toko <ArrowUpRight size={16}/></Link></div>
  </div><div className="page-container footer-bottom"><span>© {new Date().getFullYear()} Shop rakDEV. All rights reserved.</span><span>Independent digital marketplace. Not affiliated with Mojang or Microsoft.</span></div></footer>;
}
