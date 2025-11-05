import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-32 text-center">
        <h1 className="text-6xl font-bold mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-8">Page Not Found</p>
        <Link to="/">
          <Button>Go Home</Button>
        </Link>
      </main>
    </div>
  );
};

export default NotFound;

