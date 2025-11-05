import Header from '@/components/Header';
import Hero from '@/components/Hero';
import VotingArena from '@/components/VotingArena';
import ResultsDisplay from '@/components/ResultsDisplay';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20">
        <Hero />
        <VotingArena />
        <ResultsDisplay />
      </main>
    </div>
  );
};

export default Index;

