import Header from '@/components/Header';
import ResultsDisplay from '@/components/ResultsDisplay';

const Results = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20">
        <ResultsDisplay />
      </main>
    </div>
  );
};

export default Results;

