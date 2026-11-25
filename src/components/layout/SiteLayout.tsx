import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';
export function SiteLayout() {
  return <><Header/><main><Outlet/></main><Footer/><BottomNav/></>;
}
