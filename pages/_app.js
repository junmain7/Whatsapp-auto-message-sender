import BottomNav from '../components/BottomNav';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <BottomNav />
    </>
  );
}
