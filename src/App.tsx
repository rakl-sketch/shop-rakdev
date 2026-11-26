import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { SiteLayout } from './components/layout/SiteLayout';
import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { AccountLayout, AccountOverview, ProfilePage, PurchasesPage, DownloadsPage, TransactionsPage } from './pages/AccountPage';
import AdminPage from './pages/AdminPage';
import InfoPage from './pages/InfoPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return <BrowserRouter basename={import.meta.env.BASE_URL}><Routes>
    <Route element={<SiteLayout/>}>
      <Route path="/" element={<HomePage/>}/>
      <Route path="/shop" element={<ShopPage/>}/>
      <Route path="/product/:slug" element={<ProductPage/>}/>
      <Route path="/cart" element={<CartPage/>}/>
      <Route path="/checkout" element={<CheckoutPage/>}/>
      <Route path="/login" element={<LoginPage/>}/>
      <Route path="/register" element={<RegisterPage/>}/>
      <Route path="/account" element={<AccountLayout/>}>
        <Route index element={<AccountOverview/>}/>
        <Route path="profile" element={<ProfilePage/>}/>
        <Route path="purchases" element={<PurchasesPage/>}/>
        <Route path="downloads" element={<DownloadsPage/>}/>
        <Route path="transactions" element={<TransactionsPage/>}/>
      </Route>
      <Route path="/about" element={<InfoPage/>}/>
      <Route path="/faq" element={<InfoPage/>}/>
      <Route path="/contact" element={<InfoPage/>}/>
      <Route path="/terms" element={<InfoPage/>}/>
      <Route path="/privacy" element={<InfoPage/>}/>
      <Route path="*" element={<NotFoundPage/>}/>
    </Route>
    <Route path="/admin" element={<AdminPage/>}/>
    <Route path="/admin/:section" element={<AdminPage/>}/>
  </Routes></BrowserRouter>;
}
