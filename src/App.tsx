import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { CartProvider } from './contexts/CartContext'
import { CartFlyProvider } from './contexts/CartFlyContext'
import { FavoritesProvider } from './contexts/FavoritesContext'
import { ProductsProvider } from './contexts/ProductsContext'
import Layout from './components/Layout'
import GoogleAnalytics from './components/GoogleAnalytics'
import Home from './pages/Home'
import PrivateRoute from './components/PrivateRoute'
import AdminRoute from './components/AdminRoute'

const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const Cart = lazy(() => import('./pages/Cart'))
const Login = lazy(() => import('./pages/Login'))
const SignUp = lazy(() => import('./pages/SignUp'))
const Profile = lazy(() => import('./pages/Profile'))
const Checkout = lazy(() => import('./pages/Checkout'))
const OrderConfirmation = lazy(() => import('./pages/OrderConfirmation'))
const MyOrders = lazy(() => import('./pages/MyOrders'))
const ViewOrder = lazy(() => import('./pages/ViewOrder'))
const Admin = lazy(() => import('./pages/Admin'))

function PageFallback() {
  return (
    <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
      Loading…
    </p>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <GoogleAnalytics />
      <AuthProvider>
        <CartProvider>
          <FavoritesProvider>
            <ProductsProvider>
              <CartFlyProvider>
                <Layout>
                  <Suspense fallback={<PageFallback />}>
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/product/:id" element={<ProductDetail />} />
                      <Route path="/cart" element={<Cart />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup" element={<SignUp />} />
                      <Route
                        path="/profile"
                        element={
                          <PrivateRoute>
                            <Profile />
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/checkout"
                        element={
                          <PrivateRoute>
                            <Checkout />
                          </PrivateRoute>
                        }
                      />
                      <Route path="/order-confirmation" element={<OrderConfirmation />} />
                      <Route
                        path="/my-orders"
                        element={
                          <PrivateRoute>
                            <MyOrders />
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/my-orders/view/:refId"
                        element={
                          <PrivateRoute>
                            <ViewOrder />
                          </PrivateRoute>
                        }
                      />
                      <Route
                        path="/admin"
                        element={
                          <AdminRoute>
                            <Admin />
                          </AdminRoute>
                        }
                      />
                    </Routes>
                  </Suspense>
                </Layout>
              </CartFlyProvider>
            </ProductsProvider>
          </FavoritesProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
