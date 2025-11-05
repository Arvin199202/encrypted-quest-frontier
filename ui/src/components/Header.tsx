import { ConnectButton } from '@rainbow-me/rainbowkit';
import logo from '@/assets/logo.png';

const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Community Voting Logo" className="w-10 h-10" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">Community Voting</h1>
              <p className="text-xs text-muted-foreground">Privacy-Preserving Election</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <ConnectButton showBalance={false} />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

