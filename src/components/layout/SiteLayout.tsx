import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';
export function SiteLayout() {
  return <>
    <a className="skip-link" href="#main-content">Lewati ke konten utama</a>
    <Header/>
    <main id="main-content" tabIndex={-1}><Outlet/></main>
    <Footer/>
    <BottomNav/>
  </>;
}
