import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Container } from 'react-bootstrap';
import { Outlet, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import AgentChat from './components/AgentChat/AgentChat';
import WelcomeModal from './components/WelcomeModal';
import { logout } from './slices/authSlice';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const App = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const expirationTime = localStorage.getItem('expirationTime');
    if (expirationTime) {
      const currentTime = new Date().getTime();

      if (currentTime > expirationTime) {
        dispatch(logout());
      }
    }
  }, [dispatch]);

  // Auto-show welcome modal on first visit
  useEffect(() => {
    if (!localStorage.getItem('proshop_demo_seen')) {
      setShowWelcome(true);
    }
  }, []);

  const hideWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('proshop_demo_seen', '1');
  };

  return (
    <>
      <ToastContainer />
      <Header onShowWelcome={() => setShowWelcome(true)} />
      <main className='py-3'>
        <Container>
          <Outlet />
        </Container>
      </main>
      <Footer />
      <AgentChat onShowWelcome={() => setShowWelcome(true)} />
      <WelcomeModal
        show={showWelcome}
        onHide={hideWelcome}
        onLogin={() => navigate('/login')}
      />
    </>
  );
};

export default App;
